import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, BarChart3, Download, Loader2 } from "lucide-react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

type ChartType = 'bar' | 'line' | 'pie' | 'scatter';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--destructive))'];

const ChartBuilder = () => {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [columns, setColumns] = useState<string[]>([]);
  const [numericColumns, setNumericColumns] = useState<string[]>([]);
  const [xColumn, setXColumn] = useState<string>("");
  const [yColumn, setYColumn] = useState<string>("");
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [chartData, setChartData] = useState<any[]>([]);
  const [datasetId, setDatasetId] = useState<string>("");

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV file",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session");

      const response = await supabase.functions.invoke('upload-dataset', {
        body: formData,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) throw response.error;

      const dataset = response.data;
      setDatasetId(dataset.id);
      
      if (dataset.data_profile?.columns) {
        // Handle both old array format and new object format
        let columnsList: string[] = [];
        let numericColumnsList: string[] = [];

        if (Array.isArray(dataset.data_profile.columns)) {
          // Old format: columns is an array
          columnsList = dataset.data_profile.columns.map((c: any) => c.name);
          numericColumnsList = dataset.data_profile.columns
            .filter((c: any) => c.type === 'number')
            .map((c: any) => c.name);
        } else {
          // New format: columns is an object
          const columnsObj = dataset.data_profile.columns;
          columnsList = Object.keys(columnsObj);
          numericColumnsList = Object.keys(columnsObj).filter(
            (key) => columnsObj[key].type === 'numeric' || columnsObj[key].type === 'number'
          );
        }
        
        setColumns(columnsList);
        setNumericColumns(numericColumnsList);

        if (numericColumnsList.length === 0) {
          toast({
            title: "No numeric columns found",
            description: "No numeric columns found for chart generation.",
            variant: "destructive",
          });
        }
      }

      toast({
        title: "Upload successful",
        description: "Dataset uploaded and analyzed successfully",
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload dataset",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const generateChart = async () => {
    if (!xColumn || !yColumn || !datasetId) {
      toast({
        title: "Missing selection",
        description: "Please select both X and Y axis columns",
        variant: "destructive",
      });
      return;
    }

    if (!numericColumns.includes(yColumn) && chartType !== 'pie') {
      toast({
        title: "Invalid Y-axis column",
        description: "Y-axis must be numeric for this chart type",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    setChartData([]); // Clear previous chart
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session");

      console.log('Generating chart with:', { datasetId, xColumn, yColumn, chartType });

      const response = await supabase.functions.invoke('generate-chart-data', {
        body: {
          datasetId,
          xColumn,
          yColumn,
          chartType,
        },
      });

      console.log('Chart generation response:', response);

      if (response.error) {
        console.error('Chart generation error:', response.error);
        throw new Error(response.error.message || 'Failed to generate chart');
      }

      if (!response.data) {
        throw new Error('No data returned from chart generation');
      }

      const { labels, values } = response.data;

      if (!labels || !values || labels.length === 0 || values.length === 0) {
        throw new Error('No data available to visualize');
      }

      // Format data for Recharts
      const formattedData = labels.map((label: string, index: number) => ({
        name: String(label),
        value: Number(values[index]),
      }));

      console.log('Formatted chart data:', formattedData);

      setChartData(formattedData);

      toast({
        title: "Chart generated successfully",
        description: `Created ${chartType} chart with ${formattedData.length} data points`,
      });
    } catch (error: any) {
      console.error('Chart generation error:', error);
      
      let errorMessage = error.message || "Failed to generate chart";
      
      if (errorMessage.includes('non-numeric')) {
        errorMessage = "No numeric values found for selected Y-axis column.";
      }
      
      toast({
        title: "Generation failed",
        description: errorMessage,
        variant: "destructive",
      });
      
      setChartData([]); // Clear chart on error
    } finally {
      setProcessing(false);
    }
  };

  const downloadChart = () => {
    const chartContainer = document.querySelector('.recharts-wrapper');
    if (!chartContainer) return;

    // For download, we'd need html2canvas or similar library
    // For now, just show a message
    toast({
      title: "Download feature",
      description: "Right-click on the chart and select 'Save image as...'",
    });
  };

  const renderChart = () => {
    if (!chartData.length) return null;

    const chartProps = {
      data: chartData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 },
    };

    switch (chartType) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart {...chartProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" fill="hsl(var(--primary))" name={yColumn} />
            </BarChart>
          </ResponsiveContainer>
        );
      case 'line':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart {...chartProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" name={yColumn} />
            </LineChart>
          </ResponsiveContainer>
        );
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={150}
                label
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );
      case 'scatter':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart {...chartProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis dataKey="value" />
              <Tooltip />
              <Legend />
              <Scatter name={yColumn} data={chartData} fill="hsl(var(--primary))" />
            </ScatterChart>
          </ResponsiveContainer>
        );
      default:
        return null;
    }
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Chart Builder</h1>
          <p className="text-muted-foreground">
            Build interactive visualizations from your CSV data
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Configuration Panel */}
          <Card>
            <CardHeader>
              <CardTitle>Data Configuration</CardTitle>
              <CardDescription>Upload your CSV and configure chart settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* File Upload */}
              <div>
                <Label htmlFor="file-upload">Dataset Upload</Label>
                <div className="mt-2">
                  <input
                    id="file-upload"
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    onClick={() => document.getElementById('file-upload')?.click()}
                    disabled={uploading}
                    className="w-full"
                    variant="outline"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload CSV File
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {columns.length > 0 && (
                <>
                  {/* X-axis Selection */}
                  <div>
                    <Label>X-Axis Column</Label>
                    <Select value={xColumn} onValueChange={setXColumn}>
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Select X-axis column" />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map((col) => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Y-axis Selection */}
                  <div>
                    <Label>Y-Axis Column (Numeric)</Label>
                    <Select value={yColumn} onValueChange={setYColumn}>
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Select Y-axis column" />
                      </SelectTrigger>
                      <SelectContent>
                        {numericColumns.map((col) => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Chart Type Selection */}
                  <div>
                    <Label>Chart Type</Label>
                    <Select value={chartType} onValueChange={(value) => setChartType(value as ChartType)}>
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bar">Bar Chart</SelectItem>
                        <SelectItem value="line">Line Chart</SelectItem>
                        <SelectItem value="pie">Pie Chart</SelectItem>
                        <SelectItem value="scatter">Scatter Plot</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Generate Button */}
                  <Button 
                    onClick={generateChart} 
                    disabled={processing || !xColumn || !yColumn}
                    className="w-full"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating chart...
                      </>
                    ) : (
                      <>
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Generate Chart
                      </>
                    )}
                  </Button>

                  {columns.length > 0 && !xColumn && !yColumn && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Select columns above and click "Generate Chart" to visualize your data
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Chart Display */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Chart Visualization</CardTitle>
                  <CardDescription>
                    {chartData.length > 0 
                      ? `Showing ${chartData.length} data points`
                      : "Your generated chart will appear here"}
                  </CardDescription>
                </div>
                {chartData.length > 0 && (
                  <Button onClick={downloadChart} variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {processing ? (
                <div className="w-full h-[400px] flex items-center justify-center">
                  <div className="text-center">
                    <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-primary" />
                    <p className="text-muted-foreground">Generating your chart...</p>
                  </div>
                </div>
              ) : chartData.length > 0 ? (
                <div className="w-full h-[400px]">
                  {renderChart()}
                </div>
              ) : (
                <div className="w-full h-[400px] flex items-center justify-center border-2 border-dashed border-border rounded-lg">
                  <div className="text-center text-muted-foreground">
                    <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p className="font-medium mb-2">No chart to display</p>
                    <p className="text-sm">
                      {columns.length > 0 
                        ? "Select columns and click 'Generate Chart' to create a visualization"
                        : "Upload a CSV file to get started"}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default ChartBuilder;
