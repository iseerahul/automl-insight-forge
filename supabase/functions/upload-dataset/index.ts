import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // Get the user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing file upload: ${file.name}, size: ${file.size}, type: ${file.type}`);

    // Create a unique file path
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    // Upload file to storage
    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from('datasets')
      .upload(fileName, file);

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return new Response(JSON.stringify({ error: 'Failed to upload file' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Analyze file content for basic profiling
    let rowCount = null;
    let columnCount = null;
    let dataProfile = {};

    try {
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim());
        rowCount = Math.max(0, lines.length - 1); // Subtract header row
        
        if (lines.length > 0) {
          const headers = lines[0].split(',').map(h => h.trim());
          columnCount = headers.length;
          const rows = lines.slice(1, Math.min(100, lines.length)).map(line => line.split(',').map(cell => cell.trim()));
          rowCount = lines.length - 1; // Exclude header
          
          // Generate proper data profile
          const columnProfile: { [key: string]: any } = {};
          headers.forEach((header, index) => {
            const values = rows.map(row => row[index]).filter(val => val && val.trim() !== '');
            const numericValues = values.map(val => parseFloat(val)).filter(val => !isNaN(val));
            
            // Check if column contains dates
            const dateValues = values.filter(val => {
              const date = new Date(val);
              return !isNaN(date.getTime()) && val.length > 8;
            });
            
            let columnType = 'text';
            if (numericValues.length > values.length * 0.8) {
              columnType = 'numeric';
            } else if (dateValues.length > values.length * 0.5 || 
                       header.toLowerCase().includes('date') || 
                       header.toLowerCase().includes('time') ||
                       header.toLowerCase().includes('created') ||
                       header.toLowerCase().includes('updated')) {
              columnType = 'date';
            }
            
            columnProfile[header] = {
              name: header,
              type: columnType,
              sample_values: values.slice(0, 5),
              null_count: rows.length - values.length,
              unique_count: new Set(values).size
            };
          });

          dataProfile = {
            columns: columnProfile,
            summary: {
              total_rows: rowCount,
              total_columns: columnCount
            },
            sample_rows: rows.slice(0, 5)
          };
        }
      } else if (file.type === 'application/json' || file.name.endsWith('.json')) {
        const text = await file.text();
        const jsonData = JSON.parse(text);
        
        if (Array.isArray(jsonData)) {
          rowCount = jsonData.length;
          if (jsonData.length > 0) {
            const firstItem = jsonData[0];
            if (typeof firstItem === 'object') {
              columnCount = Object.keys(firstItem).length;
              dataProfile = {
                columns: Object.keys(firstItem),
                sample_rows: jsonData.slice(0, 5)
              };
            }
          }
        }
      }
    } catch (profileError) {
      console.log('Error profiling data:', profileError);
      // Continue without profiling data
    }

    // Save dataset metadata to database
    const { data: dataset, error: dbError } = await supabaseClient
      .from('datasets')
      .insert({
        user_id: user.id,
        name: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
        original_filename: file.name,
        file_size: file.size,
        file_type: file.type || 'unknown',
        storage_path: fileName,
        status: 'processed',
        row_count: rowCount,
        column_count: columnCount,
        data_profile: dataProfile
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      // Clean up uploaded file
      await supabaseClient.storage.from('datasets').remove([fileName]);
      
      return new Response(JSON.stringify({ error: 'Failed to save dataset metadata' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      dataset,
      message: 'Dataset uploaded successfully' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Upload dataset error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});