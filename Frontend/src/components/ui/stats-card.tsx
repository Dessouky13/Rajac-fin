import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  variant?: "default" | "success" | "warning" | "destructive";
  className?: string;
}

const variantStyles = {
  default: "border-primary/20 bg-gradient-card",
  success: "border-success/20 bg-gradient-to-br from-success/5 to-success/10",
  warning: "border-warning/20 bg-gradient-to-br from-warning/5 to-warning/10",
  destructive: "border-destructive/20 bg-gradient-to-br from-destructive/5 to-destructive/10",
};

const iconStyles = {
  default: "text-primary",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
};

export function StatsCard({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  variant = "default",
  className 
}: StatsCardProps) {
  return (
    <Card className={cn(
      "card-hover transition-all duration-300 border",
      variantStyles[variant],
      className
    )}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              {title}
            </p>
            <p className="text-3xl font-bold tracking-tight">
              {value}
            </p>
            {trend && (
              <p className="text-xs text-muted-foreground">
                <span className={cn(
                  "font-medium",
                  trend.value > 0 ? "text-success" : "text-destructive"
                )}>
                  {trend.value > 0 ? "+" : ""}{trend.value}%
                </span>{" "}
                {trend.label}
              </p>
            )}
          </div>
          <div className={cn(
            "p-3 rounded-xl bg-background/50",
            iconStyles[variant]
          )}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}