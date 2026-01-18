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
import { useAuth } from "@/contexts/AuthContext";
import { DatabaseService } from "@/lib/database";
import eggImage1 from "@/assets/sample_img/Gemini_Generated_Image_qikttnqikttnqikt (1).webp";
import eggImage2 from "@/assets/sample_img/Gemini_Generated_Image_qikttnqikttnqikt (2).webp";
import eggImage3 from "@/assets/sample_img/Gemini_Generated_Image_qikttnqikttnqikt (3).webp";

const ProductManagement = () => {
  const [showAddProduct, setShowAddProduct] = useState(false);
  const { toast } = useToast();
  const { user, userProducts, refreshUserData } = useAuth();

  // Use real user products from database
  const products = userProducts.map(product => ({
    id: product.id,
    name: product.name,
    category: product.category,
    price: `NT$${product.price}`,
    unit: product.unit,
    stock: product.stock,
    minStock: 10, // Default minimum stock
    status: product.stock <= 10 ? "low_stock" : "active",
    lastOrder: "2 天前", // This would come from order history
    totalSold: "1,250 盒", // This would be calculated from sales data
    image: eggImage1 // Default image, could be from product.images[0]
  }));

  const handleAddProduct = async (productData: any) => {
    try {
      if (!user) return;
      
      await DatabaseService.createProduct(user.id, productData);
      await refreshUserData();
      
      toast({
        title: "產品新增成功！ 🎉",
        description: "您的新產品已新增，AI 行銷材料正在生成中。",
      });
      setShowAddProduct(false);
    } catch (error) {
      console.error('Failed to add product:', error);
      toast({
        title: "新增失敗",
        description: "請稍後再試。",
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: string, stock: number, minStock: number) => {
    if (status === "low_stock" || stock <= minStock) {
      return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />庫存不足</Badge>;
    }
    return <Badge variant="default" className="gap-1 bg-success"><CheckCircle className="h-3 w-3" />正常</Badge>;
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">產品管理</h1>
          <p className="text-muted-foreground mt-1">
            {products.length > 0 ? "管理您的農場產品和庫存" : "開始新增您的第一個產品"}
          </p>
        </div>
        <Dialog open={showAddProduct} onOpenChange={setShowAddProduct}>
          <DialogTrigger asChild>
            <Button variant="hero" className="gap-2">
              <Plus className="h-4 w-4" />
              新增產品
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>新增產品</DialogTitle>
              <DialogDescription>
                創建新產品清單。AI 將協助生成行銷材料。
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">產品名稱</Label>
                  <Input id="name" placeholder="例如：農場新鮮 A 級雞蛋" />
                </div>
                <div>
                  <Label htmlFor="category">類別</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="選擇類別" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="eggs">雞蛋</SelectItem>
                      <SelectItem value="duck-eggs">鴨蛋</SelectItem>
                      <SelectItem value="quail-eggs">鵪鶉蛋</SelectItem>
                      <SelectItem value="specialty">特色產品</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="price">價格 (NT$)</Label>
                    <Input id="price" type="number" placeholder="180" />
                  </div>
                  <div>
                    <Label htmlFor="unit">單位</Label>
                    <Input id="unit" placeholder="每 30 顆裝" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="stock">目前庫存</Label>
                    <Input id="stock" type="number" placeholder="45" />
                  </div>
                  <div>
                    <Label htmlFor="minStock">最低庫存</Label>
                    <Input id="minStock" type="number" placeholder="10" />
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="description">描述</Label>
                  <Textarea 
                    id="description" 
                    placeholder="來自放養雞的新鮮雞蛋，每日採集..."
                    className="min-h-[100px]"
                  />
                </div>
                <div>
                  <Label>產品照片</Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      將照片拖放到此處或點擊上傳
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      AI 將增強並創建行銷材料
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddProduct(false)}>
                取消
              </Button>
              <Button variant="hero" onClick={handleAddProduct}>
                新增產品並生成行銷
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Products Grid */}
      {products.length > 0 ? (
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
              {/* Product Image */}
              <div className="aspect-video bg-gradient-primary/10 rounded-lg overflow-hidden border border-primary/20">
                <img 
                  src={product.image} 
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Stock Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">目前庫存</p>
                  <p className="font-semibold text-foreground">{product.stock} 盒</p>
                </div>
                <div>
                  <p className="text-muted-foreground">總銷量</p>
                  <p className="font-semibold text-foreground">{product.totalSold}</p>
                </div>
              </div>

              {/* Stock Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>庫存水平</span>
                  <span className={product.stock <= product.minStock ? "text-destructive" : "text-success"}>
                    {product.stock}/{product.minStock + 50} 盒
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
                  編輯
                </Button>
                <Button variant="farm" size="sm" className="flex-1">
                  <Camera className="h-3 w-3 mr-1" />
                  行銷
                </Button>
              </div>

              {/* AI Suggestions */}
              {product.stock <= product.minStock && (
                <div className="p-3 rounded-lg bg-warning-light border border-warning/20">
                  <p className="text-xs font-medium text-warning-foreground">AI 建議</p>
                  <p className="text-xs text-warning-foreground/80 mt-1">
                    庫存不足。向 3 位常客發送補貨提醒？
                  </p>
                  <Button size="sm" variant="warning" className="mt-2 text-xs h-7">
                    發送提醒
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
            <Package className="w-12 h-12 text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">還沒有產品</h3>
          <p className="text-muted-foreground mb-6">開始新增您的第一個農產品來管理庫存和銷售</p>
          <Button onClick={() => setShowAddProduct(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            新增第一個產品
          </Button>
        </div>
      )}

      {/* AI Insights Card */}
      <Card className="bg-gradient-card shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            產品績效洞察
          </CardTitle>
          <CardDescription>為您產品提供 AI 驅動建議</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-success-light border border-success/20">
              <h4 className="font-semibold text-success-foreground mb-2">最佳表現者</h4>
              <p className="text-sm text-success-foreground/80">
                農場新鮮 A 級雞蛋：85% 回購率，建議增產 20%
              </p>
            </div>
            <div className="p-4 rounded-lg bg-accent-light border border-accent/20">
              <h4 className="font-semibold mb-2">市場機會</h4>
              <p className="text-sm opacity-80">
                鴨蛋在有機市場顯示 40% 價格溢價機會
              </p>
            </div>
            <div className="p-4 rounded-lg bg-primary-lighter border border-primary/20">
              <h4 className="font-semibold text-primary mb-2">季節趨勢</h4>
              <p className="text-sm text-primary/80">
                節日烘焙季即將到來 - 預期需求增加 30%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductManagement;
