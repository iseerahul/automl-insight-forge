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

    console.log('Chart generation request:', { datasetId, xColumn, yColumn, chartType, userId: user.id });

    if (!datasetId || !xColumn || !yColumn || !chartType) {
      throw new Error('Missing required parameters: datasetId, xColumn, yColumn, or chartType');
    }

    // Get dataset metadata
    const { data: dataset, error: datasetError } = await supabaseClient
      .from('datasets')
      .select('*')
      .eq('id', datasetId)
      .eq('user_id', user.id)
      .single();

    if (datasetError || !dataset) {
      console.error('Dataset fetch error:', datasetError);
      throw new Error('Dataset not found or access denied');
    }

    console.log('Dataset found:', { name: dataset.name, storagePath: dataset.storage_path });

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
    const records = parse(csvText, { skipFirstRow: true }) as string[][];

    if (records.length === 0) {
      throw new Error('Upload a valid CSV to generate charts.');
    }

    console.log(`Parsed ${records.length} rows from CSV`);

    // Get column headers from first row of CSV
    const csvLines = csvText.split('\n');
    const headers = csvLines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    
    console.log('CSV headers:', headers);

    // Find column indices
    const xColumnIndex = headers.findIndex(h => h === xColumn);
    const yColumnIndex = headers.findIndex(h => h === yColumn);

    if (xColumnIndex === -1) {
      throw new Error(`X-axis column "${xColumn}" not found in dataset`);
    }
    if (yColumnIndex === -1) {
      throw new Error(`Y-axis column "${yColumn}" not found in dataset`);
    }

    console.log(`Column indices - X: ${xColumnIndex}, Y: ${yColumnIndex}`);

    // Extract labels and values, filtering out invalid data
    const labels: string[] = [];
    const values: number[] = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      
      if (!record || record.length === 0) continue;

      const xValue = record[xColumnIndex];
      const yValue = record[yColumnIndex];

      if (xValue === undefined || xValue === null || xValue === '') continue;

      // Try to parse Y value as number
      const numericValue = parseFloat(yValue);
      
      if (isNaN(numericValue)) {
        // For non-numeric values, skip this row
        console.log(`Skipping row ${i + 1}: Y value "${yValue}" is not numeric`);
        continue;
      }

      labels.push(String(xValue).trim());
      values.push(numericValue);
    }

    if (values.length === 0) {
      throw new Error('No numeric columns found for chart generation.');
    }

    console.log(`Successfully processed ${labels.length} data points`);

    return new Response(
      JSON.stringify({
        labels,
        values,
        chartType,
        xColumn,
        yColumn,
        dataPoints: labels.length
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
