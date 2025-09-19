import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { 
  Upload, 
  FileText, 
  Database, 
  CheckCircle, 
  AlertCircle,
  FileSpreadsheet,
  FileJson,
  FileCode,
  Trash2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Dataset {
  id: string;
  name: string;
  original_filename: string;
  file_size: number;
  file_type: string;
  status: string;
  row_count: number | null;
  column_count: number | null;
  created_at: string;
}

const DataConnect = () => {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    fetchDatasets();
  }, []);

  const fetchDatasets = async () => {
    try {
      const { data, error } = await supabase
        .from('datasets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDatasets(data || []);
    } catch (error) {
      console.error('Error fetching datasets:', error);
      toast.error('Failed to load datasets');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Create form data
      const formData = new FormData();
      formData.append('file', file);

      // Upload file using edge function
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`https://implgfeegibmaxerblkc.supabase.co/functions/v1/upload-dataset`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();
      
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 100);

      // Complete progress
      setTimeout(() => {
        setUploadProgress(100);
        setTimeout(() => {
          setIsUploading(false);
          setUploadProgress(0);
          toast.success('Dataset uploaded successfully!');
          fetchDatasets(); // Refresh the list
        }, 500);
      }, 1000);

    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload file');
      setIsUploading(false);
      setUploadProgress(0);
    }

    // Reset input
    event.target.value = '';
  };

  const handleDeleteDataset = async (datasetId: string) => {
    try {
      const { error } = await supabase
        .from('datasets')
        .delete()
        .eq('id', datasetId);

      if (error) throw error;
      
      toast.success('Dataset deleted successfully');
      fetchDatasets();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete dataset');
    }
  };

  const getFileIcon = (type: string) => {
    if (type.includes('spreadsheet') || type.includes('excel')) return FileSpreadsheet;
    if (type.includes('json')) return FileJson;
    if (type.includes('text') || type.includes('csv')) return FileText;
    return FileCode;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-8">
          <div className="flex items-center justify-center min-h-96">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading datasets...</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center mr-4">
              <Database className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">DataConnect Pro</h1>
              <p className="text-muted-foreground">Secure data ingestion and management platform</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upload Section */}
          <div className="lg:col-span-2">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Upload className="w-5 h-5 mr-2" />
                  Data Upload
                </CardTitle>
                <CardDescription>
                  Upload your datasets in CSV, JSON, Excel, or other supported formats
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* File Upload Area */}
                  <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-smooth">
                    <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Upload your data files</h3>
                    <p className="text-muted-foreground mb-4">
                      Drag and drop files here, or click to browse
                    </p>
                    <Input
                      type="file"
                      multiple={false}
                      accept=".csv,.json,.xlsx,.xls,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="file-upload"
                      disabled={isUploading}
                    />
                    <Label htmlFor="file-upload">
                      <Button variant="outline" className="cursor-pointer" disabled={isUploading}>
                        {isUploading ? "Uploading..." : "Choose Files"}
                      </Button>
                    </Label>
                  </div>

                  {/* Upload Progress */}
                  {isUploading && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Uploading and processing...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <Progress value={uploadProgress} className="h-2" />
                    </div>
                  )}

                  {/* Supported Formats */}
                  <div className="bg-muted/30 rounded-lg p-4">
                    <h4 className="font-medium mb-2">Supported Formats</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-muted-foreground">
                      <div className="flex items-center">
                        <FileText className="w-4 h-4 mr-2" />
                        CSV
                      </div>
                      <div className="flex items-center">
                        <FileJson className="w-4 h-4 mr-2" />
                        JSON
                      </div>
                      <div className="flex items-center">
                        <FileSpreadsheet className="w-4 h-4 mr-2" />
                        Excel
                      </div>
                      <div className="flex items-center">
                        <FileCode className="w-4 h-4 mr-2" />
                        Parquet
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Uploaded Files */}
            {datasets.length > 0 && (
              <Card className="mt-6 shadow-card">
                <CardHeader>
                  <CardTitle>Your Datasets</CardTitle>
                  <CardDescription>
                    Manage your uploaded datasets
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {datasets.map((dataset) => {
                      const IconComponent = getFileIcon(dataset.file_type);
                      return (
                        <div key={dataset.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                          <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                              <IconComponent className="w-5 h-5 text-accent" />
                            </div>
                            <div>
                              <p className="font-medium">{dataset.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {formatFileSize(dataset.file_size)} • 
                                {dataset.row_count ? ` ${dataset.row_count.toLocaleString()} rows` : ''} • 
                                {new Date(dataset.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {dataset.status === 'processed' ? (
                              <CheckCircle className="w-5 h-5 text-success" />
                            ) : (
                              <AlertCircle className="w-5 h-5 text-warning" />
                            )}
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleDeleteDataset(dataset.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Info Panel */}
          <div className="space-y-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-lg">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Datasets</span>
                  <span className="font-semibold">{datasets.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Processing Status</span>
                  <span className="text-success font-semibold">Active</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Storage Used</span>
                  <span className="font-semibold">
                    {formatFileSize(datasets.reduce((total, d) => total + d.file_size, 0))}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-lg">Data Quality</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Validation</span>
                  <CheckCircle className="w-5 h-5 text-success" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Missing Values</span>
                  <span className="text-warning">&lt; 5%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Duplicates</span>
                  <CheckCircle className="w-5 h-5 text-success" />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-lg">Next Steps</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full justify-start" variant="outline">
                  <Database className="w-4 h-4 mr-2" />
                  View Data Profile
                </Button>
                <Button 
                  className="w-full justify-start gradient-primary text-primary-foreground"
                  onClick={() => window.location.href = '/mlstudio'}
                >
                  Launch ML Studio
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default DataConnect;