import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Navigation } from "@/components/layout/navigation";
import { Fees } from "@/components/sections/fees";
import { DueReport } from "@/components/sections/due-report";
import { Transactions } from "@/components/sections/transactions";
import { Balances } from "@/components/sections/balances";
import { Teachers } from "@/components/sections/teachers";

const Index = () => {
  const [activeSection, setActiveSection] = useState("fees");

  const renderSection = () => {
    switch (activeSection) {
      case "fees":
        return <Fees />;
      case "due-report":
        return <DueReport />;
      case "transactions":
        return <Transactions />;
      case "balances":
        return <Balances />;
      case "teachers":
        return <Teachers />;
      default:
        return <Fees />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1">
            <Navigation 
              activeSection={activeSection} 
              onSectionChange={setActiveSection} 
            />
          </div>
          <div className="lg:col-span-3">
            <div className="min-h-[600px] fade-in">
              {renderSection()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;