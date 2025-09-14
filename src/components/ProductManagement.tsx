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
import eggImage1 from "@/assets/sample_img/Gemini_Generated_Image_qikttnqikttnqikt (1).png";
import eggImage2 from "@/assets/sample_img/Gemini_Generated_Image_qikttnqikttnqikt (2).png";
import eggImage3 from "@/assets/sample_img/Gemini_Generated_Image_qikttnqikttnqikt (3).png";

const ProductManagement = () => {
  const [showAddProduct, setShowAddProduct] = useState(false);
  const { toast } = useToast();

  const products = [
    {
      id: 1,
      name: "農場新鮮 A 級雞蛋",
      category: "雞蛋",
      price: "NT$180",
      unit: "每 30 顆裝",
      stock: 45,
      minStock: 10,
      status: "active",
      lastOrder: "2 天前",
      totalSold: "1,250 盒",
      image: eggImage1
    },
    {
      id: 2,
      name: "有機放養雞蛋",
      category: "雞蛋",
      price: "NT$280",
      unit: "每 30 顆裝",
      stock: 8,
      minStock: 15,
      status: "low_stock",
      lastOrder: "5 天前",
      totalSold: "420 盒",
      image: eggImage2
    },
    {
      id: 3,
      name: "優質鴨蛋",
      category: "鴨蛋",
      price: "NT$320",
      unit: "每 20 顆裝",
      stock: 22,
      minStock: 5,
      status: "active",
      lastOrder: "1 天前",
      totalSold: "180 盒",
      image: eggImage3
    }
  ];

  const handleAddProduct = () => {
    toast({
      title: "產品新增成功！ 🎉",
      description: "您的新產品已新增，AI 行銷材料正在生成中。",
    });
    setShowAddProduct(false);
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
          <p className="text-muted-foreground mt-1">管理您的農場產品和庫存</p>
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