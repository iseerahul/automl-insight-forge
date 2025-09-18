import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ServiceCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  gradient?: boolean;
  status?: "active" | "coming-soon" | "beta";
  features?: string[];
}

export function ServiceCard({ 
  title, 
  description, 
  icon: Icon, 
  href, 
  gradient = false,
  status = "active",
  features = []
}: ServiceCardProps) {
  const isDisabled = status === "coming-soon";

  return (
    <Card className={cn(
      "group relative overflow-hidden transition-smooth hover:shadow-card",
      gradient && "gradient-card border-primary/20",
      !isDisabled && "hover:scale-[1.02] cursor-pointer"
    )}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center transition-smooth",
            gradient ? "bg-primary/10" : "bg-accent/10"
          )}>
            <Icon className={cn(
              "w-6 h-6",
              gradient ? "text-primary" : "text-accent"
            )} />
          </div>
          {status !== "active" && (
            <span className={cn(
              "px-2 py-1 text-xs font-medium rounded-full",
              status === "beta" 
                ? "bg-warning/10 text-warning border border-warning/20"
                : "bg-muted text-muted-foreground"
            )}>
              {status === "beta" ? "Beta" : "Coming Soon"}
            </span>
          )}
        </div>
        <CardTitle className="text-xl font-semibold">{title}</CardTitle>
        <CardDescription className="text-muted-foreground">
          {description}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="pt-0">
        {features.length > 0 && (
          <ul className="space-y-2 mb-6">
            {features.map((feature, index) => (
              <li key={index} className="flex items-center text-sm text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-accent mr-3" />
                {feature}
              </li>
            ))}
          </ul>
        )}
        
        {!isDisabled ? (
          <Button 
            asChild 
            variant={gradient ? "default" : "outline"}
            className="w-full group-hover:translate-x-1 transition-smooth"
          >
            <Link to={href} className="flex items-center justify-center">
              Launch Service
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        ) : (
          <Button disabled className="w-full">
            Coming Soon
          </Button>
        )}
      </CardContent>
    </Card>
  );
}