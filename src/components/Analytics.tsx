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
    { month: "Jan", revenue: 42000, orders: 85, stores: 8 },
    { month: "Feb", revenue: 45200, orders: 92, stores: 9 },
    { month: "Mar", revenue: 51800, orders: 108, stores: 12 },
    { month: "Apr", revenue: 48600, orders: 98, stores: 11 },
    { month: "May", revenue: 55400, orders: 115, stores: 13 },
    { month: "Jun", revenue: 58900, orders: 124, stores: 14 }
  ];

  const topProducts = [
    {
      name: "Farm Fresh Grade A Eggs",
      revenue: "NT$38,400",
      orders: 64,
      growth: "+12%",
      trend: "up"
    },
    {
      name: "Organic Free-Range Eggs",
      revenue: "NT$16,800",
      orders: 28,
      growth: "+8%",
      trend: "up"
    },
    {
      name: "Duck Eggs Premium",
      revenue: "NT$9,600",
      orders: 15,
      growth: "-3%",
      trend: "down"
    }
  ];

  const topStores = [
    {
      name: "GreenMart Organic",
      revenue: "NT$18,200",
      orders: 24,
      frequency: "Every 3 days",
      satisfaction: 98
    },
    {
      name: "FreshMart Express",
      revenue: "NT$14,400",
      orders: 32,
      frequency: "Every 2 days",
      satisfaction: 95
    },
    {
      name: "Natural Foods Co-op",
      revenue: "NT$8,800",
      orders: 16,
      frequency: "Weekly",
      satisfaction: 92
    }
  ];

  const kpis = [
    {
      title: "Total Revenue",
      value: "NT$58,900",
      change: "+15.2%",
      trend: "up",
      icon: DollarSign,
      color: "text-success"
    },
    {
      title: "Total Orders",
      value: "124",
      change: "+8.7%",
      trend: "up",
      icon: Package,
      color: "text-primary"
    },
    {
      title: "Active Stores",
      value: "14",
      change: "+27%",
      trend: "up",
      icon: Store,
      color: "text-accent"
    },
    {
      title: "Avg Order Value",
      value: "NT$475",
      change: "+6%",
      trend: "up",
      icon: TrendingUp,
      color: "text-secondary-dark"
    }
  ];

  const goals = [
    {
      title: "Monthly Revenue Target",
      current: 58900,
      target: 65000,
      progress: 91,
      status: "on_track"
    },
    {
      title: "New Store Acquisitions",
      current: 14,
      target: 20,
      progress: 70,
      status: "needs_attention"
    },
    {
      title: "Customer Retention Rate",
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
          <h1 className="text-3xl font-bold text-foreground">Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-1">Track your farm business performance and insights</p>
        </div>
        <div className="flex gap-2">
          <Select defaultValue="30days">
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7days">Last 7 days</SelectItem>
              <SelectItem value="30days">Last 30 days</SelectItem>
              <SelectItem value="90days">Last 3 months</SelectItem>
              <SelectItem value="1year">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            Export Report
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
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="stores">Stores</TabsTrigger>
          <TabsTrigger value="goals">Goals</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Chart */}
            <Card className="bg-gradient-card shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChart className="h-5 w-5 text-primary" />
                  Revenue Trend
                </CardTitle>
                <CardDescription>Monthly revenue performance</CardDescription>
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
                    <p className="text-sm text-muted-foreground">Avg Monthly</p>
                    <p className="font-semibold">NT$50,448</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Best Month</p>
                    <p className="font-semibold">NT$58,900</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Growth Rate</p>
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
                  AI Insights
                </CardTitle>
                <CardDescription>Smart recommendations for growth</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 rounded-lg bg-success-light border border-success/20">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-4 w-4 text-success" />
                    <p className="font-medium text-success-foreground">Revenue Growth</p>
                  </div>
                  <p className="text-sm text-success-foreground/80">
                    You're 15% above last month! Peak performance on weekends.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-accent-light border border-accent/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Store className="h-4 w-4 text-accent" />
                    <p className="font-medium">Store Expansion</p>
                  </div>
                  <p className="text-sm opacity-80">
                    3 new stores added this month. Focus on retention strategies.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-warning-light border border-warning/20">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    <p className="font-medium text-warning-foreground">Opportunity</p>
                  </div>
                  <p className="text-sm text-warning-foreground/80">
                    Duck eggs showing declining trend. Consider promotional campaign.
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
                Product Performance
              </CardTitle>
              <CardDescription>Revenue and order analysis by product</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topProducts.map((product, index) => (
                  <div key={index} className="flex items-center justify-between p-4 rounded-lg bg-background/50">
                    <div className="flex-1">
                      <h3 className="font-semibold">{product.name}</h3>
                      <p className="text-sm text-muted-foreground">{product.orders} orders</p>
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
                Store Performance
              </CardTitle>
              <CardDescription>Revenue and satisfaction by store</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topStores.map((store, index) => (
                  <div key={index} className="p-4 rounded-lg bg-background/50">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">{store.name}</h3>
                      <div className="text-right">
                        <p className="font-semibold">{store.revenue}</p>
                        <p className="text-sm text-muted-foreground">{store.orders} orders</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Order Frequency</p>
                        <p>{store.frequency}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Satisfaction</p>
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
                Business Goals
              </CardTitle>
              <CardDescription>Track progress towards your business objectives</CardDescription>
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
                      case "excellent": return <Badge variant="default" className="bg-success">Excellent</Badge>;
                      case "on_track": return <Badge variant="default">On Track</Badge>;
                      case "needs_attention": return <Badge variant="secondary">Needs Attention</Badge>;
                      default: return <Badge variant="outline">Unknown</Badge>;
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
                          <span>Progress</span>
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