import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Store, 
  Plus, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar,
  TrendingUp,
  Search,
  Filter,
  Star,
  Clock,
  DollarSign,
  Package
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { DatabaseService } from "@/lib/database";

const StoreManagement = () => {
  const [showStoreLocator, setShowStoreLocator] = useState(false);
  const { toast } = useToast();
  const { user, userStores, refreshUserData } = useAuth();

  // Use real user stores from database
  const connectedStores = userStores.map(store => ({
    id: store.id,
    name: store.name,
    type: store.type === 'supermarket' ? '超市' : 
          store.type === 'restaurant' ? '餐廳' :
          store.type === 'farmers_market' ? '農夫市集' :
          store.type === 'online_store' ? '線上商店' : '其他',
    location: store.location,
    distance: "2.3 公里", // This would be calculated from user location
    contact: store.contact?.phone || "未提供",
    email: store.contact?.email || "未提供",
    status: store.status === 'customer' ? 'active' : 'potential',
    lastOrder: store.metadata?.lastOrder ? "2 天前" : "無",
    orderFrequency: "每 3 天", // This would be calculated from order history
    avgOrderValue: `NT$${store.metadata?.totalRevenue ? Math.round(store.metadata.totalRevenue / Math.max(store.metadata.totalOrders, 1)) : 0}`,
    totalOrders: store.metadata?.totalOrders || 0,
    rating: 4.8, // This would be calculated from feedback
    relationship: store.status === 'customer' ? 'established' : 'potential'
  }));

  const nearbyStores = [
    {
      name: "天然食品合作社",
      type: "有機商店",
      distance: "3.2 公里",
      rating: 4.7,
      potential: "高",
      reason: "專營在地農場產品"
    },
    {
      name: "農場鮮品市場",
      type: "農夫市集",
      distance: "5.1 公里",
      rating: 4.5,
      potential: "中",
      reason: "週末市集，季節性需求"
    },
    {
      name: "城市熟食與烘焙",
      type: "餐廳/烘焙坊",
      distance: "2.8 公里",
      rating: 4.8,
      potential: "高",
      reason: "使用優質雞蛋製作烘焙食品"
    }
  ];

  const handleSendIntro = (storeName: string) => {
    toast({
      title: "介紹信已發送！ 📧",
      description: `AI 生成的介紹信已發送給 ${storeName}。我們將追蹤他們的回應。`,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="default" className="bg-success">活躍</Badge>;
      case "pending":
        return <Badge variant="secondary">待定</Badge>;
      default:
        return <Badge variant="outline">未知</Badge>;
    }
  };

  const getRelationshipBadge = (relationship: string) => {
    switch (relationship) {
      case "established":
        return <Badge variant="outline" className="border-primary text-primary">已建立</Badge>;
      case "new_lead":
        return <Badge variant="outline" className="border-accent text-accent">新客戶</Badge>;
      default:
        return <Badge variant="outline">聯絡人</Badge>;
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">商店管理</h1>
          <p className="text-muted-foreground mt-1">
            {connectedStores.length > 0 ? "管理商店關係並發現新機會" : "開始建立您的商店網絡"}
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showStoreLocator} onOpenChange={setShowStoreLocator}>
            <DialogTrigger asChild>
              <Button variant="farm" className="gap-2">
                <Search className="h-4 w-4" />
                尋找新商店
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>AI 商店定位器</DialogTitle>
                <DialogDescription>
                  使用 AI 驅動匹配發現您農場附近的潛在買家
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="location">搜尋半徑</Label>
                    <Input id="location" placeholder="農場 10 公里內" />
                  </div>
                  <div>
                    <Label htmlFor="storeType">商店類型</Label>
                    <Input id="storeType" placeholder="有機、超市等" />
                  </div>
                  <div className="flex items-end">
                    <Button variant="hero" className="w-full">
                      <Search className="h-4 w-4 mr-2" />
                      搜尋商店
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {nearbyStores.map((store, index) => (
                    <Card key={index} className="bg-gradient-card">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-base">{store.name}</CardTitle>
                            <CardDescription>{store.type}</CardDescription>
                          </div>
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3 fill-secondary text-secondary" />
                            <span className="text-xs">{store.rating}</span>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">距離</span>
                          <span>{store.distance}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">潛力</span>
                          <Badge variant={store.potential === "高" ? "default" : "secondary"}>
                            {store.potential}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{store.reason}</p>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="hero" 
                            className="flex-1"
                            onClick={() => handleSendIntro(store.name)}
                          >
                            發送介紹
                          </Button>
                          <Button size="sm" variant="outline">
                            <Phone className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            篩選
          </Button>
        </div>
      </div>

      {/* Store Cards */}
      {connectedStores.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {connectedStores.map((store) => (
          <Card key={store.id} className="bg-gradient-card shadow-soft hover:shadow-medium transition-all">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{store.name}</CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    <Store className="h-3 w-3" />
                    {store.type}
                  </CardDescription>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  {getStatusBadge(store.status)}
                  {getRelationshipBadge(store.relationship)}
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Contact Info */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-3 w-3 text-muted-foreground" />
                  <span>{store.location} ({store.distance})</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-3 w-3 text-muted-foreground" />
                  <span>{store.contact}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs">{store.email}</span>
                </div>
              </div>

              {/* Performance Stats */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/50">
                <div>
                  <p className="text-xs text-muted-foreground">總訂單</p>
                  <p className="font-semibold text-foreground">{store.totalOrders}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">平均訂單</p>
                  <p className="font-semibold text-foreground">{store.avgOrderValue}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">頻率</p>
                  <p className="font-semibold text-foreground">{store.orderFrequency}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">評分</p>
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-secondary text-secondary" />
                    <span className="font-semibold">{store.rating}</span>
                  </div>
                </div>
              </div>

              {/* Last Activity */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>上次訂單：{store.lastOrder}</span>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <Phone className="h-3 w-3 mr-1" />
                  通話
                </Button>
                <Button variant="farm" size="sm" className="flex-1">
                  <Mail className="h-3 w-3 mr-1" />
                  訊息
                </Button>
              </div>

              {/* AI Suggestions for established stores */}
              {store.relationship === "established" && store.status === "active" && (
                <div className="p-3 rounded-lg bg-primary-lighter border border-primary/20">
                  <p className="text-xs font-medium text-primary">AI 洞察</p>
                  <p className="text-xs text-primary/80 mt-1">
                    {store.name} 通常明天會下單。發送友善提醒？
                  </p>
                  <Button size="sm" variant="outline" className="mt-2 text-xs h-7">
                    發送提醒
                  </Button>
                </div>
              )}

              {/* Follow-up suggestions for new leads */}
              {store.relationship === "new_lead" && (
                <div className="p-3 rounded-lg bg-accent-light border border-accent/20">
                  <p className="text-xs font-medium">追蹤建議</p>
                  <p className="text-xs opacity-80 mt-1">
                    安排通話討論他們的有機雞蛋需求
                  </p>
                  <Button size="sm" variant="outline" className="mt-2 text-xs h-7">
                    安排通話
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="w-24 h-24 mx-auto mb-6 bg-gradient-primary/10 rounded-full flex items-center justify-center">
            <Store className="w-12 h-12 text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">還沒有合作的商店</h3>
          <p className="text-muted-foreground mb-6">開始尋找附近的商店來建立您的銷售網絡</p>
          <Button onClick={() => setShowStoreLocator(true)} className="gap-2">
            <Search className="w-4 h-4" />
            尋找第一個商店
          </Button>
        </div>
      )}

      {/* Performance Overview */}
      <Card className="bg-gradient-card shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            商店關係概覽
          </CardTitle>
          <CardDescription>您商店關係的 AI 驅動洞察</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-lg bg-success-light border border-success/20">
              <DollarSign className="h-6 w-6 mx-auto text-success mb-2" />
              <p className="text-2xl font-bold text-success-foreground">NT$156K</p>
              <p className="text-sm text-success-foreground/80">總營收</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-primary-lighter border border-primary/20">
              <Store className="h-6 w-6 mx-auto text-primary mb-2" />
              <p className="text-2xl font-bold text-primary">12</p>
              <p className="text-sm text-primary/80">活躍商店</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-accent-light border border-accent/20">
              <Package className="h-6 w-6 mx-auto text-accent mb-2" />
              <p className="text-2xl font-bold">856</p>
              <p className="text-sm opacity-80">總訂單</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-secondary-dark/20 border border-secondary/20">
              <Calendar className="h-6 w-6 mx-auto text-secondary-dark mb-2" />
              <p className="text-2xl font-bold text-secondary-dark">2.3</p>
              <p className="text-sm text-secondary-dark/80">平均訂單間隔天數</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StoreManagement;