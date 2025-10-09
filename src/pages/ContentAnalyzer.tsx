import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileText, Lightbulb, BookOpen } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ContentAnalyzer = () => {
  const { toast } = useToast();
  const [content, setContent] = useState("");
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [analysisType, setAnalysisType] = useState("summarize");

  const analyzeContent = async () => {
    if (!content.trim()) {
      toast({
        title: "Error",
        description: "Please enter some content to analyze",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setResult("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Please sign in to use content analysis");
      }

      const response = await supabase.functions.invoke("analyze-content", {
        body: {
          content: content.trim(),
          analysisType,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to analyze content");
      }

      if (!response.data?.result) {
        throw new Error("No result from AI");
      }

      setResult(response.data.result);
    } catch (error: any) {
      console.error("Analysis error:", error);
      
      let errorMessage = error.message || "Failed to analyze content";
      
      if (errorMessage.includes("Rate limit")) {
        errorMessage = "Too many requests. Please wait a moment and try again.";
      } else if (errorMessage.includes("Payment required")) {
        errorMessage = "AI credits depleted. Please add credits to continue.";
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Content Analyzer</h1>
          <p className="text-muted-foreground">
            Summarize, analyze, or simplify any text content using AI
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Input Content</CardTitle>
              <CardDescription>
                Paste or type the content you want to analyze
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={analysisType} onValueChange={setAnalysisType}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="summarize">
                    <FileText className="w-4 h-4 mr-2" />
                    Summarize
                  </TabsTrigger>
                  <TabsTrigger value="analyze">
                    <Lightbulb className="w-4 h-4 mr-2" />
                    Analyze
                  </TabsTrigger>
                  <TabsTrigger value="simplify">
                    <BookOpen className="w-4 h-4 mr-2" />
                    Simplify
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Paste your content here..."
                className="min-h-[300px] resize-none"
              />

              <Button
                onClick={analyzeContent}
                disabled={!content.trim() || isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    {analysisType === "summarize" && "Summarize"}
                    {analysisType === "analyze" && "Analyze"}
                    {analysisType === "simplify" && "Simplify"}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Result</CardTitle>
              <CardDescription>
                AI-powered {analysisType === "summarize" ? "summary" : analysisType === "analyze" ? "analysis" : "simplified version"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {result ? (
                <div className="prose dark:prose-invert max-w-none">
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="text-sm whitespace-pre-wrap text-black dark:text-white">{result}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  <div className="text-center">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p className="font-medium mb-2">No result yet</p>
                    <p className="text-sm">Enter content and click the button to analyze</p>
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

export default ContentAnalyzer;
