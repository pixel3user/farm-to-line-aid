import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, 
  Package, 
  Store, 
  Clock, 
  Plus,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  BarChart3,
  Calendar
} from "lucide-react";
import aiAssistantIcon from "@/assets/ai-assistant-icon.png";

const DashboardOverview = () => {
  const stats = [
    {
      title: "活躍產品",
      value: "8",
      change: "+2 本週新增",
      icon: Package,
      color: "text-primary"
    },
    {
      title: "合作商店",
      value: "12",
      change: "+3 新客戶",
      icon: Store,
      color: "text-accent"
    },
    {
      title: "週營業額",
      value: "NT$45,200",
      change: "+15% 相比上週",
      icon: DollarSign,
      color: "text-success"
    },
    {
      title: "回購率",
      value: "85%",
      change: "+12% 提升",
      icon: TrendingUp,
      color: "text-secondary-dark"
    }
  ];

  const recentActivity = [
    {
      type: "order",
      message: "綠色超市下了 A 級雞蛋的重複訂單",
      time: "2 小時前",
      status: "success"
    },
    {
      type: "alert",
      message: "新鮮超市庫存不足 - 建議補貨",
      time: "4 小時前",
      status: "warning"
    },
    {
      type: "lead",
      message: "新商店有興趣：有機谷市場",
      time: "6 小時前",
      status: "info"
    },
    {
      type: "marketing",
      message: "為農場新鮮雞蛋生成食譜卡",
      time: "1 天前",
      status: "success"
    }
  ];

  const quickActions = [
    {
      title: "新增產品",
      description: "上架新產品販售",
      icon: Plus,
      action: "products",
      variant: "default" as const
    },
    {
      title: "尋找新商店",
      description: "發現附近潛在買家",
      icon: Store,
      action: "stores",
      variant: "secondary" as const
    },
    {
      title: "創建行銷",
      description: "生成傳單和產品卡",
      icon: BarChart3,
      action: "marketing",
      variant: "farm" as const
    },
    {
      title: "查看分析",
      description: "檢視銷售績效",
      icon: TrendingUp,
      action: "analytics",
      variant: "outline" as const
    }
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">早安！ 🌅</h1>
          <p className="text-muted-foreground mt-1">這是您今天的農場業務概覽</p>
        </div>
        <div className="flex items-center gap-3">
          <img src={aiAssistantIcon} alt="AI 助理" className="w-12 h-12 rounded-lg shadow-medium" />
          <div>
            <p className="text-sm font-medium">AI 助理運作中</p>
            <p className="text-xs text-muted-foreground">監控 8 項產品</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="bg-gradient-card shadow-soft hover:shadow-medium transition-all">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-xs text-success">{stat.change}</p>
                  </div>
                  <Icon className={`h-8 w-8 ${stat.color}`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions */}
      <Card className="bg-gradient-card shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            快速操作
          </CardTitle>
          <CardDescription>幫助發展農場業務的常用任務</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <Button
                  key={index}
                  variant={action.variant}
                  className="h-auto p-4 flex-col gap-3 text-left"
                >
                  <Icon className="h-6 w-6" />
                  <div>
                    <p className="font-medium">{action.title}</p>
                    <p className="text-xs opacity-80">{action.description}</p>
                  </div>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity and AI Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card className="bg-gradient-card shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              最新動態
            </CardTitle>
            <CardDescription>您農場業務的最新更新</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentActivity.map((activity, index) => (
              <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-background/50">
                <div className={`w-2 h-2 rounded-full mt-2 ${
                  activity.status === 'success' ? 'bg-success' :
                  activity.status === 'warning' ? 'bg-warning' : 'bg-accent'
                }`} />
                <div className="flex-1">
                  <p className="text-sm font-medium">{activity.message}</p>
                  <p className="text-xs text-muted-foreground">{activity.time}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* AI Insights */}
        <Card className="bg-gradient-card shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <img src={aiAssistantIcon} alt="AI" className="w-5 h-5" />
              AI 洞察
            </CardTitle>
            <CardDescription>為您業務提供智慧建議</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-success-light border border-success/20">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-success" />
                <p className="font-medium text-success-foreground">補貨機會</p>
              </div>
              <p className="text-sm text-success-foreground/80">
                新鮮超市通常每 3 天補貨一次。今天發送溫和提醒以維持供應。
              </p>
              <Button size="sm" variant="success" className="mt-2">發送提醒</Button>
            </div>

            <div className="p-4 rounded-lg bg-warning-light border border-warning/20">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <p className="font-medium text-warning-foreground">行銷建議</p>
              </div>
              <p className="text-sm text-warning-foreground/80">
                為您的優質雞蛋創建食譜卡 - 轉換率提高 73%。
              </p>
              <Button size="sm" variant="warning" className="mt-2">創建食譜</Button>
            </div>

            <div className="p-4 rounded-lg bg-accent-light border border-accent/20">
              <div className="flex items-center gap-2 mb-2">
                <Store className="h-4 w-4 text-accent" />
                <p className="font-medium">新商店潛力</p>
              </div>
              <p className="text-sm opacity-80">
                5 公里內有 3 家有機市場開業 - 非常適合您的農場新鮮雞蛋。
              </p>
              <Button size="sm" variant="outline" className="mt-2">探索客戶</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardOverview;