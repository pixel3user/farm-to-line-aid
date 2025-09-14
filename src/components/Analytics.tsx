import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  DollarSign, 
  Package, 
  Store, 
  Calendar,
  Target,
  Award,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  PieChart,
  LineChart
} from "lucide-react";

const Analytics = () => {
  const salesData = [
    { month: "1月", revenue: 42000, orders: 85, stores: 8 },
    { month: "2月", revenue: 45200, orders: 92, stores: 9 },
    { month: "3月", revenue: 51800, orders: 108, stores: 12 },
    { month: "4月", revenue: 48600, orders: 98, stores: 11 },
    { month: "5月", revenue: 55400, orders: 115, stores: 13 },
    { month: "6月", revenue: 58900, orders: 124, stores: 14 }
  ];

  const topProducts = [
    {
      name: "農場新鮮 A 級雞蛋",
      revenue: "NT$38,400",
      orders: 64,
      growth: "+12%",
      trend: "up"
    },
    {
      name: "有機放養雞蛋",
      revenue: "NT$16,800",
      orders: 28,
      growth: "+8%",
      trend: "up"
    },
    {
      name: "優質鴨蛋",
      revenue: "NT$9,600",
      orders: 15,
      growth: "-3%",
      trend: "down"
    }
  ];

  const topStores = [
    {
      name: "綠色有機超市",
      revenue: "NT$18,200",
      orders: 24,
      frequency: "每 3 天",
      satisfaction: 98
    },
    {
      name: "新鮮便利超商",
      revenue: "NT$14,400",
      orders: 32,
      frequency: "每 2 天",
      satisfaction: 95
    },
    {
      name: "天然食品合作社",
      revenue: "NT$8,800",
      orders: 16,
      frequency: "每週",
      satisfaction: 92
    }
  ];

  const kpis = [
    {
      title: "總營收",
      value: "NT$58,900",
      change: "+15.2%",
      trend: "up",
      icon: DollarSign,
      color: "text-success"
    },
    {
      title: "總訂單",
      value: "124",
      change: "+8.7%",
      trend: "up",
      icon: Package,
      color: "text-primary"
    },
    {
      title: "活躍商店",
      value: "14",
      change: "+27%",
      trend: "up",
      icon: Store,
      color: "text-accent"
    },
    {
      title: "平均訂單金額",
      value: "NT$475",
      change: "+6%",
      trend: "up",
      icon: TrendingUp,
      color: "text-secondary-dark"
    }
  ];

  const goals = [
    {
      title: "月營收目標",
      current: 58900,
      target: 65000,
      progress: 91,
      status: "on_track"
    },
    {
      title: "新商店開發",
      current: 14,
      target: 20,
      progress: 70,
      status: "needs_attention"
    },
    {
      title: "客戶留存率",
      current: 85,
      target: 90,
      progress: 94,
      status: "excellent"
    }
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">數據分析儀表板</h1>
          <p className="text-muted-foreground mt-1">追蹤您農場業務表現和洞察</p>
        </div>
        <div className="flex gap-2">
          <Select defaultValue="30days">
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7days">過去 7 天</SelectItem>
              <SelectItem value="30days">過去 30 天</SelectItem>
              <SelectItem value="90days">過去 3 個月</SelectItem>
              <SelectItem value="1year">過去一年</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            匯出報告
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, index) => {
          const Icon = kpi.icon;
          const isPositive = kpi.trend === "up";
          return (
            <Card key={index} className="bg-gradient-card shadow-soft">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{kpi.title}</p>
                    <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
                    <div className="flex items-center gap-1 mt-1">
                      {isPositive ? (
                        <ArrowUpRight className="h-3 w-3 text-success" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3 text-destructive" />
                      )}
                      <span className={`text-xs ${isPositive ? 'text-success' : 'text-destructive'}`}>
                        {kpi.change}
                      </span>
                    </div>
                  </div>
                  <Icon className={`h-8 w-8 ${kpi.color}`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Main Analytics Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">概覽</TabsTrigger>
          <TabsTrigger value="products">產品</TabsTrigger>
          <TabsTrigger value="stores">商店</TabsTrigger>
          <TabsTrigger value="goals">目標</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Chart */}
            <Card className="bg-gradient-card shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChart className="h-5 w-5 text-primary" />
                  營收趨勢
                </CardTitle>
                <CardDescription>月度營收表現</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-end justify-between gap-2 p-4">
                  {salesData.map((data, index) => (
                    <div key={index} className="flex-1 flex flex-col items-center">
                      <div 
                        className="w-full bg-gradient-primary rounded-t opacity-80 hover:opacity-100 transition-opacity"
                        style={{ height: `${(data.revenue / 60000) * 200}px` }}
                      />
                      <p className="text-xs text-muted-foreground mt-2">{data.month}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border/50">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">月平均</p>
                    <p className="font-semibold">NT$50,448</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">最佳月份</p>
                    <p className="font-semibold">NT$58,900</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">成長率</p>
                    <p className="font-semibold text-success">+15.2%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Insights */}
            <Card className="bg-gradient-card shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  AI 洞察
                </CardTitle>
                <CardDescription>成長智慧建議</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 rounded-lg bg-success-light border border-success/20">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-4 w-4 text-success" />
                    <p className="font-medium text-success-foreground">營收成長</p>
                  </div>
                  <p className="text-sm text-success-foreground/80">
                    您比上個月高出 15%！週末表現達到高峰。
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-accent-light border border-accent/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Store className="h-4 w-4 text-accent" />
                    <p className="font-medium">商店擴展</p>
                  </div>
                  <p className="text-sm opacity-80">
                    本月新增 3 家商店。專注於留存策略。
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-warning-light border border-warning/20">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    <p className="font-medium text-warning-foreground">機會</p>
                  </div>
                  <p className="text-sm text-warning-foreground/80">
                    鴨蛋顯示下降趨勢。考慮促銷活動。
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <Card className="bg-gradient-card shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                產品表現
              </CardTitle>
              <CardDescription>按產品分析營收和訂單</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topProducts.map((product, index) => (
                  <div key={index} className="flex items-center justify-between p-4 rounded-lg bg-background/50">
                    <div className="flex-1">
                      <h3 className="font-semibold">{product.name}</h3>
                      <p className="text-sm text-muted-foreground">{product.orders} 筆訂單</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{product.revenue}</p>
                      <div className="flex items-center gap-1">
                        {product.trend === "up" ? (
                          <TrendingUp className="h-3 w-3 text-success" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-destructive" />
                        )}
                        <span className={`text-xs ${product.trend === "up" ? 'text-success' : 'text-destructive'}`}>
                          {product.growth}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stores" className="space-y-4">
          <Card className="bg-gradient-card shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5 text-primary" />
                商店表現
              </CardTitle>
              <CardDescription>按商店分析營收和滿意度</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topStores.map((store, index) => (
                  <div key={index} className="p-4 rounded-lg bg-background/50">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">{store.name}</h3>
                      <div className="text-right">
                        <p className="font-semibold">{store.revenue}</p>
                        <p className="text-sm text-muted-foreground">{store.orders} 筆訂單</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">訂單頻率</p>
                        <p>{store.frequency}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">滿意度</p>
                        <div className="flex items-center gap-2">
                          <Progress value={store.satisfaction} className="flex-1" />
                          <span>{store.satisfaction}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="goals" className="space-y-4">
          <Card className="bg-gradient-card shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                業務目標
              </CardTitle>
              <CardDescription>追蹤您業務目標的進度</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {goals.map((goal, index) => {
                  const getStatusColor = (status: string) => {
                    switch (status) {
                      case "excellent": return "text-success";
                      case "on_track": return "text-primary";
                      case "needs_attention": return "text-warning";
                      default: return "text-muted-foreground";
                    }
                  };

                  const getStatusBadge = (status: string) => {
                    switch (status) {
                      case "excellent": return <Badge variant="default" className="bg-success">優秀</Badge>;
                      case "on_track": return <Badge variant="default">進度正常</Badge>;
                      case "needs_attention": return <Badge variant="secondary">需要關注</Badge>;
                      default: return <Badge variant="outline">未知</Badge>;
                    }
                  };

                  return (
                    <div key={index} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">{goal.title}</h3>
                        {getStatusBadge(goal.status)}
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>進度</span>
                          <span className={getStatusColor(goal.status)}>
                            {goal.current} / {goal.target}
                          </span>
                        </div>
                        <Progress value={goal.progress} className="h-2" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Analytics;