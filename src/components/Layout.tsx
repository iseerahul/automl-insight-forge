import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { 
  BarChart3, 
  Database, 
  Brain, 
  TrendingUp, 
  Users, 
  PieChart,
  Settings,
  ChevronRight
} from "lucide-react";

interface LayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: "Dashboard", href: "/", icon: BarChart3 },
  { name: "DataConnect Pro", href: "/dataconnect", icon: Database },
  { name: "ML Studio", href: "/mlstudio", icon: Brain },
  { name: "Forecast", href: "/forecast", icon: TrendingUp },
  { name: "Recommendation", href: "/recommendation", icon: Users },
  { name: "Segmentation", href: "/segmentation", icon: PieChart },
];

export function Layout({ children }: LayoutProps) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <div className="w-64 bg-card border-r border-border flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-border">
          <Link to="/" className="flex items-center space-x-3">
            <div className="w-8 h-8 gradient-primary rounded-lg flex items-center justify-center">
              <Brain className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">AutoML Analytics</h1>
              <p className="text-xs text-muted-foreground">Enterprise Hub</p>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-smooth group",
                  isActive
                    ? "gradient-primary text-primary-foreground shadow-elegant"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                )}
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.name}
                {isActive && (
                  <ChevronRight className="w-4 h-4 ml-auto" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <Link
            to="/settings"
            className="flex items-center px-4 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-smooth"
          >
            <Settings className="w-5 h-5 mr-3" />
            Settings
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}