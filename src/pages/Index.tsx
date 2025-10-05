import { Layout } from "@/components/Layout";
import { ServiceCard } from "@/components/ServiceCard";
import { Button } from "@/components/ui/button";
import { 
  Database, 
  Brain, 
  TrendingUp, 
  Users, 
  PieChart,
  BarChart3,
  Sparkles,
  Zap,
  Shield
} from "lucide-react";

const Index = () => {
  return (
    <Layout>
      <div className="p-8">
        {/* Hero Section */}
        <div className="mb-12">
          <div className="gradient-hero rounded-2xl p-8 text-center text-primary-foreground shadow-elegant">
            <div className="max-w-4xl mx-auto">
              <h1 className="text-4xl md:text-5xl font-bold mb-4">
                AutoML Analytics Hub
              </h1>
              <p className="text-xl opacity-90 mb-8">
                Transform your data into intelligent insights with our enterprise-grade AutoML platform. 
                No coding required - just upload, configure, and deploy.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Button size="lg" variant="secondary" className="font-semibold">
                  <Sparkles className="w-5 h-5 mr-2" />
                  Start Your First Model
                </Button>
                <Button size="lg" variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                  View Documentation
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-card rounded-xl p-6 border border-border shadow-card">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-success/10 rounded-xl flex items-center justify-center">
                <Zap className="w-6 h-6 text-success" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-foreground">10x</p>
                <p className="text-muted-foreground">Faster Deployment</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-xl p-6 border border-border shadow-card">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-accent" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-foreground">99.9%</p>
                <p className="text-muted-foreground">Accuracy Rate</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-xl p-6 border border-border shadow-card">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-primary" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-foreground">500+</p>
                <p className="text-muted-foreground">Models Deployed</p>
              </div>
            </div>
          </div>
        </div>

        {/* Services Grid */}
        <div>
          <h2 className="text-3xl font-bold text-foreground mb-2">Platform Services</h2>
          <p className="text-muted-foreground mb-8">
            Choose from our comprehensive suite of ML services designed for enterprise needs
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ServiceCard
              title="DataConnect Pro"
              description="Secure data ingestion and management platform with enterprise-grade security"
              icon={Database}
              href="/dataconnect"
              gradient={true}
              features={[
                "Multi-format data support",
                "Real-time data validation",
                "Automated data profiling"
              ]}
            />
            
            <ServiceCard
              title="ML Studio"
              description="Visual model builder with automated feature engineering and hyperparameter tuning"
              icon={Brain}
              href="/mlstudio"
              features={[
                "Drag-and-drop interface",
                "Auto feature selection",
                "Model comparison tools"
              ]}
            />
            
            <ServiceCard
              title="Chart Builder"
              description="Build interactive visualizations from your CSV data instantly"
              icon={PieChart}
              href="/chartbuilder"
              gradient={true}
              features={[
                "Multiple chart types",
                "Interactive controls",
                "Export as image"
              ]}
            />
            
            <ServiceCard
              title="Smart Segmentation"
              description="Customer segmentation and clustering with behavioral analysis"
              icon={BarChart3}
              href="/segmentation"
              status="coming-soon"
              features={[
                "Dynamic clustering",
                "Segment profiling",
                "Export capabilities"
              ]}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Index;
