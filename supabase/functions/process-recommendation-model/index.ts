import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple collaborative filtering recommendation system
class SimpleRecommender {
  private userItemMatrix: Map<string, Map<string, number>>;
  private itemUserMatrix: Map<string, Map<string, number>>;
  private users: Set<string>;
  private items: Set<string>;
  
  constructor() {
    this.userItemMatrix = new Map();
    this.itemUserMatrix = new Map();
    this.users = new Set();
    this.items = new Set();
  }
  
  addRating(user: string, item: string, rating: number) {
    // Add to user-item matrix
    if (!this.userItemMatrix.has(user)) {
      this.userItemMatrix.set(user, new Map());
    }
    this.userItemMatrix.get(user)!.set(item, rating);
    
    // Add to item-user matrix
    if (!this.itemUserMatrix.has(item)) {
      this.itemUserMatrix.set(item, new Map());
    }
    this.itemUserMatrix.get(item)!.set(user, rating);
    
    this.users.add(user);
    this.items.add(item);
  }
  
  // Calculate user similarity using cosine similarity
  private calculateUserSimilarity(user1: string, user2: string): number {
    const user1Ratings = this.userItemMatrix.get(user1);
    const user2Ratings = this.userItemMatrix.get(user2);
    
    if (!user1Ratings || !user2Ratings) return 0;
    
    const commonItems = new Set([...user1Ratings.keys()].filter(item => user2Ratings.has(item)));
    
    if (commonItems.size === 0) return 0;
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (const item of commonItems) {
      const rating1 = user1Ratings.get(item)!;
      const rating2 = user2Ratings.get(item)!;
      
      dotProduct += rating1 * rating2;
      norm1 += rating1 * rating1;
      norm2 += rating2 * rating2;
    }
    
    if (norm1 === 0 || norm2 === 0) return 0;
    
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }
  
