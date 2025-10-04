import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple forecasting functions
class SimpleForecast {
  private data: number[];
  private trend: number;
  private seasonal: number[];
  
  constructor(data: number[]) {
    this.data = data;
    this.trend = this.calculateTrend();
    this.seasonal = this.calculateSeasonal();
  }
  
  private calculateTrend(): number {
    if (this.data.length < 2) return 0;
    let sum = 0;
    for (let i = 1; i < this.data.length; i++) {
      sum += this.data[i] - this.data[i - 1];
    }
    return sum / (this.data.length - 1);
  }
  
  private calculateSeasonal(): number[] {
    const seasonLength = Math.min(12, Math.floor(this.data.length / 4));
    const seasonal: number[] = [];
    
    for (let i = 0; i < seasonLength; i++) {
      let sum = 0;
      let count = 0;
      
      for (let j = i; j < this.data.length; j += seasonLength) {
        sum += this.data[j];
        count++;
      }
      
      seasonal.push(count > 0 ? sum / count : 0);
    }
    
    return seasonal;
  }
  
  forecast(periods: number): { forecast: number[], confidence: { upper: number[], lower: number[] } } {
    const forecast: number[] = [];
    const upper: number[] = [];
    const lower: number[] = [];
    
    const lastValue = this.data[this.data.length - 1];
    const volatility = this.calculateVolatility();
    
    for (let i = 0; i < periods; i++) {
      const trendComponent = this.trend * (i + 1);
      const seasonalIndex = i % this.seasonal.length;
      const seasonalComponent = this.seasonal[seasonalIndex] - (this.seasonal.reduce((a, b) => a + b, 0) / this.seasonal.length);
      
      const forecasted = lastValue + trendComponent + seasonalComponent;
      const confidence = volatility * Math.sqrt(i + 1) * 1.96; // 95% confidence interval
      
      forecast.push(forecasted);
      upper.push(forecasted + confidence);
      lower.push(forecasted - confidence);
    }
    
    return { forecast, confidence: { upper, lower } };
  }
  
  private calculateVolatility(): number {
    if (this.data.length < 2) return 0;
    
    let sum = 0;
    for (let i = 1; i < this.data.length; i++) {
      const diff = this.data[i] - this.data[i - 1];
      sum += diff * diff;
    }
    
    return Math.sqrt(sum / (this.data.length - 1));
  }
}

// Statistics helper functions
const calculateMAE = (actual: number[], predicted: number[]): number => {
  let sum = 0;
  const len = Math.min(actual.length, predicted.length);
  for (let i = 0; i < len; i++) {
    sum += Math.abs(actual[i] - predicted[i]);
  }
  return sum / len;
};

