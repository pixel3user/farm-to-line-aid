import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  PenTool, 
  Camera, 
  Download, 
  Share,
  FileText,
  Image,
  Layout,
  Wand2,
  Upload,
  Palette,
  Type,
  Settings
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const MarketingTools = () => {
  const [showGenerator, setShowGenerator] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("flyer");
  const { toast } = useToast();

  const templates = [
    {
      id: "flyer",
      name: "產品傳單",
      description: "A4 印刷宣傳傳單",
      preview: "📄",
      category: "印刷"
    },
    {
      id: "card",
      name: "貨架卡",
      description: "小型商店展示產品卡",
      preview: "🏷️",
      category: "印刷"
    },
    {
      id: "recipe",
      name: "食譜卡",
      description: "主打您產品的食譜卡",
      preview: "👨‍🍳",
      category: "印刷"
    },
    {
      id: "social",
      name: "社群媒體貼文",
      description: "Instagram/Facebook 貼文",
      preview: "📱",
      category: "數位"
    },
    {
      id: "onepager",
      name: "單頁介紹",
      description: "全面產品概覽",
      preview: "📋",
      category: "數位"
    }
  ];

  const generatedMaterials = [
    {
      id: 1,
      name: "農場新鮮雞蛋傳單",
      type: "flyer",
      product: "A 級雞蛋",
      createdAt: "2 小時前",
      downloads: 12,
      status: "ready"
    },
    {
      id: 2,
      name: "有機雞蛋食譜卡",
      type: "recipe",
      product: "有機放養雞蛋",
      createdAt: "1 天前",
      downloads: 8,
      status: "ready"
    },
    {
      id: 3,
      name: "鴨蛋貨架卡",
      type: "card",
      product: "優質鴨蛋",
      createdAt: "3 天前",
      downloads: 15,
      status: "ready"
    }
  ];

  const handleGenerateMaterial = () => {
    toast({
      title: "行銷材料生成完成！ 🎨",
      description: "您的 AI 設計行銷材料已準備下載。",
    });
    setShowGenerator(false);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "flyer":
        return <FileText className="h-4 w-4" />;
      case "card":
        return <Layout className="h-4 w-4" />;
      case "recipe":
        return <Image className="h-4 w-4" />;
      default:
        return <PenTool className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">行銷工具</h1>
          <p className="text-muted-foreground mt-1">使用 AI 輔助創建專業行銷材料</p>
        </div>
        <Dialog open={showGenerator} onOpenChange={setShowGenerator}>
          <DialogTrigger asChild>
            <Button variant="hero" className="gap-2">
              <Wand2 className="h-4 w-4" />
              生成行銷材料
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>AI 行銷生成器</DialogTitle>
              <DialogDescription>
                上傳產品照片，讓 AI 創建專業行銷材料
              </DialogDescription>
            </DialogHeader>
            
            <Tabs defaultValue="template" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="template">選擇模板</TabsTrigger>
                <TabsTrigger value="upload">上傳照片</TabsTrigger>
                <TabsTrigger value="customize">自訂</TabsTrigger>
              </TabsList>
              
              <TabsContent value="template" className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {templates.map((template) => (
                    <Card 
                      key={template.id} 
                      className={`cursor-pointer transition-all hover:shadow-medium ${
                        selectedTemplate === template.id ? "ring-2 ring-primary shadow-medium" : ""
                      }`}
                      onClick={() => setSelectedTemplate(template.id)}
                    >
                      <CardContent className="p-4 text-center">
                        <div className="text-4xl mb-2">{template.preview}</div>
                        <h3 className="font-semibold">{template.name}</h3>
                        <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
                        <Badge variant="outline" className="mt-2">
                          {template.category}
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="upload" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <Label>產品照片</Label>
                      <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                        <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-sm text-muted-foreground mb-2">
                          將產品照片拖放到此處
                        </p>
                        <Button variant="outline" size="sm">選擇檔案</Button>
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="product">選擇產品</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="選擇產品" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="grade-a">農場新鮮 A 級雞蛋</SelectItem>
                          <SelectItem value="organic">有機放養雞蛋</SelectItem>
                          <SelectItem value="duck">優質鴨蛋</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="title">行銷標題</Label>
                      <Input id="title" placeholder="從我們農場新鮮到您餐桌" />
                    </div>
                    
                    <div>
                      <Label htmlFor="description">描述</Label>
                      <Textarea 
                        id="description" 
                        placeholder="描述您產品的特殊之處..."
                        className="min-h-[100px]"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="price">價格</Label>
                        <Input id="price" placeholder="NT$180" />
                      </div>
                      <div>
                        <Label htmlFor="unit">單位</Label>
                        <Input id="unit" placeholder="每 30 顆裝" />
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="customize" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Palette className="h-4 w-4" />
                      顏色
                    </h4>
                    <div className="grid grid-cols-4 gap-2">
                      {["bg-primary", "bg-secondary", "bg-accent", "bg-success"].map((color, i) => (
                        <div key={i} className={`w-8 h-8 rounded ${color} cursor-pointer hover:scale-110 transition-transform`} />
                      ))}
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Type className="h-4 w-4" />
                      字型
                    </h4>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="字型樣式" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="modern">現代無襯線</SelectItem>
                        <SelectItem value="classic">經典有襯線</SelectItem>
                        <SelectItem value="friendly">友善圓體</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-4">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      佈局
                    </h4>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="佈局樣式" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minimal">簡約</SelectItem>
                        <SelectItem value="detailed">詳細</SelectItem>
                        <SelectItem value="bold">粗體鮮明</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="mt-6 p-4 rounded-lg bg-accent-light border border-accent/20">
                  <h4 className="font-semibold mb-2">AI 預覽</h4>
                  <p className="text-sm opacity-80 mb-3">
                    您的 {templates.find(t => t.id === selectedTemplate)?.name} 將使用以下特點生成：
                  </p>
                  <ul className="text-sm space-y-1 opacity-80">
                    <li>• 專業產品攝影增強</li>
                    <li>• 雙語文字（中文/英文）優化</li>
                    <li>• 品牌一致的配色方案</li>
                    <li>• 印刷就緒的高解析度輸出</li>
                  </ul>
                </div>
              </TabsContent>
            </Tabs>
            
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowGenerator(false)}>
                取消
              </Button>
              <Button variant="hero" onClick={handleGenerateMaterial}>
                <Wand2 className="h-4 w-4 mr-2" />
                使用 AI 生成
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Generated Materials */}
      <Card className="bg-gradient-card shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PenTool className="h-5 w-5 text-primary" />
            您的行銷材料
          </CardTitle>
          <CardDescription>最近生成的可使用材料</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {generatedMaterials.map((material) => (
              <Card key={material.id} className="bg-background/50 hover:shadow-medium transition-all">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {getTypeIcon(material.type)}
                      <h3 className="font-semibold text-sm">{material.name}</h3>
                    </div>
                    <Badge variant="outline" className="text-xs">就緒</Badge>
                  </div>
                  
                  {/* Preview Area */}
                  <div className="aspect-[4/3] bg-gradient-primary/10 rounded-lg flex items-center justify-center mb-4 border border-primary/20">
                    <div className="text-center">
                      <FileText className="h-8 w-8 text-primary/40 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">預覽</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <p>產品：{material.product}</p>
                    <p>創建：{material.createdAt}</p>
                    <p>下載：{material.downloads}</p>
                  </div>
                  
                  <div className="flex gap-2 mt-4">
                    <Button size="sm" variant="outline" className="flex-1">
                      <Download className="h-3 w-3 mr-1" />
                      下載
                    </Button>
                    <Button size="sm" variant="ghost">
                      <Share className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Marketing Tips */}
      <Card className="bg-gradient-card shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            AI 行銷洞察
          </CardTitle>
          <CardDescription>個人化建議提升您的行銷效果</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-success-light border border-success/20">
              <h4 className="font-semibold text-success-foreground mb-2">最佳表現內容</h4>
              <p className="text-sm text-success-foreground/80 mb-3">
                食譜卡的參與度比標準傳單高 73%。考慮創建更多食譜內容。
              </p>
              <Button size="sm" variant="success">創建食譜卡</Button>
            </div>
            
            <div className="p-4 rounded-lg bg-accent-light border border-accent/20">
              <h4 className="font-semibold mb-2">季節機會</h4>
              <p className="text-sm opacity-80 mb-3">
                節日烘焙季即將到來。創建以您雞蛋為主角的節日主題食譜卡。
              </p>
              <Button size="sm" variant="outline">生成節日內容</Button>
            </div>
            
            <div className="p-4 rounded-lg bg-warning-light border border-warning/20">
              <h4 className="font-semibold text-warning-foreground mb-2">語言優化</h4>
              <p className="text-sm text-warning-foreground/80 mb-3">
                添加英文翻譯使商店興趣增加 45%。確保所有材料都是雙語的。
              </p>
              <Button size="sm" variant="warning">更新材料</Button>
            </div>
            
            <div className="p-4 rounded-lg bg-primary-lighter border border-primary/20">
              <h4 className="font-semibold text-primary mb-2">攝影品質建議</h4>
              <p className="text-sm text-primary/80 mb-3">
                自然光照片表現好 2 倍。在黃金時段拍攝可獲得最佳效果。
              </p>
              <Button size="sm" variant="outline">攝影指南</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MarketingTools;