  // Get recommendations for a user
  getRecommendations(targetUser: string, topK: number = 10): Array<{item: string, score: number}> {
    const targetUserRatings = this.userItemMatrix.get(targetUser);
    if (!targetUserRatings) return [];
    
    const itemScores = new Map<string, number>();
    const userSimilarities = new Map<string, number>();
    
    // Calculate similarities with all other users
    for (const otherUser of this.users) {
      if (otherUser !== targetUser) {
        const similarity = this.calculateUserSimilarity(targetUser, otherUser);
        if (similarity > 0) {
          userSimilarities.set(otherUser, similarity);
        }
      }
    }
    
    // Generate recommendations based on similar users
    for (const [otherUser, similarity] of userSimilarities) {
      const otherUserRatings = this.userItemMatrix.get(otherUser)!;
      
      for (const [item, rating] of otherUserRatings) {
        // Only recommend items the target user hasn't rated
        if (!targetUserRatings.has(item)) {
          const currentScore = itemScores.get(item) || 0;
          itemScores.set(item, currentScore + similarity * rating);
        }
      }
    }
    
    // Sort and return top K recommendations
    return Array.from(itemScores.entries())
      .map(([item, score]) => ({ item, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
  
  // Get popular items
  getPopularItems(topK: number = 10): Array<{item: string, count: number}> {
    const itemCounts = new Map<string, number>();
    
    for (const item of this.items) {
      const itemRatings = this.itemUserMatrix.get(item)!;
      itemCounts.set(item, itemRatings.size);
    }
    
    return Array.from(itemCounts.entries())
      .map(([item, count]) => ({ item, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, topK);
  }
}

// Evaluation metrics
const calculatePrecisionAtK = (predictions: any[], actual: any[], k: number): number => {
  const topK = predictions.slice(0, k);
  const relevant = topK.filter(pred => actual.includes(pred.item));
  return relevant.length / k;
};

const calculateRecallAtK = (predictions: any[], actual: any[], k: number): number => {
  const topK = predictions.slice(0, k);
  const relevant = topK.filter(pred => actual.includes(pred.item));
  return actual.length > 0 ? relevant.length / actual.length : 0;
};

const calculateCoverage = (allRecommendations: any[], totalItems: number): number => {
  const recommendedItems = new Set(allRecommendations.map(rec => rec.item));
  return recommendedItems.size / totalItems;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { model_id } = await req.json();

    console.log('Starting recommendation model processing for model:', model_id);

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
        // Convert to number if numeric, otherwise keep as string
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

    // Extract recommendation configuration
    const config = model.configuration;
    const userColumn = config.user_column;
    const itemColumn = config.item_column;
    const ratingColumn = config.rating_column;
    const topK = config.top_k || 10;

    // Build recommendation system
    const recommender = new SimpleRecommender();
    
    // Filter valid ratings and add to recommender
    const validRatings = data.filter(row => 
      row[userColumn] && row[itemColumn] && !isNaN(row[ratingColumn])
    );

    if (validRatings.length < 10) {
      throw new Error('Insufficient data for recommendations. Need at least 10 valid ratings.');
    }

    for (const row of validRatings) {
      recommender.addRating(
        String(row[userColumn]),
        String(row[itemColumn]),
        Number(row[ratingColumn])
      );
    }

    console.log('Recommendation system built with', validRatings.length, 'ratings');

    // Update progress
    await supabase
      .from('ml_models')
      .update({ training_progress: 70 })
      .eq('id', model_id);

    // Get unique users and items for evaluation
    const uniqueUsers = [...new Set(validRatings.map(r => String(r[userColumn])))];
    const uniqueItems = [...new Set(validRatings.map(r => String(r[itemColumn])))];
    
    console.log('Unique users:', uniqueUsers.length, 'Unique items:', uniqueItems.length);

    // Generate sample recommendations
    const sampleUsers = uniqueUsers.slice(0, Math.min(10, uniqueUsers.length));
    const sampleRecommendations = [];
    const allRecommendations = [];

    for (const user of sampleUsers) {
      const recommendations = recommender.getRecommendations(user, topK);
      sampleRecommendations.push({
        user,
        recommendations
      });
      allRecommendations.push(...recommendations);
    }

    // Calculate evaluation metrics
    let totalPrecision = 0;
    let totalRecall = 0;
    let validEvaluations = 0;

    for (const user of sampleUsers.slice(0, 5)) { // Evaluate on first 5 users
      const userRatings = validRatings.filter(r => String(r[userColumn]) === user);
      const userItems = userRatings.map(r => String(r[itemColumn]));
      
      if (userItems.length > 1) {
        // Split user's items for evaluation
        const testItems = userItems.slice(-Math.max(1, Math.floor(userItems.length * 0.2)));
        const predictions = recommender.getRecommendations(user, topK);
        
        totalPrecision += calculatePrecisionAtK(predictions, testItems, topK);
        totalRecall += calculateRecallAtK(predictions, testItems, topK);
        validEvaluations++;
      }
    }

    const avgPrecision = validEvaluations > 0 ? totalPrecision / validEvaluations : 0;
    const avgRecall = validEvaluations > 0 ? totalRecall / validEvaluations : 0;
    const coverage = calculateCoverage(allRecommendations, uniqueItems.length);

    // Get popular items
    const popularItems = recommender.getPopularItems(10);

    const metrics = {
      precision_at_k: avgPrecision,
      recall_at_k: avgRecall,
      coverage: coverage,
      total_users: uniqueUsers.length,
      total_items: uniqueItems.length,
      total_ratings: validRatings.length
    };

    const results = {
      sample_recommendations: sampleRecommendations,
      popular_items: popularItems,
      total_users: uniqueUsers.length,
      total_items: uniqueItems.length,
      total_ratings: validRatings.length,
      model_type: 'collaborative_filtering'
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
      Analyze this collaborative filtering recommendation system results and provide business insights:
      
      Dataset: ${model.datasets.name}
      User Column: ${userColumn}
      Item Column: ${itemColumn}
      Rating Column: ${ratingColumn}
      
      Statistics:
      - Total Users: ${uniqueUsers.length}
      - Total Items: ${uniqueItems.length}
      - Total Ratings: ${validRatings.length}
      
      Metrics:
      - Precision@${topK}: ${avgPrecision.toFixed(4)}
      - Recall@${topK}: ${avgRecall.toFixed(4)}
      - Coverage: ${coverage.toFixed(4)}
      
      Top Items: ${popularItems.slice(0, 5).map(item => item.item).join(', ')}
      
      Provide specific business recommendations about user engagement, item popularity, and recommendation strategy optimization.
      `;

      const geminiResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + geminiApiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: insightPrompt }] }]
        })
      });

      if (geminiResponse.ok) {
        const geminiData = await geminiResponse.json();
        insights = geminiData.candidates[0]?.content?.parts[0]?.text || 'No insights generated.';
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

    console.log('Recommendation model processing completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Recommendation model processed successfully',
        model_id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing recommendation model:', error);

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