const calculateRMSE = (actual: number[], predicted: number[]): number => {
  let sum = 0;
  const len = Math.min(actual.length, predicted.length);
  for (let i = 0; i < len; i++) {
    const diff = actual[i] - predicted[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum / len);
};

const calculateR2 = (actual: number[], predicted: number[]): number => {
  const actualMean = actual.reduce((a, b) => a + b, 0) / actual.length;
  let ssRes = 0;
  let ssTot = 0;
  
  const len = Math.min(actual.length, predicted.length);
  for (let i = 0; i < len; i++) {
    ssRes += Math.pow(actual[i] - predicted[i], 2);
    ssTot += Math.pow(actual[i] - actualMean, 2);
  }
  
  return 1 - (ssRes / ssTot);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { model_id } = await req.json();

    console.log('Starting forecast model processing for model:', model_id);

    // Get model details
    const { data: model, error: modelError } = await supabase
      .from('ml_models')
      .select('*, datasets(*)')
      .eq('id', model_id)
      .single();

    if (modelError || !model) {
      throw new Error(`Model not found: ${modelError?.message}`);
    }

    // Update status to processing
    await supabase
      .from('ml_models')
      .update({ status: 'processing', training_progress: 10 })
      .eq('id', model_id);

    // Download and parse dataset
    const { data: fileData } = await supabase.storage
      .from('datasets')
      .download(model.datasets.storage_path);

    if (!fileData) {
      throw new Error('Failed to download dataset file');
    }

    const fileContent = await fileData.text();
    console.log('Dataset downloaded, size:', fileContent.length);

    // Update progress
    await supabase
      .from('ml_models')
      .update({ training_progress: 30 })
      .eq('id', model_id);

    // Parse CSV data
    const lines = fileContent.trim().split('\n');
    const headers = lines[0].split(',');
    const data = lines.slice(1).map(line => {
      const values = line.split(',');
      const row: Record<string, any> = {};
      headers.forEach((header, index) => {
        const value = values[index]?.trim();
        // Try to parse as number, otherwise keep as string
        row[header.trim()] = isNaN(Number(value)) ? value : Number(value);
      });
      return row;
    });

    console.log('Parsed data rows:', data.length);

    // Update progress
    await supabase
      .from('ml_models')
      .update({ training_progress: 50 })
      .eq('id', model_id);

    // Extract forecast configuration
    const config = model.configuration;
    const targetColumn = config.target_column;
    const dateColumn = config.date_column;
    const forecastHorizon = config.forecast_horizon || 30;

    // Prepare time series data
    const timeSeriesData = data
      .filter(row => !isNaN(row[targetColumn]))
      .sort((a, b) => new Date(a[dateColumn]).getTime() - new Date(b[dateColumn]).getTime())
      .map(row => ({
        date: row[dateColumn],
        value: row[targetColumn]
      }));

    if (timeSeriesData.length < 2) {
      throw new Error('Insufficient data for forecasting. Need at least 2 data points.');
    }

    console.log('Time series data prepared, length:', timeSeriesData.length);

    // Create forecast model
    const values = timeSeriesData.map(d => d.value);
    const forecaster = new SimpleForecast(values);

    // Generate forecast
    const forecastResult = forecaster.forecast(forecastHorizon);
    
    // Update progress
    await supabase
      .from('ml_models')
      .update({ training_progress: 70 })
      .eq('id', model_id);

    // Calculate metrics using a simple train/test split
    const splitPoint = Math.floor(values.length * 0.8);
    const trainData = values.slice(0, splitPoint);
    const testData = values.slice(splitPoint);
    
    if (testData.length > 0) {
      const testForecaster = new SimpleForecast(trainData);
      const testForecast = testForecaster.forecast(testData.length);
      
      var mae = calculateMAE(testData, testForecast.forecast);
      var rmse = calculateRMSE(testData, testForecast.forecast);
      var r2Score = calculateR2(testData, testForecast.forecast);
    } else {
      var mae = 0;
      var rmse = 0;
      var r2Score = 0;
    }

    // Prepare forecast visualization data
    const forecastData = [];
    
    // Historical data
    for (let i = Math.max(0, timeSeriesData.length - 50); i < timeSeriesData.length; i++) {
      forecastData.push({
        date: timeSeriesData[i].date,
        actual: timeSeriesData[i].value,
        forecast: null,
        upper_bound: null,
        lower_bound: null
      });
    }
    
    // Forecast data
    const lastDate = new Date(timeSeriesData[timeSeriesData.length - 1].date);
    for (let i = 0; i < forecastHorizon; i++) {
      const futureDate = new Date(lastDate);
      futureDate.setDate(futureDate.getDate() + (i + 1));
      
      forecastData.push({
        date: futureDate.toISOString().split('T')[0],
        actual: null,
        forecast: forecastResult.forecast[i],
        upper_bound: forecastResult.confidence.upper[i],
        lower_bound: forecastResult.confidence.lower[i]
      });
    }

    const metrics = {
      mae,
      rmse,
      r2_score: r2Score,
      forecast_horizon: forecastHorizon,
      data_points: timeSeriesData.length
    };

    const results = {
      forecast_data: forecastData,
      total_data_points: timeSeriesData.length,
      forecast_horizon: forecastHorizon,
      model_type: 'simple_forecast'
    };

    // Update progress
    await supabase
      .from('ml_models')
      .update({ training_progress: 90 })
      .eq('id', model_id);

    // Generate AI insights
    let insights = '';
    try {
      const insightPrompt = `
      Analyze this time series forecasting model results and provide business insights:
      
      Dataset: ${model.datasets.name}
      Target Variable: ${targetColumn}
      Data Points: ${timeSeriesData.length}
      Forecast Horizon: ${forecastHorizon} periods
      
      Metrics:
      - MAE: ${mae}
      - RMSE: ${rmse}
      - R² Score: ${r2Score}
      
      Latest Values: ${values.slice(-5).join(', ')}
      Forecasted Values: ${forecastResult.forecast.slice(0, 5).join(', ')}
      
      Provide specific business recommendations and insights about trends, seasonality, and forecast reliability.
      `;

      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{ role: 'user', content: insightPrompt }]
        })
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        insights = aiData.choices?.[0]?.message?.content || 'No insights generated.';
      } else {
        const errorText = await aiResponse.text();
        console.error('AI API error:', errorText);
      }
    } catch (error) {
      console.error('Error generating insights:', error);
      insights = 'Unable to generate AI insights at this time.';
    }

    (results as any).insights = insights;

    // Update model with results
    await supabase
      .from('ml_models')
      .update({
        status: 'completed',
        training_progress: 100,
        results,
        metrics
      })
      .eq('id', model_id);

    console.log('Forecast model processing completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Forecast model processed successfully',
        model_id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing forecast model:', error);

    // Update model status to failed if we have the model_id
    try {
      const { model_id } = await req.json();
      if (model_id) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        await supabase
          .from('ml_models')
          .update({ status: 'failed', training_progress: 0 })
          .eq('id', model_id);
      }
    } catch (updateError) {
      console.error('Error updating model status:', updateError);
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: (error as Error).message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
