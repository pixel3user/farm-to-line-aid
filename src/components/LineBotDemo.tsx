import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  MessageCircle, 
  Package, 
  Handshake, 
  TrendingUp, 
  Camera, 
  Send,
  Menu,
  Phone,
  Settings
} from "lucide-react";

const LineBotDemo = () => {
  const [activeTab, setActiveTab] = useState("chat");
  const [messages, setMessages] = useState([
    {
      type: "bot",
      content: "🌾 歡迎使用 Farm2Market AI！",
      time: "10:30"
    },
    {
      type: "bot", 
      content: "您的智慧農業銷售助理已啟動。點選下方功能選單開始使用：",
      time: "10:30"
    }
  ]);

  const quickActions = [
    { icon: Package, label: "📦 管理產品", action: "products" },
    { icon: Handshake, label: "🤝 查看交易", action: "deals" },
    { icon: TrendingUp, label: "📈 行銷工具", action: "marketing" }
  ];

  const handleQuickAction = (action: string) => {
    const newMessage = {
      type: "user" as const,
      content: quickActions.find(a => a.action === action)?.label || "",
      time: "10:31"
    };
    
    setMessages(prev => [...prev, newMessage]);
    
    setTimeout(() => {
      let botResponse = "";
      switch(action) {
        case "products":
          botResponse = "📦 產品管理選項：\n• 新增產品\n• 查看庫存\n• 更新價格\n• 生成產品卡片";
          break;
        case "deals":
          botResponse = "🤝 您目前有 3 筆進行中的交易：\n• 永豐超市 - 雞蛋 50箱\n• 全聯 - 雞蛋 30箱\n• 家樂福 - 雞蛋 80箱";
          break;
        case "marketing":
          botResponse = "📈 行銷工具：\n• 生成產品宣傳單\n• 找尋新店家\n• 自動補貨提醒\n• 銷售數據分析";
          break;
      }
      
      setMessages(prev => [...prev, {
        type: "bot",
        content: botResponse,
        time: "10:31"
      }]);
    }, 1000);
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
      {/* LINE Header */}
      <div className="bg-primary text-primary-foreground p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary-glow rounded-full flex items-center justify-center">
            <span className="text-xs font-bold">AI</span>
          </div>
          <div>
            <h3 className="font-semibold">Farm2Market AI</h3>
            <p className="text-xs opacity-80">智慧農業銷售助理</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Phone className="w-5 h-5" />
          <Settings className="w-5 h-5" />
        </div>
      </div>

      {/* Chat Area */}
      <div className="h-96 bg-gray-50 p-4 overflow-y-auto">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`mb-3 flex ${message.type === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-xs px-3 py-2 rounded-lg ${
                message.type === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-white border shadow-sm"
              }`}
            >
              <p className="text-sm whitespace-pre-line">{message.content}</p>
              <p className={`text-xs mt-1 ${
                message.type === "user" ? "text-primary-foreground/70" : "text-muted-foreground"
              }`}>
                {message.time}
              </p>
            </div>
          </div>
        ))}
        
        {/* Product Card Demo */}
        {messages.length > 2 && (
          <div className="mb-3 flex justify-start">
            <Card className="max-w-xs bg-white border shadow-sm">
              <div className="p-3">
                <img 
                  src="/api/placeholder/200/120" 
                  alt="雞蛋產品"
                  className="w-full h-20 object-cover rounded mb-2"
                />
                <h4 className="font-semibold text-sm">新鮮雞蛋</h4>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-primary font-semibold">NT$180/箱</span>
                  <Badge variant="secondary" className="text-xs">庫存: 50箱</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <Button size="sm" variant="outline" className="text-xs">
                    編輯
                  </Button>
                  <Button size="sm" className="text-xs">
                    推廣
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Quick Action Buttons */}
      <div className="p-3 bg-white border-t">
        <div className="grid grid-cols-3 gap-2 mb-3">
          {quickActions.map((action, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              onClick={() => handleQuickAction(action.action)}
              className="flex flex-col gap-1 h-auto py-2 text-xs"
            >
              <action.icon className="w-4 h-4" />
              <span className="leading-tight">{action.label}</span>
            </Button>
          ))}
        </div>
        
        {/* Input Area */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Camera className="w-4 h-4" />
          </Button>
          <div className="flex-1 bg-gray-100 rounded-full px-3 py-2 text-sm text-muted-foreground">
            輸入訊息...
          </div>
          <Button size="sm">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Rich Menu */}
      <div className="bg-gradient-primary text-white">
        <div className="grid grid-cols-3 text-center">
          <button 
            className="p-3 flex flex-col items-center gap-1 hover:bg-white/10"
            onClick={() => setActiveTab("dashboard")}
          >
            <TrendingUp className="w-5 h-5" />
            <span className="text-xs">總覽</span>
          </button>
          <button 
            className="p-3 flex flex-col items-center gap-1 hover:bg-white/10"
            onClick={() => setActiveTab("products")}
          >
            <Package className="w-5 h-5" />
            <span className="text-xs">產品</span>
          </button>
          <button 
            className="p-3 flex flex-col items-center gap-1 hover:bg-white/10"
            onClick={() => setActiveTab("marketing")}
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-xs">行銷</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LineBotDemo;