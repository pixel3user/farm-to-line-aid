import { useState, useEffect } from "react";
import Navigation from "@/components/Navigation";
import DashboardOverview from "@/components/DashboardOverview";
import ProductManagement from "@/components/ProductManagement";
import StoreManagement from "@/components/StoreManagement";
import MarketingTools from "@/components/MarketingTools";
import Analytics from "@/components/Analytics";
import LineBotDemo from "@/components/LineBotDemo";
import { AIBrainVisualization } from "@/components/AIBrainVisualization";
import heroImage from "@/assets/hero-farm-tech.jpg";

const Index = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isLiffApp, setIsLiffApp] = useState(false);

  useEffect(() => {
    // Check if running inside LINE LIFF
    const userAgent = navigator.userAgent.toLowerCase();
    const isInLine = userAgent.includes('line');
    setIsLiffApp(isInLine);
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case "products":
        return <ProductManagement />;
      case "stores":
        return <StoreManagement />;
      case "marketing":
        return <MarketingTools />;
      case "analytics":
        return <Analytics />;
      case "ai-brain":
        return <AIBrainVisualization />;
      case "buyers":
        return <div className="p-6"><h1>買方管理即將推出</h1></div>;
      case "line-demo":
        return (
          <div className="p-6">
            <h1 className="text-3xl font-bold mb-6 text-center">LINE Bot 演示</h1>
            <p className="text-muted-foreground text-center mb-8">
              體驗農民如何在 LINE 中使用 Farm2Market AI 智慧助理
            </p>
            <div className="flex justify-center">
              <LineBotDemo />
            </div>
          </div>
        );
      default:
        return <DashboardOverview />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section - Only show on first load or non-LIFF environments */}
      {activeTab === "dashboard" && !isLiffApp && (
        <section className="relative h-96 overflow-hidden">
          <img 
            src={heroImage} 
            alt="Farm2Market AI - Agricultural Technology"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-hero/80 flex items-center justify-center">
            <div className="text-center text-white space-y-4 max-w-2xl px-6">
              <h1 className="text-4xl md:text-6xl font-bold">
                Farm2Market AI
              </h1>
              <p className="text-xl md:text-2xl opacity-90">
                智慧農業銷售助理
              </p>
              <p className="text-base md:text-lg opacity-80">
                運用 AI 驅動的 LINE 整合轉變您的農場銷售
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Navigation */}
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content */}
      <main className="min-h-screen">
        {renderContent()}
      </main>

      {/* LIFF Integration Info */}
      {isLiffApp && (
        <div className="fixed bottom-4 right-4 p-3 bg-primary text-primary-foreground rounded-lg shadow-strong text-sm">
          🤖 已連接到 LINE Bot
        </div>
      )}
    </div>
  );
};

export default Index;
