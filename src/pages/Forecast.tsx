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
import { MLVisualization } from "@/components/MLVisualization";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, Database, Play, Clock, CheckCircle, AlertCircle, Calendar } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface Dataset {
  id: string;
  name: string;
  original_filename: string;
  file_type: string;
  row_count: number;
  column_count: number;
  data_profile: any;
}

interface ForecastModel {
  id: string;
  name: string;
  status: string;
  results: any;
  metrics: any;
  training_progress: number;
  created_at: string;
  configuration: any;
}

const Forecast = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [models, setModels] = useState<ForecastModel[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string>("");
  const [modelName, setModelName] = useState("");
  const [targetColumn, setTargetColumn] = useState("");
  const [dateColumn, setDateColumn] = useState("");
  const [forecastHorizon, setForecastHorizon] = useState(30);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ForecastModel | null>(null);
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
      .eq('problem_type', 'forecast')
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch forecast models",
        variant: "destructive",
      });
      return;
    }

    setModels(data || []);
  };

  const getAvailableColumns = (datasetId: string) => {
    const dataset = datasets.find(d => d.id === datasetId);
    if (!dataset?.data_profile?.columns) return [];
    
    return Object.keys(dataset.data_profile.columns).filter(col => {
      const colInfo = dataset.data_profile.columns[col];
      return colInfo.type === 'numeric' || colInfo.type === 'date';
    });
  };

  const getDateColumns = (datasetId: string) => {
    const dataset = datasets.find(d => d.id === datasetId);
    if (!dataset?.data_profile?.columns) return [];
    
    return Object.keys(dataset.data_profile.columns).filter(col => {
      const colInfo = dataset.data_profile.columns[col];
      return colInfo.type === 'date' || colInfo.name.toLowerCase().includes('date') || 
             colInfo.name.toLowerCase().includes('time');
    });
  };

  const createForecastModel = async () => {
    if (!modelName || !selectedDataset || !targetColumn || !dateColumn) {
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
          problem_type: 'forecast',
          problem_subtype: 'time_series',
          configuration: {
            target_column: targetColumn,
            date_column: dateColumn,
            forecast_horizon: forecastHorizon,
          },
          status: 'created'
        })
        .select()
        .single();

      if (modelError) throw modelError;

      // Start ML processing
      await supabase.functions.invoke('process-forecast-model', {
        body: { model_id: modelData.id }
      });

      toast({
        title: "Success",
        description: "Forecast model created and training started",
      });

      setModelName("");
      setSelectedDataset("");
      setTargetColumn("");
      setDateColumn("");
      setForecastHorizon(30);
      fetchModels();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create forecast model",
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
          <TabsTrigger value="forecast">Forecast</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">MAE</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics.mae?.toFixed(4) || 'N/A'}
                </div>
                <p className="text-xs text-muted-foreground">Mean Absolute Error</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">RMSE</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics.rmse?.toFixed(4) || 'N/A'}
                </div>
                <p className="text-xs text-muted-foreground">Root Mean Square Error</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">R² Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics.r2_score?.toFixed(4) || 'N/A'}
                </div>
                <p className="text-xs text-muted-foreground">Coefficient of Determination</p>
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

        <TabsContent value="forecast" className="space-y-4">
          {results.forecast_data && (
            <Card>
              <CardHeader>
                <CardTitle>Forecast Visualization</CardTitle>
                <CardDescription>Time series forecast with confidence intervals</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={results.forecast_data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="actual" stroke="hsl(var(--primary))" strokeWidth={2} />
                    <Line type="monotone" dataKey="forecast" stroke="hsl(var(--accent))" strokeWidth={2} strokeDasharray="5 5" />
                    {results.forecast_data[0]?.upper_bound && (
                      <Line type="monotone" dataKey="upper_bound" stroke="hsl(var(--muted-foreground))" strokeWidth={1} />
                    )}
                    {results.forecast_data[0]?.lower_bound && (
                      <Line type="monotone" dataKey="lower_bound" stroke="hsl(var(--muted-foreground))" strokeWidth={1} />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          {results.insights ? (
            <Card>
              <CardHeader>
                <CardTitle>AI-Generated Insights</CardTitle>
                <CardDescription>Business insights from your forecast model</CardDescription>
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
                  <span className="text-sm font-medium">Target Column:</span>
                  <span className="text-sm">{selectedModel.configuration?.target_column}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Date Column:</span>
                  <span className="text-sm">{selectedModel.configuration?.date_column}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Forecast Horizon:</span>
                  <span className="text-sm">{selectedModel.configuration?.forecast_horizon} periods</span>
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
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">Forecast Engine</h1>
                <p className="text-muted-foreground">Advanced time series forecasting with AI insights</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Create Model */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Play className="w-5 h-5 mr-2" />
                  Create Forecast Model
                </CardTitle>
                <CardDescription>
                  Set up a new time series forecasting model
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
                      <Label htmlFor="date-column">Date Column</Label>
                      <Select value={dateColumn} onValueChange={setDateColumn}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select date column" />
                        </SelectTrigger>
                        <SelectContent>
                          {getDateColumns(selectedDataset).map((column) => (
                            <SelectItem key={column} value={column}>
                              <div className="flex items-center">
                                <Calendar className="w-4 h-4 mr-2" />
                                {column}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="target-column">Target Column</Label>
                      <Select value={targetColumn} onValueChange={setTargetColumn}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select target column" />
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
                      <Label htmlFor="forecast-horizon">Forecast Horizon (periods)</Label>
                      <Input
                        id="forecast-horizon"
                        type="number"
                        min="1"
                        max="365"
                        value={forecastHorizon}
                        onChange={(e) => setForecastHorizon(parseInt(e.target.value) || 30)}
                      />
                    </div>
                  </>
                )}

                <Button 
                  onClick={createForecastModel} 
                  disabled={isCreating || !modelName || !selectedDataset || !targetColumn || !dateColumn}
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
                      Create Forecast Model
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
                  <CardTitle>Your Forecast Models</CardTitle>
                  <CardDescription>Select a model to view detailed results</CardDescription>
                </CardHeader>
                <CardContent>
                  {models.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No forecast models yet. Create your first model to get started.</p>
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
                      Detailed forecast analysis and insights
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

export default Forecast;