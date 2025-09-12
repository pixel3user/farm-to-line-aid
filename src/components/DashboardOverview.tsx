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
      title: "Active Products",
      value: "8",
      change: "+2 this week",
      icon: Package,
      color: "text-primary"
    },
    {
      title: "Connected Stores",
      value: "12",
      change: "+3 new leads",
      icon: Store,
      color: "text-accent"
    },
    {
      title: "Weekly Revenue",
      value: "NT$45,200",
      change: "+15% vs last week",
      icon: DollarSign,
      color: "text-success"
    },
    {
      title: "Reorder Rate",
      value: "85%",
      change: "+12% improvement",
      icon: TrendingUp,
      color: "text-secondary-dark"
    }
  ];

  const recentActivity = [
    {
      type: "order",
      message: "GreenMart placed repeat order for Grade A eggs",
      time: "2 hours ago",
      status: "success"
    },
    {
      type: "alert",
      message: "FreshMart inventory running low - reorder suggested",
      time: "4 hours ago",
      status: "warning"
    },
    {
      type: "lead",
      message: "New store interested: Organic Valley Market",
      time: "6 hours ago",
      status: "info"
    },
    {
      type: "marketing",
      message: "Recipe card generated for farm-fresh eggs",
      time: "1 day ago",
      status: "success"
    }
  ];

  const quickActions = [
    {
      title: "Add New Product",
      description: "List a new product for sale",
      icon: Plus,
      action: "products",
      variant: "default" as const
    },
    {
      title: "Find New Stores",
      description: "Discover potential buyers nearby",
      icon: Store,
      action: "stores",
      variant: "secondary" as const
    },
    {
      title: "Create Marketing",
      description: "Generate flyers and product cards",
      icon: BarChart3,
      action: "marketing",
      variant: "farm" as const
    },
    {
      title: "Check Analytics",
      description: "View sales performance",
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
          <h1 className="text-3xl font-bold text-foreground">Good Morning! 🌅</h1>
          <p className="text-muted-foreground mt-1">Here's your farm business overview for today</p>
        </div>
        <div className="flex items-center gap-3">
          <img src={aiAssistantIcon} alt="AI Assistant" className="w-12 h-12 rounded-lg shadow-medium" />
          <div>
            <p className="text-sm font-medium">AI Assistant Active</p>
            <p className="text-xs text-muted-foreground">Monitoring 8 products</p>
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
            Quick Actions
          </CardTitle>
          <CardDescription>Common tasks to help grow your farm business</CardDescription>
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
              Recent Activity
            </CardTitle>
            <CardDescription>Latest updates from your farm business</CardDescription>
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
              AI Insights
            </CardTitle>
            <CardDescription>Smart recommendations for your business</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-success-light border border-success/20">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-success" />
                <p className="font-medium text-success-foreground">Reorder Opportunity</p>
              </div>
              <p className="text-sm text-success-foreground/80">
                FreshMart typically reorders every 3 days. Send a gentle reminder today to maintain supply.
              </p>
              <Button size="sm" variant="success" className="mt-2">Send Reminder</Button>
            </div>

            <div className="p-4 rounded-lg bg-warning-light border border-warning/20">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <p className="font-medium text-warning-foreground">Marketing Suggestion</p>
              </div>
              <p className="text-sm text-warning-foreground/80">
                Create a recipe card for your premium eggs - 73% higher conversion rate.
              </p>
              <Button size="sm" variant="warning" className="mt-2">Create Recipe</Button>
            </div>

            <div className="p-4 rounded-lg bg-accent-light border border-accent/20">
              <div className="flex items-center gap-2 mb-2">
                <Store className="h-4 w-4 text-accent" />
                <p className="font-medium">New Store Potential</p>
              </div>
              <p className="text-sm opacity-80">
                3 organic markets opened within 5km - perfect for your farm-fresh eggs.
              </p>
              <Button size="sm" variant="outline" className="mt-2">Explore Leads</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardOverview;