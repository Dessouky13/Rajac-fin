import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { 
  Users, 
  CreditCard, 
  TrendingUp, 
  Calendar, 
  PiggyBank,
  Home,
  FileSpreadsheet,
  GraduationCap
} from "lucide-react";

interface NavItem {
  id: string;
  labelAr: string;
  labelEn: string;
  icon: React.ComponentType<{ className?: string }>;
  descriptionAr: string;
  descriptionEn: string;
}

const navItems: NavItem[] = [
  { 
    id: "fees", 
    labelAr: "إدارة الرسوم", 
    labelEn: "Fee Management",
    icon: CreditCard, 
    descriptionAr: "البحث عن الطلاب وتسجيل المدفوعات",
    descriptionEn: "Search students and record payments"
  },
  { 
    id: "due-report", 
    labelAr: "تقرير المدفوعات المستحقة", 
    labelEn: "Due Payments Report",
    icon: Calendar, 
    descriptionAr: "عرض الطلاب المتأخرين في السداد",
    descriptionEn: "View students with overdue payments"
  },
  { 
    id: "transactions", 
    labelAr: "الإيرادات والمصروفات", 
    labelEn: "Revenue & Expenses",
    icon: TrendingUp, 
    descriptionAr: "المعاملات المالية",
    descriptionEn: "Financial transactions"
  },
  { 
    id: "balances", 
    labelAr: "النقد والبنك والودائع", 
    labelEn: "Cash, Bank & Deposits",
    icon: PiggyBank, 
    descriptionAr: "لوحة الأرصدة",
    descriptionEn: "Balance dashboard"
  },
  { 
    id: "teachers", 
    labelAr: "إدارة المعلمين", 
    labelEn: "Teachers Management",
    icon: GraduationCap, 
    descriptionAr: "إدارة معلومات المعلمين والمواد الدراسية",
    descriptionEn: "Manage teacher information and subjects"
  },
];

interface NavigationProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

export function Navigation({ activeSection, onSectionChange }: NavigationProps) {
  const { isArabic, t } = useLanguage();

  return (
    <Card className="p-6 bg-gradient-card border-primary/10 card-hover fade-in" dir={isArabic ? "rtl" : "ltr"}>
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground mb-6 slide-up">
          {t("إدارة المدرسة", "School Management")}
        </h2>
        {navItems.map((item, index) => (
          <Button
            key={item.id}
            variant={activeSection === item.id ? "default" : "ghost"}
            className={cn(
              "w-full justify-start h-auto p-4 transition-all duration-500 rounded-xl scale-in",
              "hover:shadow-lg hover:-translate-y-1",
              isArabic ? "text-right" : "text-left",
              activeSection === item.id 
                ? "bg-gradient-primary shadow-xl scale-105 glow-primary" 
                : "hover:bg-accent/50 hover:scale-102"
            )}
            style={{ animationDelay: `${index * 0.1}s` }}
            onClick={() => onSectionChange(item.id)}
          >
            <div className={`flex items-center w-full ${isArabic ? 'space-x-4 space-x-reverse' : 'space-x-4'}`}>
              <item.icon className={cn(
                "h-6 w-6 shrink-0 transition-all duration-300",
                activeSection === item.id 
                  ? "text-primary-foreground scale-110" 
                  : "text-primary group-hover:text-primary-glow"
              )} />
              <div className="flex flex-col items-start flex-1">
                <span className={cn(
                  "text-base font-bold transition-all duration-300",
                  activeSection === item.id ? "text-primary-foreground" : "text-foreground"
                )}>
                  {isArabic ? item.labelAr : item.labelEn}
                </span>
                <span className={cn(
                  "text-xs mt-1 transition-all duration-300",
                  activeSection === item.id ? "text-primary-foreground/90" : "text-muted-foreground"
                )}>
                  {isArabic ? item.descriptionAr : item.descriptionEn}
                </span>
              </div>
            </div>
          </Button>
        ))}
      </div>
    </Card>
  );
}