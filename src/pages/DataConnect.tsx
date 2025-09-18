import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { 
  Upload, 
  FileText, 
  Database, 
  CheckCircle, 
  AlertCircle,
  FileSpreadsheet,
  FileJson,
  FileCode
} from "lucide-react";
import { cn } from "@/lib/utils";

const DataConnect = () => {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    setIsUploading(true);
    setUploadProgress(0);
    
    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          // Add uploaded file to list
          const newFile = {
            id: Date.now(),
            name: files[0].name,
            size: (files[0].size / 1024 / 1024).toFixed(2) + " MB",
            type: files[0].type,
            status: "processed",
            uploadedAt: new Date().toLocaleString()
          };
          setUploadedFiles(prev => [...prev, newFile]);
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  const getFileIcon = (type: string) => {
    if (type.includes('spreadsheet') || type.includes('excel')) return FileSpreadsheet;
    if (type.includes('json')) return FileJson;
    if (type.includes('text') || type.includes('csv')) return FileText;
    return FileCode;
  };

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
                      multiple
                      accept=".csv,.json,.xlsx,.xls,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="file-upload"
                    />
                    <Label htmlFor="file-upload">
                      <Button variant="outline" className="cursor-pointer">
                        Choose Files
                      </Button>
                    </Label>
                  </div>

                  {/* Upload Progress */}
                  {isUploading && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Uploading...</span>
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
            {uploadedFiles.length > 0 && (
              <Card className="mt-6 shadow-card">
                <CardHeader>
                  <CardTitle>Uploaded Datasets</CardTitle>
                  <CardDescription>
                    Your uploaded files are ready for ML processing
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {uploadedFiles.map((file) => {
                      const IconComponent = getFileIcon(file.type);
                      return (
                        <div key={file.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                          <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                              <IconComponent className="w-5 h-5 text-accent" />
                            </div>
                            <div>
                              <p className="font-medium">{file.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {file.size} • Uploaded {file.uploadedAt}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <CheckCircle className="w-5 h-5 text-success" />
                            <Button variant="outline" size="sm">
                              View Details
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
                  <span className="font-semibold">{uploadedFiles.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Processing Status</span>
                  <span className="text-success font-semibold">Active</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Storage Used</span>
                  <span className="font-semibold">2.4 GB</span>
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
                <Button className="w-full justify-start gradient-primary text-primary-foreground">
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