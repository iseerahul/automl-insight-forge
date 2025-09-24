import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MLVisualization } from "@/components/MLVisualization";
import { 
  Brain, 
  Database, 
  Target, 
  Settings, 
  Play,
  CheckCircle,
  Clock,
  TrendingUp,
  Users,
  DollarSign,
  AlertTriangle,
  Trash2,
  Eye,
  BarChart3,
  FileText,
  Lightbulb,
  Settings2
} from "lucide-react";

const MLStudio = () => {
  const [selectedDataset, setSelectedDataset] = useState("");
  const [selectedProblem, setSelectedProblem] = useState("");
  const [selectedProblemType, setSelectedProblemType] = useState("");
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [modelResults, setModelResults] = useState<any>(null);
  const [resultsHistory, setResultsHistory] = useState<any[]>([]);
  const [selectedResult, setSelectedResult] = useState<any>(null);

  const problemTypes = {
    classification: [
      { id: "churn", name: "Customer Churn Prediction", description: "Predict which customers are likely to churn" },
      { id: "fraud", name: "Fraud Detection", description: "Identify fraudulent transactions or activities" },
      { id: "sentiment", name: "Sentiment Analysis", description: "Classify text sentiment as positive/negative/neutral" },
      { id: "quality", name: "Quality Assessment", description: "Classify product or service quality levels" }
    ],
    regression: [
      { id: "revenue", name: "Revenue Forecasting", description: "Predict future revenue or sales figures" },
      { id: "pricing", name: "Price Optimization", description: "Determine optimal pricing strategies" },
      { id: "demand", name: "Demand Prediction", description: "Forecast product or service demand" },
      { id: "ltv", name: "Customer Lifetime Value", description: "Predict customer lifetime value" }
    ],
    clustering: [
      { id: "segmentation", name: "Customer Segmentation", description: "Group customers by behavior patterns" },
      { id: "market", name: "Market Segmentation", description: "Identify distinct market segments" },
      { id: "product", name: "Product Clustering", description: "Group similar products or services" },
      { id: "user", name: "User Behavior Clustering", description: "Cluster users by usage patterns" }
    ]
  };

  const [datasets, setDatasets] = useState<any[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    fetchDatasets();
    fetchResultsHistory();
  }, []);

  const fetchDatasets = async () => {
    try {
      const { data, error } = await supabase
        .from('datasets')
        .select('*')
        .eq('status', 'processed')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDatasets(data || []);
    } catch (error) {
      console.error('Error fetching datasets:', error);
    }
  };

  const fetchResultsHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('model_results')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setResultsHistory(data || []);
    } catch (error) {
      console.error('Error fetching results history:', error);
    }
  };

  const handleDeleteResult = async (resultId: string) => {
    try {
      const { error } = await supabase
        .from('model_results')
        .delete()
        .eq('id', resultId);

      if (error) throw error;
      
      setResultsHistory(prev => prev.filter(r => r.id !== resultId));
      if (selectedResult?.id === resultId) {
        setSelectedResult(null);
      }
      toast.success('Result deleted successfully');
    } catch (error) {
      console.error('Error deleting result:', error);
      toast.error('Failed to delete result');
    }
  };

  const handleStartTraining = async () => {
    if (!selectedDataset || !selectedProblemType) {
      toast.error('Please select a dataset and problem type');
      return;
    }

    setIsTraining(true);
    setTrainingProgress(0);

    try {
      // Get selected dataset details
      const dataset = datasets.find(d => d.id === selectedDataset);
      if (!dataset) {
        throw new Error('Dataset not found');
      }

      // Create ML model record
      const { data: mlModel, error: modelError } = await supabase
        .from('ml_models')
        .insert({
          user_id: user?.id,
          dataset_id: selectedDataset,
          name: `${getCurrentProblemTypes().find(p => p.id === selectedProblemType)?.name} Model`,
          problem_type: selectedProblem,
          problem_subtype: selectedProblemType,
          configuration: {
            training_split: "80-20",
            validation_method: "cv",
            problem_type: selectedProblem,
            problem_subtype: selectedProblemType,
            dataset_info: {
              name: dataset.name,
              rows: dataset.row_count,
              columns: dataset.column_count
            }
          },
          status: 'created'
        })
        .select()
        .single();

      if (modelError) throw modelError;

      // Call the process-ml-model edge function
      const { data: processResult, error: processError } = await supabase.functions.invoke('process-ml-model', {
        body: { modelId: mlModel.id }
      });

      if (processError) {
        throw new Error('Failed to start training');
      }

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setTrainingProgress(prev => {
          if (prev >= 95) {
            clearInterval(progressInterval);
            return 95;
          }
          return prev + 5;
        });
      }, 1000);

      // Check for completion
      const checkCompletion = setInterval(async () => {
        try {
          const { data: updatedModel } = await supabase
            .from('ml_models')
            .select('*')
            .eq('id', mlModel.id)
            .single();

          if (updatedModel?.status === 'completed') {
            clearInterval(checkCompletion);
            clearInterval(progressInterval);
            setTrainingProgress(100);
            setIsTraining(false);
            setModelResults(updatedModel);
            
            // Save to results history
            const dataset = datasets.find(d => d.id === selectedDataset);
            await supabase.from('model_results').insert({
              user_id: user?.id,
              model_id: updatedModel.id,
              dataset_name: dataset?.name || 'Unknown',
              problem_type: selectedProblem,
              problem_subtype: selectedProblemType,
              metrics: updatedModel.metrics || {},
              results: updatedModel.results || {}
            });
            
            fetchResultsHistory();
            toast.success('Model training completed successfully!');
          } else if (updatedModel?.status === 'error') {
            clearInterval(checkCompletion);
            clearInterval(progressInterval);
            setIsTraining(false);
            setTrainingProgress(0);
            toast.error('Model training failed');
          }
        } catch (error) {
          console.error('Error checking completion:', error);
        }
      }, 2000);

      // Timeout after 2 minutes
      setTimeout(() => {
        clearInterval(checkCompletion);
        clearInterval(progressInterval);
        if (isTraining) {
          setTrainingProgress(100);
          setIsTraining(false);
          toast.success('Model training completed!');
        }
      }, 120000);

    } catch (error) {
      console.error('Training error:', error);
      setIsTraining(false);
      setTrainingProgress(0);
      toast.error('Failed to start training: ' + (error as Error).message);
    }
  };

  const getCurrentProblemTypes = () => {
    if (!selectedProblem) return [];
    return problemTypes[selectedProblem as keyof typeof problemTypes] || [];
  };

  const getProblemIcon = (problemId: string) => {
    const iconMap: { [key: string]: any } = {
      churn: Users,
      fraud: AlertTriangle,
      revenue: DollarSign,
      pricing: TrendingUp,
      segmentation: Users,
      market: Target
    };
    return iconMap[problemId] || Target;
  };

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center mr-4">
              <Brain className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">ML Studio</h1>
              <p className="text-muted-foreground">Visual model builder with automated ML workflows</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Configuration Panel */}
          <div className="space-y-6">
            {/* Step 1: Data Selection */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Database className="w-5 h-5 mr-2" />
                  Step 1: Select Dataset
                </CardTitle>
                <CardDescription>
                  Choose the dataset you want to build a model from
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={selectedDataset} onValueChange={setSelectedDataset}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a dataset from DataConnect Pro" />
                  </SelectTrigger>
                  <SelectContent>
                    {datasets.map(dataset => (
                      <SelectItem key={dataset.id} value={dataset.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{dataset.name}</span>
                          <Badge variant="secondary" className="ml-2">
                            {dataset.row_count ? `${dataset.row_count} rows` : 'Unknown size'}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Step 2: Problem Type */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Target className="w-5 h-5 mr-2" />
                  Step 2: ML Problem Type
                </CardTitle>
                <CardDescription>
                  Select the type of machine learning problem
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={selectedProblem} onValueChange={setSelectedProblem}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose ML problem category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="classification">Classification</SelectItem>
                    <SelectItem value="regression">Regression</SelectItem>
                    <SelectItem value="clustering">Clustering</SelectItem>
                  </SelectContent>
                </Select>

                {selectedProblem && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    {getCurrentProblemTypes().map(type => {
                      const IconComponent = getProblemIcon(type.id);
                      return (
                        <div
                          key={type.id}
                          className={`p-4 border rounded-lg cursor-pointer transition-smooth ${
                            selectedProblemType === type.id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                          onClick={() => setSelectedProblemType(type.id)}
                        >
                          <div className="flex items-start space-x-3">
                            <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center mt-1">
                              <IconComponent className="w-4 h-4 text-accent" />
                            </div>
                            <div className="flex-1">
                              <h4 className="font-medium text-sm">{type.name}</h4>
                              <p className="text-xs text-muted-foreground mt-1">{type.description}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Step 3: Model Configuration */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Settings className="w-5 h-5 mr-2" />
                  Step 3: Model Configuration
                </CardTitle>
                <CardDescription>
                  Configure your model training parameters
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Training Split</label>
                    <Select defaultValue="80-20">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="80-20">80% Train / 20% Test</SelectItem>
                        <SelectItem value="70-30">70% Train / 30% Test</SelectItem>
                        <SelectItem value="90-10">90% Train / 10% Test</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Validation Method</label>
                    <Select defaultValue="cv">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cv">5-Fold Cross Validation</SelectItem>
                        <SelectItem value="holdout">Holdout Validation</SelectItem>
                        <SelectItem value="stratified">Stratified Sampling</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="bg-muted/30 rounded-lg p-4">
                  <h4 className="font-medium mb-2">AutoML Features</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center">
                      <CheckCircle className="w-4 h-4 text-success mr-2" />
                      Feature Engineering
                    </div>
                    <div className="flex items-center">
                      <CheckCircle className="w-4 h-4 text-success mr-2" />
                      Hyperparameter Tuning
                    </div>
                    <div className="flex items-center">
                      <CheckCircle className="w-4 h-4 text-success mr-2" />
                      Model Selection
                    </div>
                    <div className="flex items-center">
                      <CheckCircle className="w-4 h-4 text-success mr-2" />
                      Cross Validation
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Training Section */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Play className="w-5 h-5 mr-2" />
                  Model Training
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!isTraining && trainingProgress < 100 && (
                  <Button 
                    onClick={handleStartTraining}
                    disabled={!selectedDataset || !selectedProblemType}
                    className="w-full gradient-primary text-primary-foreground"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start AutoML Training
                  </Button>
                )}

                {isTraining && (
                  <div className="space-y-4">
                    <div className="flex justify-between text-sm">
                      <span>Training in progress...</span>
                      <span>{trainingProgress}%</span>
                    </div>
                    <Progress value={trainingProgress} className="h-3" />
                    <div className="text-sm text-muted-foreground">
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-2" />
                        Estimated time remaining: {Math.max(0, Math.ceil((100 - trainingProgress) / 10))} minutes
                      </div>
                    </div>
                  </div>
                )}

                {trainingProgress === 100 && !isTraining && (
                  <div className="space-y-4">
                    <div className="flex items-center text-success">
                      <CheckCircle className="w-5 h-5 mr-2" />
                      Training completed successfully!
                    </div>
                    {modelResults && (
                      <div className="mt-4">
                        <Tabs defaultValue="summary" className="w-full">
                          <TabsList className="grid w-full grid-cols-5">
                            <TabsTrigger value="summary" className="flex items-center">
                              <FileText className="w-4 h-4 mr-1" />
                              Summary
                            </TabsTrigger>
                            <TabsTrigger value="metrics" className="flex items-center">
                              <BarChart3 className="w-4 h-4 mr-1" />
                              Metrics
                            </TabsTrigger>
                            <TabsTrigger value="charts" className="flex items-center">
                              <TrendingUp className="w-4 h-4 mr-1" />
                              Charts
                            </TabsTrigger>
                            <TabsTrigger value="insights" className="flex items-center">
                              <Lightbulb className="w-4 h-4 mr-1" />
                              Insights
                            </TabsTrigger>
                            <TabsTrigger value="details" className="flex items-center">
                              <Settings2 className="w-4 h-4 mr-1" />
                              Details
                            </TabsTrigger>
                          </TabsList>

                          {/* Summary Tab */}
                          <TabsContent value="summary" className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              {/* Key Metric */}
                              {modelResults.metrics?.accuracy && (
                                <div className="bg-gradient-to-br from-success/10 to-success/5 rounded-lg p-4 border border-success/20">
                                  <div className="text-sm text-muted-foreground">Model Accuracy</div>
                                  <div className="text-2xl font-bold text-success">
                                    {(modelResults.metrics.accuracy * 100).toFixed(1)}%
                                  </div>
                                </div>
                              )}
                              {modelResults.metrics?.r2_score && (
                                <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-4 border border-primary/20">
                                  <div className="text-sm text-muted-foreground">R² Score</div>
                                  <div className="text-2xl font-bold text-primary">
                                    {modelResults.metrics.r2_score.toFixed(3)}
                                  </div>
                                </div>
                              )}
                              {modelResults.metrics?.silhouette_score && (
                                <div className="bg-gradient-to-br from-accent/10 to-accent/5 rounded-lg p-4 border border-accent/20">
                                  <div className="text-sm text-muted-foreground">Silhouette Score</div>
                                  <div className="text-2xl font-bold text-accent">
                                    {modelResults.metrics.silhouette_score.toFixed(3)}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Quick Insights */}
                            {modelResults.results?.ai_insights?.key_insights && (
                              <div className="bg-accent/10 rounded-lg p-4">
                                <h4 className="font-medium mb-3 flex items-center">
                                  <Lightbulb className="w-4 h-4 mr-2" />
                                  Key Insights
                                </h4>
                                <div className="space-y-2">
                                  {modelResults.results.ai_insights.key_insights.slice(0, 3).map((insight: string, idx: number) => (
                                    <div key={idx} className="text-sm flex items-start">
                                      <div className="w-2 h-2 rounded-full bg-accent mt-2 mr-3 flex-shrink-0" />
                                      {insight}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Next Steps */}
                            {modelResults.results?.ai_insights?.business_recommendations && (
                              <div className="bg-primary/10 rounded-lg p-4">
                                <h4 className="font-medium mb-3">Recommended Actions</h4>
                                <div className="space-y-2">
                                  {modelResults.results.ai_insights.business_recommendations.slice(0, 2).map((rec: string, idx: number) => (
                                    <div key={idx} className="text-sm flex items-start">
                                      <CheckCircle className="w-4 h-4 mr-2 mt-0.5 text-primary flex-shrink-0" />
                                      {rec}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </TabsContent>

                          {/* Metrics Tab */}
                          <TabsContent value="metrics" className="space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                              {Object.entries(modelResults.metrics || {}).map(([key, value]) => (
                                <div key={key} className="bg-muted/30 rounded-lg p-4">
                                  <div className="text-sm text-muted-foreground capitalize mb-1">
                                    {key.replace(/_/g, ' ')}
                                  </div>
                                  <div className="text-xl font-bold">
                                    {typeof value === 'number' 
                                      ? (key.includes('accuracy') || key.includes('score') 
                                        ? (value * 100).toFixed(1) + '%' 
                                        : value.toFixed(3))
                                      : String(value)
                                    }
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Feature Importance */}
                            {modelResults.results?.feature_importance && (
                              <div className="bg-muted/20 rounded-lg p-4">
                                <h4 className="font-medium mb-3">Feature Importance</h4>
                                <div className="space-y-3">
                                  {modelResults.results.feature_importance.slice(0, 5).map((feature: any, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between">
                                      <span className="text-sm font-medium">{feature.feature}</span>
                                      <div className="flex items-center space-x-2">
                                        <div className="w-32 bg-muted rounded-full h-2 overflow-hidden">
                                          <div 
                                            className="h-full bg-primary transition-all"
                                            style={{ width: `${feature.importance * 100}%` }}
                                          />
                                        </div>
                                        <span className="text-sm text-muted-foreground w-12 text-right">
                                          {(feature.importance * 100).toFixed(0)}%
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </TabsContent>

                          {/* Charts Tab */}
                          <TabsContent value="charts" className="space-y-4">
                            <MLVisualization 
                              results={modelResults.results} 
                              problemType={selectedProblem} 
                            />
                          </TabsContent>

                          {/* Insights Tab */}
                          <TabsContent value="insights" className="space-y-4">
                            {modelResults.results?.ai_insights ? (
                              <div className="space-y-6">
                                {/* Key Insights */}
                                {modelResults.results.ai_insights.key_insights && (
                                  <div className="bg-accent/10 rounded-lg p-4">
                                    <h4 className="font-medium mb-3 flex items-center">
                                      <Lightbulb className="w-4 h-4 mr-2" />
                                      Key Insights
                                    </h4>
                                    <div className="space-y-3">
                                      {modelResults.results.ai_insights.key_insights.map((insight: string, idx: number) => (
                                        <div key={idx} className="flex items-start">
                                          <div className="w-2 h-2 rounded-full bg-accent mt-2 mr-3 flex-shrink-0" />
                                          <span className="text-sm">{insight}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Business Recommendations */}
                                {modelResults.results.ai_insights.business_recommendations && (
                                  <div className="bg-primary/10 rounded-lg p-4">
                                    <h4 className="font-medium mb-3 flex items-center">
                                      <CheckCircle className="w-4 h-4 mr-2" />
                                      Business Recommendations
                                    </h4>
                                    <div className="space-y-3">
                                      {modelResults.results.ai_insights.business_recommendations.map((rec: string, idx: number) => (
                                        <div key={idx} className="flex items-start">
                                          <CheckCircle className="w-4 h-4 mr-3 mt-0.5 text-primary flex-shrink-0" />
                                          <span className="text-sm">{rec}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Risk Factors */}
                                {modelResults.results.ai_insights.risk_factors && (
                                  <div className="bg-destructive/10 rounded-lg p-4">
                                    <h4 className="font-medium mb-3 flex items-center">
                                      <AlertTriangle className="w-4 h-4 mr-2" />
                                      Risk Factors
                                    </h4>
                                    <div className="space-y-3">
                                      {modelResults.results.ai_insights.risk_factors.map((risk: string, idx: number) => (
                                        <div key={idx} className="flex items-start">
                                          <AlertTriangle className="w-4 h-4 mr-3 mt-0.5 text-destructive flex-shrink-0" />
                                          <span className="text-sm">{risk}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Opportunities */}
                                {modelResults.results.ai_insights.opportunities && (
                                  <div className="bg-success/10 rounded-lg p-4">
                                    <h4 className="font-medium mb-3 flex items-center">
                                      <TrendingUp className="w-4 h-4 mr-2" />
                                      Opportunities
                                    </h4>
                                    <div className="space-y-3">
                                      {modelResults.results.ai_insights.opportunities.map((opp: string, idx: number) => (
                                        <div key={idx} className="flex items-start">
                                          <TrendingUp className="w-4 h-4 mr-3 mt-0.5 text-success flex-shrink-0" />
                                          <span className="text-sm">{opp}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-center py-8 text-muted-foreground">
                                <Lightbulb className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                <p>No AI insights available for this model</p>
                              </div>
                            )}
                          </TabsContent>

                          {/* Details Tab */}
                          <TabsContent value="details" className="space-y-4">
                            {/* Model Configuration */}
                            <div className="bg-muted/20 rounded-lg p-4">
                              <h4 className="font-medium mb-3">Model Configuration</h4>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Problem Type:</span>
                                  <div className="font-medium capitalize">{selectedProblem}</div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Problem Subtype:</span>
                                  <div className="font-medium">{getCurrentProblemTypes().find(p => p.id === selectedProblemType)?.name}</div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Dataset:</span>
                                  <div className="font-medium">{datasets.find(d => d.id === selectedDataset)?.name}</div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Training Split:</span>
                                  <div className="font-medium">80% / 20%</div>
                                </div>
                              </div>
                            </div>

                            {/* Raw Results */}
                            {modelResults.results && (
                              <div className="bg-muted/20 rounded-lg p-4">
                                <h4 className="font-medium mb-3">Raw Results Data</h4>
                                <pre className="text-xs bg-background rounded p-3 overflow-auto max-h-64">
                                  {JSON.stringify(modelResults.results, null, 2)}
                                </pre>
                              </div>
                            )}

                            {/* Predictions Sample */}
                            {modelResults.results?.predictions && (
                              <div className="bg-muted/20 rounded-lg p-4">
                                <h4 className="font-medium mb-3">Sample Predictions</h4>
                                <div className="space-y-2">
                                  {modelResults.results.predictions.slice(0, 10).map((pred: any, idx: number) => (
                                    <div key={idx} className="text-sm bg-background rounded p-2">
                                      Sample {idx + 1}: {typeof pred === 'number' ? pred.toFixed(3) : String(pred)}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </TabsContent>
                        </Tabs>
                      </div>
                    )}
                    <Button 
                      className="w-full" 
                      variant="outline"
                      onClick={() => {
                        setTrainingProgress(0);
                        setModelResults(null);
                      }}
                    >
                      Train New Model
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Results History Panel */}
          <div className="space-y-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-lg">Results History</CardTitle>
                <CardDescription>
                  View your previous model training results
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {resultsHistory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No training results yet</p>
                    <p className="text-sm">Train your first model to see results here</p>
                  </div>
                 ) : (
                   <div className="space-y-3 max-h-[600px] overflow-y-auto">
                     {resultsHistory.map((result, index) => (
                       <div key={result.id} className="border border-border rounded-lg p-4 hover:bg-muted/20 transition-smooth cursor-pointer group">
                         <div className="flex justify-between items-start mb-2">
                           <span className="font-medium text-sm">{result.problem_subtype} Model</span>
                           <div className="flex items-center gap-2">
                             <Badge variant="secondary" className="text-xs">
                               {result.metrics?.accuracy 
                                 ? `${(result.metrics.accuracy * 100).toFixed(1)}%`
                                 : result.metrics?.r2_score 
                                 ? `R²: ${result.metrics.r2_score.toFixed(2)}`
                                 : result.metrics?.silhouette_score
                                 ? `Sil: ${result.metrics.silhouette_score.toFixed(2)}`
                                 : 'Completed'
                               }
                             </Badge>
                             <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                               <Button
                                 size="sm"
                                 variant="ghost"
                                 className="h-6 w-6 p-0"
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   setSelectedResult(result);
                                 }}
                               >
                                 <Eye className="h-3 w-3" />
                               </Button>
                               <Button
                                 size="sm"
                                 variant="ghost"
                                 className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   handleDeleteResult(result.id);
                                 }}
                               >
                                 <Trash2 className="h-3 w-3" />
                               </Button>
                             </div>
                           </div>
                         </div>
                         <p className="text-xs text-muted-foreground mb-3">
                           {result.dataset_name} • {new Date(result.created_at).toLocaleDateString()}
                         </p>
                         
                         {/* Show specific predictions if available */}
                         {result.results?.specific_predictions && result.results.specific_predictions.length > 0 && (
                           <div className="bg-accent/10 rounded-md p-2 mb-2">
                             <div className="text-xs font-medium mb-1">Key Predictions:</div>
                             <div className="text-xs text-muted-foreground">
                               {result.results.specific_predictions.slice(0, 2).map((prediction: string, idx: number) => (
                                 <div key={idx} className="truncate">• {prediction}</div>
                               ))}
                               {result.results.specific_predictions.length > 2 && (
                                 <div className="text-xs opacity-75">
                                   +{result.results.specific_predictions.length - 2} more predictions
                                 </div>
                               )}
                             </div>
                           </div>
                         )}
                         
                         {/* Show metrics summary */}
                         <div className="grid grid-cols-2 gap-2 text-xs">
                           {result.metrics?.accuracy && (
                             <div>
                               <span className="text-muted-foreground">Accuracy:</span>
                               <span className="ml-1 font-medium">{(result.metrics.accuracy * 100).toFixed(1)}%</span>
                             </div>
                           )}
                           {result.metrics?.f1_score && (
                             <div>
                               <span className="text-muted-foreground">F1:</span>
                               <span className="ml-1 font-medium">{result.metrics.f1_score.toFixed(3)}</span>
                             </div>
                           )}
                           {result.metrics?.r2_score && (
                             <div>
                               <span className="text-muted-foreground">R²:</span>
                               <span className="ml-1 font-medium">{result.metrics.r2_score.toFixed(3)}</span>
                             </div>
                           )}
                           {result.metrics?.rmse && (
                             <div>
                               <span className="text-muted-foreground">RMSE:</span>
                               <span className="ml-1 font-medium">{result.metrics.rmse.toFixed(1)}</span>
                             </div>
                           )}
                         </div>
                       </div>
                     ))}
                   </div>
                 )}
                 
                  {/* Selected Result Modal/Detailed View */}
                  {selectedResult && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                      <div className="bg-background rounded-lg p-6 max-w-5xl max-h-[80vh] overflow-y-auto w-full mx-4">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="text-lg font-semibold">{selectedResult.problem_subtype} Model Results</h3>
                            <p className="text-sm text-muted-foreground">
                              {selectedResult.dataset_name} • {new Date(selectedResult.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <Button variant="ghost" onClick={() => setSelectedResult(null)}>
                            ×
                          </Button>
                        </div>
                        
                        {/* Full Results Display with Tabs */}
                        <Tabs defaultValue="summary" className="w-full">
                          <TabsList className="grid w-full grid-cols-5">
                            <TabsTrigger value="summary">Summary</TabsTrigger>
                            <TabsTrigger value="metrics">Metrics</TabsTrigger>
                            <TabsTrigger value="charts">Charts</TabsTrigger>
                            <TabsTrigger value="insights">Insights</TabsTrigger>
                            <TabsTrigger value="details">Details</TabsTrigger>
                          </TabsList>

                          <TabsContent value="summary" className="space-y-4">
                            {/* Key Metrics Summary */}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                              {Object.entries(selectedResult.metrics || {}).slice(0, 3).map(([key, value]) => (
                                <div key={key} className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-4 border border-primary/20">
                                  <div className="text-sm text-muted-foreground capitalize">
                                    {key.replace(/_/g, ' ')}
                                  </div>
                                  <div className="text-xl font-bold">
                                    {typeof value === 'number' 
                                      ? (key.includes('accuracy') || key.includes('score') 
                                        ? (value * 100).toFixed(1) + '%' 
                                        : value.toFixed(3))
                                      : String(value)
                                    }
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* AI Insights Summary */}
                            {selectedResult.results?.ai_insights?.key_insights && (
                              <div className="bg-accent/10 rounded-lg p-4">
                                <h4 className="font-medium mb-3">Key Insights</h4>
                                <div className="space-y-2">
                                  {selectedResult.results.ai_insights.key_insights.slice(0, 3).map((insight: string, idx: number) => (
                                    <div key={idx} className="text-sm flex items-start">
                                      <div className="w-2 h-2 rounded-full bg-accent mt-2 mr-3 flex-shrink-0" />
                                      {insight}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </TabsContent>

                          <TabsContent value="metrics" className="space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                              {Object.entries(selectedResult.metrics || {}).map(([key, value]) => (
                                <div key={key} className="bg-muted/30 rounded-lg p-3">
                                  <div className="text-sm text-muted-foreground capitalize">
                                    {key.replace(/_/g, ' ')}
                                  </div>
                                  <div className="text-xl font-bold">
                                    {typeof value === 'number' 
                                      ? (key.includes('accuracy') || key.includes('score') 
                                        ? (value * 100).toFixed(1) + '%' 
                                        : value.toFixed(3))
                                      : String(value)
                                    }
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Feature Importance */}
                            {selectedResult.results?.feature_importance && (
                              <div className="bg-muted/20 rounded-lg p-4">
                                <h4 className="font-medium mb-3">Feature Importance</h4>
                                <div className="space-y-3">
                                  {selectedResult.results.feature_importance.slice(0, 8).map((feature: any, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between">
                                      <span className="text-sm font-medium">{feature.feature}</span>
                                      <div className="flex items-center space-x-2">
                                        <div className="w-32 bg-muted rounded-full h-2 overflow-hidden">
                                          <div 
                                            className="h-full bg-primary transition-all"
                                            style={{ width: `${feature.importance * 100}%` }}
                                          />
                                        </div>
                                        <span className="text-sm text-muted-foreground w-12 text-right">
                                          {(feature.importance * 100).toFixed(0)}%
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </TabsContent>

                          <TabsContent value="charts" className="space-y-4">
                            <MLVisualization 
                              results={selectedResult.results} 
                              problemType={selectedResult.problem_type} 
                            />
                          </TabsContent>

                          <TabsContent value="insights" className="space-y-4">
                            {selectedResult.results?.ai_insights ? (
                              <div className="space-y-6">
                                {selectedResult.results.ai_insights.key_insights && (
                                  <div className="bg-accent/10 rounded-lg p-4">
                                    <h4 className="font-medium mb-3">Key Insights</h4>
                                    <div className="space-y-2">
                                      {selectedResult.results.ai_insights.key_insights.map((insight: string, idx: number) => (
                                        <div key={idx} className="text-sm flex items-start">
                                          <div className="w-2 h-2 rounded-full bg-accent mt-2 mr-3 flex-shrink-0" />
                                          {insight}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {selectedResult.results.ai_insights.business_recommendations && (
                                  <div className="bg-primary/10 rounded-lg p-4">
                                    <h4 className="font-medium mb-3">Business Recommendations</h4>
                                    <div className="space-y-2">
                                      {selectedResult.results.ai_insights.business_recommendations.map((rec: string, idx: number) => (
                                        <div key={idx} className="text-sm flex items-start">
                                          <CheckCircle className="w-4 h-4 mr-3 mt-0.5 text-primary flex-shrink-0" />
                                          {rec}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {selectedResult.results.ai_insights.risk_factors && (
                                  <div className="bg-destructive/10 rounded-lg p-4">
                                    <h4 className="font-medium mb-3">Risk Factors</h4>
                                    <div className="space-y-2">
                                      {selectedResult.results.ai_insights.risk_factors.map((risk: string, idx: number) => (
                                        <div key={idx} className="text-sm flex items-start">
                                          <AlertTriangle className="w-4 h-4 mr-3 mt-0.5 text-destructive flex-shrink-0" />
                                          {risk}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {selectedResult.results.ai_insights.opportunities && (
                                  <div className="bg-success/10 rounded-lg p-4">
                                    <h4 className="font-medium mb-3">Opportunities</h4>
                                    <div className="space-y-2">
                                      {selectedResult.results.ai_insights.opportunities.map((opp: string, idx: number) => (
                                        <div key={idx} className="text-sm flex items-start">
                                          <TrendingUp className="w-4 h-4 mr-3 mt-0.5 text-success flex-shrink-0" />
                                          {opp}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-center py-8 text-muted-foreground">
                                <Lightbulb className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                <p>No AI insights available</p>
                              </div>
                            )}
                          </TabsContent>

                          <TabsContent value="details" className="space-y-4">
                            {/* Model Configuration */}
                            <div className="bg-muted/20 rounded-lg p-4">
                              <h4 className="font-medium mb-3">Model Configuration</h4>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Problem Type:</span>
                                  <div className="font-medium capitalize">{selectedResult.problem_type}</div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Problem Subtype:</span>
                                  <div className="font-medium">{selectedResult.problem_subtype}</div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Dataset:</span>
                                  <div className="font-medium">{selectedResult.dataset_name}</div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Created:</span>
                                  <div className="font-medium">{new Date(selectedResult.created_at).toLocaleDateString()}</div>
                                </div>
                              </div>
                            </div>

                            {/* Predictions */}
                            {selectedResult.results?.predictions && (
                              <div className="bg-muted/20 rounded-lg p-4">
                                <h4 className="font-medium mb-3">Sample Predictions</h4>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                  {selectedResult.results.predictions.slice(0, 20).map((pred: any, idx: number) => (
                                    <div key={idx} className="text-sm bg-background rounded p-2">
                                      Sample {idx + 1}: {typeof pred === 'number' ? pred.toFixed(3) : String(pred)}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Raw Data */}
                            <div className="bg-muted/20 rounded-lg p-4">
                              <h4 className="font-medium mb-3">Raw Results</h4>
                              <pre className="text-xs bg-background rounded p-3 overflow-auto max-h-64">
                                {JSON.stringify(selectedResult.results, null, 2)}
                              </pre>
                            </div>
                          </TabsContent>
                        </Tabs>
                      </div>
                    </div>
                  )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default MLStudio;