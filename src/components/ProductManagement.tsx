import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Package, 
  Plus, 
  Edit, 
  Camera, 
  DollarSign, 
  Calendar,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Upload
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ProductManagement = () => {
  const [showAddProduct, setShowAddProduct] = useState(false);
  const { toast } = useToast();

  const products = [
    {
      id: 1,
      name: "Farm Fresh Grade A Eggs",
      category: "Eggs",
      price: "NT$180",
      unit: "per 30-egg tray",
      stock: 45,
      minStock: 10,
      status: "active",
      lastOrder: "2 days ago",
      totalSold: "1,250 trays",
      image: "/placeholder.svg"
    },
    {
      id: 2,
      name: "Organic Free-Range Eggs",
      category: "Eggs",
      price: "NT$280",
      unit: "per 30-egg tray",
      stock: 8,
      minStock: 15,
      status: "low_stock",
      lastOrder: "5 days ago",
      totalSold: "420 trays",
      image: "/placeholder.svg"
    },
    {
      id: 3,
      name: "Duck Eggs Premium",
      category: "Duck Eggs",
      price: "NT$320",
      unit: "per 20-egg tray",
      stock: 22,
      minStock: 5,
      status: "active",
      lastOrder: "1 day ago",
      totalSold: "180 trays",
      image: "/placeholder.svg"
    }
  ];

  const handleAddProduct = () => {
    toast({
      title: "Product Added Successfully! 🎉",
      description: "Your new product has been added and AI marketing materials are being generated.",
    });
    setShowAddProduct(false);
  };

  const getStatusBadge = (status: string, stock: number, minStock: number) => {
    if (status === "low_stock" || stock <= minStock) {
      return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Low Stock</Badge>;
    }
    return <Badge variant="default" className="gap-1 bg-success"><CheckCircle className="h-3 w-3" />Active</Badge>;
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Product Management</h1>
          <p className="text-muted-foreground mt-1">Manage your farm products and inventory</p>
        </div>
        <Dialog open={showAddProduct} onOpenChange={setShowAddProduct}>
          <DialogTrigger asChild>
            <Button variant="hero" className="gap-2">
              <Plus className="h-4 w-4" />
              Add New Product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Product</DialogTitle>
              <DialogDescription>
                Create a new product listing. AI will help generate marketing materials.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Product Name</Label>
                  <Input id="name" placeholder="e.g., Farm Fresh Grade A Eggs" />
                </div>
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="eggs">Chicken Eggs</SelectItem>
                      <SelectItem value="duck-eggs">Duck Eggs</SelectItem>
                      <SelectItem value="quail-eggs">Quail Eggs</SelectItem>
                      <SelectItem value="specialty">Specialty Products</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="price">Price (NT$)</Label>
                    <Input id="price" type="number" placeholder="180" />
                  </div>
                  <div>
                    <Label htmlFor="unit">Unit</Label>
                    <Input id="unit" placeholder="per 30-egg tray" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="stock">Current Stock</Label>
                    <Input id="stock" type="number" placeholder="45" />
                  </div>
                  <div>
                    <Label htmlFor="minStock">Minimum Stock</Label>
                    <Input id="minStock" type="number" placeholder="10" />
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea 
                    id="description" 
                    placeholder="Fresh eggs from free-range chickens, collected daily..."
                    className="min-h-[100px]"
                  />
                </div>
                <div>
                  <Label>Product Photo</Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Drop photo here or click to upload
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      AI will enhance and create marketing materials
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddProduct(false)}>
                Cancel
              </Button>
              <Button variant="hero" onClick={handleAddProduct}>
                Add Product & Generate Marketing
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => (
          <Card key={product.id} className="bg-gradient-card shadow-soft hover:shadow-medium transition-all">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{product.name}</CardTitle>
                  <CardDescription className="text-primary font-medium">
                    {product.price} {product.unit}
                  </CardDescription>
                </div>
                {getStatusBadge(product.status, product.stock, product.minStock)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Product Image Placeholder */}
              <div className="aspect-video bg-gradient-primary/10 rounded-lg flex items-center justify-center border border-primary/20">
                <Package className="h-12 w-12 text-primary/40" />
              </div>

              {/* Stock Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Current Stock</p>
                  <p className="font-semibold text-foreground">{product.stock} trays</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Sold</p>
                  <p className="font-semibold text-foreground">{product.totalSold}</p>
                </div>
              </div>

              {/* Stock Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>Stock Level</span>
                  <span className={product.stock <= product.minStock ? "text-destructive" : "text-success"}>
                    {product.stock}/{product.minStock + 50} trays
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all ${
                      product.stock <= product.minStock ? "bg-destructive" : "bg-success"
                    }`}
                    style={{ width: `${Math.min((product.stock / (product.minStock + 50)) * 100, 100)}%` }}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <Edit className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                <Button variant="farm" size="sm" className="flex-1">
                  <Camera className="h-3 w-3 mr-1" />
                  Marketing
                </Button>
              </div>

              {/* AI Suggestions */}
              {product.stock <= product.minStock && (
                <div className="p-3 rounded-lg bg-warning-light border border-warning/20">
                  <p className="text-xs font-medium text-warning-foreground">AI Suggestion</p>
                  <p className="text-xs text-warning-foreground/80 mt-1">
                    Stock is low. Send reorder reminders to 3 regular buyers?
                  </p>
                  <Button size="sm" variant="warning" className="mt-2 text-xs h-7">
                    Send Reminders
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* AI Insights Card */}
      <Card className="bg-gradient-card shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Product Performance Insights
          </CardTitle>
          <CardDescription>AI-powered recommendations for your products</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-success-light border border-success/20">
              <h4 className="font-semibold text-success-foreground mb-2">Best Performer</h4>
              <p className="text-sm text-success-foreground/80">
                Farm Fresh Grade A Eggs: 85% reorder rate, suggest increasing production by 20%
              </p>
            </div>
            <div className="p-4 rounded-lg bg-accent-light border border-accent/20">
              <h4 className="font-semibold mb-2">Market Opportunity</h4>
              <p className="text-sm opacity-80">
                Duck eggs showing 40% price premium opportunity in organic markets
              </p>
            </div>
            <div className="p-4 rounded-lg bg-primary-lighter border border-primary/20">
              <h4 className="font-semibold text-primary mb-2">Seasonal Trend</h4>
              <p className="text-sm text-primary/80">
                Holiday baking season approaching - expect 30% increase in demand
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductManagement;