import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { parse } from "https://deno.land/std@0.168.0/encoding/csv.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization')!;
    
    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get authenticated user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error('Authentication error:', authError);
      throw new Error('Unauthorized');
    }

    const { datasetId, xColumn, yColumn, chartType } = await req.json();

    if (!datasetId || !xColumn || !yColumn || !chartType) {
      throw new Error('Missing required parameters');
    }

    console.log('Generating chart data for:', { datasetId, xColumn, yColumn, chartType });

    // Get dataset metadata
    const { data: dataset, error: datasetError } = await supabaseClient
      .from('datasets')
      .select('*')
      .eq('id', datasetId)
      .eq('user_id', user.id)
      .single();

    if (datasetError || !dataset) {
      console.error('Dataset fetch error:', datasetError);
      throw new Error('Dataset not found');
    }

    // Download the CSV file from storage
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('datasets')
      .download(dataset.storage_path);

    if (downloadError || !fileData) {
      console.error('File download error:', downloadError);
      throw new Error('Failed to download dataset file');
    }

    // Parse CSV
    const csvText = await fileData.text();
    const records = parse(csvText, { skipFirstRow: true, columns: undefined }) as any[];

    if (records.length === 0) {
      throw new Error('Upload a valid CSV to generate charts.');
    }

    // Extract labels and values
    const labels: string[] = [];
    const values: number[] = [];

    for (const record of records) {
      const xValue = record[xColumn];
      const yValue = record[yColumn];

      if (xValue !== undefined && xValue !== null) {
        labels.push(String(xValue));
      }

      // Parse numeric value
      const numericValue = parseFloat(yValue);
      if (!isNaN(numericValue)) {
        values.push(numericValue);
      } else {
        // For non-numeric values, use 0 or skip
        if (chartType !== 'pie') {
          throw new Error(`Y-axis column "${yColumn}" contains non-numeric values`);
        }
        values.push(0);
      }
    }

    if (values.length === 0) {
      throw new Error('No numeric columns found for chart generation.');
    }

    console.log(`Processed ${labels.length} data points`);

    return new Response(
      JSON.stringify({
        labels,
        values,
        chartType,
        xColumn,
        yColumn
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in generate-chart-data:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'An error occurred while generating chart data',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
