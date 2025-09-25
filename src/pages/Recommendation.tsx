import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Users, Database, Play, Clock, CheckCircle, AlertCircle, User, Star } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter } from "recharts";

interface Dataset {
  id: string;
  name: string;
  original_filename: string;
  file_type: string;
  row_count: number;
  column_count: number;
  data_profile: any;
}

interface RecommendationModel {
  id: string;
  name: string;
  status: string;
  results: any;
  metrics: any;
  training_progress: number;
  created_at: string;
  configuration: any;
}

const Recommendation = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [models, setModels] = useState<RecommendationModel[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string>("");
  const [modelName, setModelName] = useState("");
  const [userColumn, setUserColumn] = useState("");
  const [itemColumn, setItemColumn] = useState("");
  const [ratingColumn, setRatingColumn] = useState("");
  const [topK, setTopK] = useState(10);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedModel, setSelectedModel] = useState<RecommendationModel | null>(null);
  const [activeTab, setActiveTab] = useState("summary");

  useEffect(() => {
    fetchDatasets();
    fetchModels();
  }, []);

  const fetchDatasets = async () => {
    const { data, error } = await supabase
      .from('datasets')
      .select('*')
      .eq('user_id', user?.id)
      .eq('status', 'processed');

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch datasets",
        variant: "destructive",
      });
      return;
    }

    setDatasets(data || []);
  };

  const fetchModels = async () => {
    const { data, error } = await supabase
      .from('ml_models')
      .select('*')
      .eq('user_id', user?.id)
      .eq('problem_type', 'recommendation')
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch recommendation models",
        variant: "destructive",
      });
      return;
    }

    setModels(data || []);
  };

  const getAvailableColumns = (datasetId: string) => {
    const dataset = datasets.find(d => d.id === datasetId);
    if (!dataset?.data_profile?.columns) return [];
    
    return Object.keys(dataset.data_profile.columns);
  };

  const getNumericColumns = (datasetId: string) => {
    const dataset = datasets.find(d => d.id === datasetId);
    if (!dataset?.data_profile?.columns) return [];
    
    return Object.keys(dataset.data_profile.columns).filter(col => {
      const colInfo = dataset.data_profile.columns[col];
      return colInfo.type === 'numeric';
    });
  };

  const createRecommendationModel = async () => {
    if (!modelName || !selectedDataset || !userColumn || !itemColumn || !ratingColumn) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);

    try {
      const { data: modelData, error: modelError } = await supabase
        .from('ml_models')
        .insert({
          name: modelName,
          user_id: user?.id,
          dataset_id: selectedDataset,
          problem_type: 'recommendation',
          problem_subtype: 'collaborative_filtering',
          configuration: {
            user_column: userColumn,
            item_column: itemColumn,
            rating_column: ratingColumn,
            top_k: topK,
          },
          status: 'created'
        })
        .select()
        .single();

      if (modelError) throw modelError;

      // Start ML processing
      await supabase.functions.invoke('process-recommendation-model', {
        body: { model_id: modelData.id }
      });

      toast({
        title: "Success",
        description: "Recommendation model created and training started",
      });

      setModelName("");
      setSelectedDataset("");
      setUserColumn("");
      setItemColumn("");
      setRatingColumn("");
      setTopK(10);
      fetchModels();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create recommendation model",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'processing':
        return <Clock className="w-4 h-4 text-warning animate-spin" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const renderModelResults = () => {
    if (!selectedModel || selectedModel.status !== 'completed' || !selectedModel.results) {
      return (
        <Alert>
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            Select a completed model to view results
          </AlertDescription>
        </Alert>
      );
    }

    const results = selectedModel.results;
    const metrics = selectedModel.metrics || {};

    return (
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Precision@K</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics.precision_at_k?.toFixed(4) || 'N/A'}
                </div>
                <p className="text-xs text-muted-foreground">Recommendation Precision</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Recall@K</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics.recall_at_k?.toFixed(4) || 'N/A'}
                </div>
                <p className="text-xs text-muted-foreground">Recommendation Recall</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Coverage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics.coverage?.toFixed(4) || 'N/A'}
                </div>
                <p className="text-xs text-muted-foreground">Item Coverage</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {results.total_users?.toLocaleString() || 'N/A'}
                </div>
                <p className="text-xs text-muted-foreground">Unique users in dataset</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Total Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {results.total_items?.toLocaleString() || 'N/A'}
                </div>
                <p className="text-xs text-muted-foreground">Unique items in dataset</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(metrics).map(([key, value]) => (
              <div key={key} className="flex justify-between items-center p-3 bg-secondary/20 rounded-lg">
                <span className="text-sm font-medium capitalize">{key.replace('_', ' ')}</span>
                <span className="text-sm font-mono">
                  {typeof value === 'number' ? value.toFixed(4) : String(value)}
                </span>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          {results.sample_recommendations && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Top Item Recommendations</CardTitle>
                  <CardDescription>Most recommended items across all users</CardDescription>
                </CardHeader>
                <CardContent>
                  {results.popular_items && (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={results.popular_items}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="item" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" fill="hsl(var(--primary))" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Sample User Recommendations</CardTitle>
                  <CardDescription>Example recommendations for sample users</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {results.sample_recommendations.slice(0, 5).map((rec: any, index: number) => (
                      <div key={index} className="p-4 bg-secondary/10 rounded-lg">
                        <div className="flex items-center mb-2">
                          <User className="w-4 h-4 mr-2" />
                          <span className="font-medium">User: {rec.user}</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                          {rec.recommendations?.slice(0, 5).map((item: any, itemIndex: number) => (
                            <div key={itemIndex} className="flex items-center p-2 bg-background rounded border">
                              <Star className="w-3 h-3 mr-1 text-warning" />
                              <span className="text-sm truncate">{item.item}</span>
                              <span className="text-xs text-muted-foreground ml-1">
                                ({item.score?.toFixed(2)})
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          {results.insights ? (
            <Card>
              <CardHeader>
                <CardTitle>AI-Generated Insights</CardTitle>
                <CardDescription>Business insights from your recommendation model</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none text-foreground">
                  {results.insights.split('\n').map((line: string, index: number) => (
                    <p key={index} className="mb-2">{line}</p>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Alert>
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>No insights available for this model</AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Model Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">User Column:</span>
                  <span className="text-sm">{selectedModel.configuration?.user_column}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Item Column:</span>
                  <span className="text-sm">{selectedModel.configuration?.item_column}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Rating Column:</span>
                  <span className="text-sm">{selectedModel.configuration?.rating_column}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Top-K:</span>
                  <span className="text-sm">{selectedModel.configuration?.top_k}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Created:</span>
                  <span className="text-sm">{new Date(selectedModel.created_at).toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    );
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mr-4">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">Recommendation AI</h1>
                <p className="text-muted-foreground">Intelligent recommendation systems with collaborative filtering</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Create Model */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Play className="w-5 h-5 mr-2" />
                  Create Recommendation Model
                </CardTitle>
                <CardDescription>
                  Set up a new collaborative filtering recommendation system
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="model-name">Model Name</Label>
                  <Input
                    id="model-name"
                    placeholder="Enter model name"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dataset">Dataset</Label>
                  <Select value={selectedDataset} onValueChange={setSelectedDataset}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select dataset" />
                    </SelectTrigger>
                    <SelectContent>
                      {datasets.map((dataset) => (
                        <SelectItem key={dataset.id} value={dataset.id}>
                          <div className="flex items-center">
                            <Database className="w-4 h-4 mr-2" />
                            {dataset.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedDataset && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="user-column">User Column</Label>
                      <Select value={userColumn} onValueChange={setUserColumn}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select user column" />
                        </SelectTrigger>
                        <SelectContent>
                          {getAvailableColumns(selectedDataset).map((column) => (
                            <SelectItem key={column} value={column}>
                              <div className="flex items-center">
                                <User className="w-4 h-4 mr-2" />
                                {column}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="item-column">Item Column</Label>
                      <Select value={itemColumn} onValueChange={setItemColumn}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select item column" />
                        </SelectTrigger>
                        <SelectContent>
                          {getAvailableColumns(selectedDataset).map((column) => (
                            <SelectItem key={column} value={column}>
                              {column}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="rating-column">Rating Column</Label>
                      <Select value={ratingColumn} onValueChange={setRatingColumn}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select rating column" />
                        </SelectTrigger>
                        <SelectContent>
                          {getNumericColumns(selectedDataset).map((column) => (
                            <SelectItem key={column} value={column}>
                              <div className="flex items-center">
                                <Star className="w-4 h-4 mr-2" />
                                {column}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="top-k">Top-K Recommendations</Label>
                      <Input
                        id="top-k"
                        type="number"
                        min="1"
                        max="50"
                        value={topK}
                        onChange={(e) => setTopK(parseInt(e.target.value) || 10)}
                      />
                    </div>
                  </>
                )}

                <Button 
                  onClick={createRecommendationModel} 
                  disabled={isCreating || !modelName || !selectedDataset || !userColumn || !itemColumn || !ratingColumn}
                  className="w-full"
                >
                  {isCreating ? (
                    <>
                      <Clock className="w-4 h-4 mr-2 animate-spin" />
                      Creating Model...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Create Recommendation Model
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Models List & Results */}
            <div className="lg:col-span-2 space-y-6">
              {/* Models List */}
              <Card>
                <CardHeader>
                  <CardTitle>Your Recommendation Models</CardTitle>
                  <CardDescription>Select a model to view detailed results</CardDescription>
                </CardHeader>
                <CardContent>
                  {models.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No recommendation models yet. Create your first model to get started.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {models.map((model) => (
                        <div
                          key={model.id}
                          className={cn(
                            "p-4 rounded-lg border cursor-pointer transition-smooth hover:bg-secondary/20",
                            selectedModel?.id === model.id ? "border-primary bg-primary/5" : "border-border"
                          )}
                          onClick={() => setSelectedModel(model)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-medium">{model.name}</h3>
                              <p className="text-sm text-muted-foreground">
                                Created {new Date(model.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex items-center space-x-2">
                              {getStatusIcon(model.status)}
                              <span className="text-sm capitalize">{model.status}</span>
                              {model.status === 'processing' && (
                                <Progress value={model.training_progress || 0} className="w-20" />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Results */}
              {selectedModel && (
                <Card>
                  <CardHeader>
                    <CardTitle>Model Results: {selectedModel.name}</CardTitle>
                    <CardDescription>
                      Detailed recommendation analysis and insights
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {renderModelResults()}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Recommendation;