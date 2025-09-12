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

const StoreManagement = () => {
  const [showStoreLocator, setShowStoreLocator] = useState(false);
  const { toast } = useToast();

  const connectedStores = [
    {
      id: 1,
      name: "GreenMart Organic",
      type: "Supermarket",
      location: "Hsinchu City Center",
      distance: "2.3 km",
      contact: "+886-3-123-4567",
      email: "orders@greenmart.tw",
      status: "active",
      lastOrder: "2 days ago",
      orderFrequency: "Every 3 days",
      avgOrderValue: "NT$2,400",
      totalOrders: 24,
      rating: 4.8,
      relationship: "established"
    },
    {
      id: 2,
      name: "FreshMart Express",
      type: "Convenience Store",
      location: "Zhubei District",
      distance: "4.1 km",
      contact: "+886-3-987-6543",
      email: "supply@freshmart.tw",
      status: "active",
      lastOrder: "1 day ago",
      orderFrequency: "Every 2 days",
      avgOrderValue: "NT$1,800",
      totalOrders: 32,
      rating: 4.6,
      relationship: "established"
    },
    {
      id: 3,
      name: "Organic Valley Market",
      type: "Organic Store",
      location: "Xinpu Township",
      distance: "1.8 km",
      contact: "+886-3-555-7890",
      email: "orders@organicvalley.tw",
      status: "pending",
      lastOrder: "Never",
      orderFrequency: "New contact",
      avgOrderValue: "NT$0",
      totalOrders: 0,
      rating: 4.9,
      relationship: "new_lead"
    }
  ];

  const nearbyStores = [
    {
      name: "Natural Foods Co-op",
      type: "Organic Store",
      distance: "3.2 km",
      rating: 4.7,
      potential: "High",
      reason: "Specializes in local farm products"
    },
    {
      name: "Farm Fresh Market",
      type: "Farmers Market",
      distance: "5.1 km",
      rating: 4.5,
      potential: "Medium",
      reason: "Weekend market, seasonal demand"
    },
    {
      name: "City Deli & Bakery",
      type: "Restaurant/Bakery",
      distance: "2.8 km",
      rating: 4.8,
      potential: "High",
      reason: "Uses premium eggs for baking"
    }
  ];

  const handleSendIntro = (storeName: string) => {
    toast({
      title: "Introduction Sent! 📧",
      description: `AI-generated introduction sent to ${storeName}. We'll track their response.`,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="default" className="bg-success">Active</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getRelationshipBadge = (relationship: string) => {
    switch (relationship) {
      case "established":
        return <Badge variant="outline" className="border-primary text-primary">Established</Badge>;
      case "new_lead":
        return <Badge variant="outline" className="border-accent text-accent">New Lead</Badge>;
      default:
        return <Badge variant="outline">Contact</Badge>;
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Store Management</h1>
          <p className="text-muted-foreground mt-1">Manage your store relationships and discover new opportunities</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showStoreLocator} onOpenChange={setShowStoreLocator}>
            <DialogTrigger asChild>
              <Button variant="farm" className="gap-2">
                <Search className="h-4 w-4" />
                Find New Stores
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>AI Store Locator</DialogTitle>
                <DialogDescription>
                  Discover potential buyers near your farm using AI-powered matching
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="location">Search Radius</Label>
                    <Input id="location" placeholder="10 km from farm" />
                  </div>
                  <div>
                    <Label htmlFor="storeType">Store Type</Label>
                    <Input id="storeType" placeholder="Organic, Supermarket, etc." />
                  </div>
                  <div className="flex items-end">
                    <Button variant="hero" className="w-full">
                      <Search className="h-4 w-4 mr-2" />
                      Search Stores
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
                          <span className="text-muted-foreground">Distance</span>
                          <span>{store.distance}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Potential</span>
                          <Badge variant={store.potential === "High" ? "default" : "secondary"}>
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
                            Send Intro
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
            Filter
          </Button>
        </div>
      </div>

      {/* Store Cards */}
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
                  <p className="text-xs text-muted-foreground">Total Orders</p>
                  <p className="font-semibold text-foreground">{store.totalOrders}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Avg Order</p>
                  <p className="font-semibold text-foreground">{store.avgOrderValue}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Frequency</p>
                  <p className="font-semibold text-foreground">{store.orderFrequency}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Rating</p>
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-secondary text-secondary" />
                    <span className="font-semibold">{store.rating}</span>
                  </div>
                </div>
              </div>

              {/* Last Activity */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>Last order: {store.lastOrder}</span>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <Phone className="h-3 w-3 mr-1" />
                  Call
                </Button>
                <Button variant="farm" size="sm" className="flex-1">
                  <Mail className="h-3 w-3 mr-1" />
                  Message
                </Button>
              </div>

              {/* AI Suggestions for established stores */}
              {store.relationship === "established" && store.status === "active" && (
                <div className="p-3 rounded-lg bg-primary-lighter border border-primary/20">
                  <p className="text-xs font-medium text-primary">AI Insight</p>
                  <p className="text-xs text-primary/80 mt-1">
                    {store.name} usually reorders tomorrow. Send a friendly reminder?
                  </p>
                  <Button size="sm" variant="outline" className="mt-2 text-xs h-7">
                    Send Reminder
                  </Button>
                </div>
              )}

              {/* Follow-up suggestions for new leads */}
              {store.relationship === "new_lead" && (
                <div className="p-3 rounded-lg bg-accent-light border border-accent/20">
                  <p className="text-xs font-medium">Follow-up Suggestion</p>
                  <p className="text-xs opacity-80 mt-1">
                    Schedule a call to discuss their organic egg requirements
                  </p>
                  <Button size="sm" variant="outline" className="mt-2 text-xs h-7">
                    Schedule Call
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Performance Overview */}
      <Card className="bg-gradient-card shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Store Relationship Overview
          </CardTitle>
          <CardDescription>AI-powered insights on your store relationships</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-lg bg-success-light border border-success/20">
              <DollarSign className="h-6 w-6 mx-auto text-success mb-2" />
              <p className="text-2xl font-bold text-success-foreground">NT$156K</p>
              <p className="text-sm text-success-foreground/80">Total Revenue</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-primary-lighter border border-primary/20">
              <Store className="h-6 w-6 mx-auto text-primary mb-2" />
              <p className="text-2xl font-bold text-primary">12</p>
              <p className="text-sm text-primary/80">Active Stores</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-accent-light border border-accent/20">
              <Package className="h-6 w-6 mx-auto text-accent mb-2" />
              <p className="text-2xl font-bold">856</p>
              <p className="text-sm opacity-80">Total Orders</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-secondary-dark/20 border border-secondary/20">
              <Calendar className="h-6 w-6 mx-auto text-secondary-dark mb-2" />
              <p className="text-2xl font-bold text-secondary-dark">2.3</p>
              <p className="text-sm text-secondary-dark/80">Avg Days Between Orders</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StoreManagement;