import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Brain, Eye, EyeOff, AlertCircle, Database, MessageSquare, FileText, Zap, Shield, BarChart3, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";

const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // Form states
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [signupData, setSignupData] = useState({ 
    email: "", 
    password: "", 
    fullName: "", 
    company: "" 
  });

  useEffect(() => {
    // Check if user is already logged in
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/");
      }
    };
    checkSession();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginData.email,
        password: loginData.password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          setError("Invalid email or password. Please check your credentials and try again.");
        } else if (error.message.includes("Email not confirmed")) {
          setError("Please check your email and click the confirmation link before signing in.");
        } else {
          setError(error.message);
        }
        return;
      }

      toast.success("Welcome back!");
      navigate("/");
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (signupData.password.length < 6) {
      setError("Password must be at least 6 characters long.");
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signUp({
        email: signupData.email,
        password: signupData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: signupData.fullName,
            company: signupData.company,
          },
        },
      });

      if (error) {
        if (error.message.includes("User already registered")) {
          setError("An account with this email already exists. Please sign in instead.");
        } else {
          setError(error.message);
        }
        return;
      }

      toast.success("Account created successfully! You can now sign in.");
      // Switch to login tab
      const loginTab = document.querySelector('[data-state="active"]') as HTMLElement;
      if (loginTab) {
        const loginTrigger = document.querySelector('[value="login"]') as HTMLElement;
        loginTrigger?.click();
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const services = [
    {
      icon: Database,
      title: "DataConnect Pro",
      description: "Secure data ingestion with enterprise-grade security"
    },
    {
      icon: Brain,
      title: "ML Studio",
      description: "Visual model builder with automated tuning"
    },
    {
      icon: MessageSquare,
      title: "AI Chatbot",
      description: "Conversations powered by advanced AI models"
    },
    {
      icon: FileText,
      title: "Content Analyzer",
      description: "AI-powered text summarization and analysis"
    }
  ];

  const features = [
    { icon: Zap, text: "10x Faster Deployment" },
    { icon: Shield, text: "Enterprise Security" },
    { icon: BarChart3, text: "Advanced Analytics" },
    { icon: CheckCircle, text: "No Code Required" }
  ];

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Theme Toggle Header */}
      <div className="fixed top-6 right-6 z-50 animate-fade-in">
        <ThemeToggle />
      </div>

      {/* Animated Background Elements */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }} />
      </div>

      {/* Hero Section */}
      <div className="gradient-hero py-20 px-8 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center space-x-3 mb-8 animate-scale-in">
              <div className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/20 shadow-glow transition-smooth hover:scale-110">
                <Brain className="w-12 h-12 text-white" />
              </div>
              <div className="text-left">
                <h1 className="text-4xl font-bold text-white">AutoML Analytics Hub</h1>
                <p className="text-white/80 text-lg">Enterprise Platform</p>
              </div>
            </div>
            <h2 className="text-5xl md:text-6xl font-bold text-white mb-6 animate-fade-in">
              Transform Data into <span className="bg-gradient-to-r from-white to-accent-glow bg-clip-text text-transparent">Intelligent Insights</span>
            </h2>
            <p className="text-xl text-white/90 max-w-3xl mx-auto animate-fade-in" style={{ animationDelay: '0.2s' }}>
              Enterprise-grade AutoML platform powered by cutting-edge AI. 
              No coding required - just upload, configure, and deploy your models.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
            {features.map((feature, index) => (
              <div 
                key={index} 
                className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6 text-center transition-smooth hover:bg-white/20 hover:scale-105 hover:shadow-glow animate-fade-in"
                style={{ animationDelay: `${0.3 + index * 0.1}s` }}
              >
                <feature.icon className="w-10 h-10 text-white mx-auto mb-3" />
                <p className="text-white font-medium">{feature.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Auth Section */}
      <div className="py-20 px-8 relative">
        <div className="max-w-md mx-auto">
          <Card className="shadow-elegant border-border/50 backdrop-blur-sm bg-card/80 animate-scale-in">
            <CardHeader className="text-center space-y-2 pb-8">
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Get Started Today
              </CardTitle>
              <CardDescription className="text-base">
                Sign in to your account or create a new one
              </CardDescription>
            </CardHeader>
            <CardContent className="px-8 pb-8">
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-8 p-1 bg-muted/50">
                  <TabsTrigger value="login" className="transition-smooth data-[state=active]:shadow-md">Sign In</TabsTrigger>
                  <TabsTrigger value="signup" className="transition-smooth data-[state=active]:shadow-md">Sign Up</TabsTrigger>
                </TabsList>

                {error && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <TabsContent value="login" className="space-y-6 animate-fade-in">
                  <form onSubmit={handleLogin} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="login-email" className="text-sm font-medium">Email</Label>
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="Enter your email"
                        value={loginData.email}
                        onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                        required
                        className="transition-smooth focus:scale-[1.02]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password" className="text-sm font-medium">Password</Label>
                      <div className="relative">
                        <Input
                          id="login-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter your password"
                          value={loginData.password}
                          onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                          required
                          className="transition-smooth focus:scale-[1.02] pr-12"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent transition-smooth"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full gradient-primary text-primary-foreground shadow-glow hover:shadow-elegant transition-smooth hover:scale-[1.02] font-semibold" 
                      disabled={loading}
                    >
                      {loading ? "Signing in..." : "Sign In"}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup" className="space-y-5 animate-fade-in">
                  <form onSubmit={handleSignup} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name" className="text-sm font-medium">Full Name</Label>
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="Enter your full name"
                        value={signupData.fullName}
                        onChange={(e) => setSignupData({ ...signupData, fullName: e.target.value })}
                        required
                        className="transition-smooth focus:scale-[1.02]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-company" className="text-sm font-medium">Company (Optional)</Label>
                      <Input
                        id="signup-company"
                        type="text"
                        placeholder="Enter your company name"
                        value={signupData.company}
                        onChange={(e) => setSignupData({ ...signupData, company: e.target.value })}
                        className="transition-smooth focus:scale-[1.02]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email" className="text-sm font-medium">Email</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="Enter your email"
                        value={signupData.email}
                        onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                        required
                        className="transition-smooth focus:scale-[1.02]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password" className="text-sm font-medium">Password</Label>
                      <div className="relative">
                        <Input
                          id="signup-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Create a password (min. 6 characters)"
                          value={signupData.password}
                          onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                          required
                          minLength={6}
                          className="transition-smooth focus:scale-[1.02] pr-12"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent transition-smooth"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full gradient-primary text-primary-foreground shadow-glow hover:shadow-elegant transition-smooth hover:scale-[1.02] font-semibold" 
                      disabled={loading}
                    >
                      {loading ? "Creating Account..." : "Create Account"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-muted-foreground mt-6">
            By signing up, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>

      {/* Services Section */}
      <div className="py-20 px-8 bg-secondary/30 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 animate-fade-in">
            <h2 className="text-4xl font-bold text-foreground mb-4">Powerful AI Services</h2>
            <p className="text-muted-foreground text-lg">
              Everything you need to build, deploy, and scale ML solutions
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {services.map((service, index) => (
              <Card 
                key={index} 
                className="border-border hover:shadow-elegant transition-smooth hover:scale-105 hover:border-primary/50 bg-card/80 backdrop-blur-sm animate-slide-in-left"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardContent className="p-8">
                  <div className="w-14 h-14 gradient-primary rounded-xl flex items-center justify-center mb-5 shadow-glow">
                    <service.icon className="w-7 h-7 text-primary-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-3">{service.title}</h3>
                  <p className="text-muted-foreground">{service.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="py-20 px-8 relative">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
            <div className="animate-scale-in" style={{ animationDelay: '0.1s' }}>
              <p className="text-6xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-3">500+</p>
              <p className="text-muted-foreground text-lg">Models Deployed</p>
            </div>
            <div className="animate-scale-in" style={{ animationDelay: '0.2s' }}>
              <p className="text-6xl font-bold bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent mb-3">99.9%</p>
              <p className="text-muted-foreground text-lg">Accuracy Rate</p>
            </div>
            <div className="animate-scale-in" style={{ animationDelay: '0.3s' }}>
              <p className="text-6xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-3">10x</p>
              <p className="text-muted-foreground text-lg">Faster Deployment</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
