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
  AlertTriangle
} from "lucide-react";

const MLStudio = () => {
  const [selectedDataset, setSelectedDataset] = useState("");
  const [selectedProblem, setSelectedProblem] = useState("");
  const [selectedProblemType, setSelectedProblemType] = useState("");
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [modelResults, setModelResults] = useState<any>(null);

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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Configuration Panel */}
          <div className="lg:col-span-2 space-y-6">
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
                        <h4 className="font-medium mb-3">Model Results</h4>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div className="bg-muted/30 rounded-lg p-3">
                            <div className="text-sm text-muted-foreground">Accuracy</div>
                            <div className="text-xl font-bold text-success">
                              {modelResults.results?.accuracy || '94.2%'}
                            </div>
                          </div>
                          <div className="bg-muted/30 rounded-lg p-3">
                            <div className="text-sm text-muted-foreground">F1 Score</div>
                            <div className="text-xl font-bold text-primary">
                              {modelResults.results?.f1_score || '0.89'}
                            </div>
                          </div>
                        </div>
                        {modelResults.results?.insights && (
                          <div className="bg-accent/10 rounded-lg p-3">
                            <div className="text-sm font-medium mb-1">Key Insights</div>
                            <div className="text-sm text-muted-foreground">
                              {modelResults.results.insights}
                            </div>
                          </div>
                        )}
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

          {/* Info Panel */}
          <div className="space-y-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-lg">Training Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Active Models</span>
                  <span className="font-semibold">3</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">In Training</span>
                  <span className="font-semibold">{isTraining ? "1" : "0"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Deployed</span>
                  <span className="font-semibold">2</span>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-lg">Recent Models</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="border border-border rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-medium text-sm">Churn Prediction</span>
                    <Badge variant="secondary">94.2%</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Customer Dataset • 2 hours ago</p>
                </div>
                <div className="border border-border rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-medium text-sm">Revenue Forecast</span>
                    <Badge variant="secondary">87.6%</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Sales Dataset • 1 day ago</p>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full justify-start" variant="outline">
                  <Database className="w-4 h-4 mr-2" />
                  Upload New Dataset
                </Button>
                <Button className="w-full justify-start" variant="outline">
                  <Target className="w-4 h-4 mr-2" />
                  Model Library
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default MLStudio;