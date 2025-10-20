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
import { useLanguage } from "@/contexts/LanguageContext";
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
  Settings,
  TrendingUp,
  Calendar
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { DatabaseService } from "@/lib/database";
import marketingImage1 from "@/assets/sample_img/Gemini_Generated_Image_qikttnqikttnqikt (4).png";
import marketingImage2 from "@/assets/sample_img/Gemini_Generated_Image_qikttnqikttnqikt (5).png";
import marketingImage3 from "@/assets/sample_img/Gemini_Generated_Image_qikttnqikttnqikt.png";

const MarketingTools = () => {
  const { t } = useLanguage();
  const [showGenerator, setShowGenerator] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("flyer");
  const { toast } = useToast();
  const { user, userMarketingMaterials, userProducts, refreshUserData } = useAuth();

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

  // Use real user marketing materials from database
  const generatedMaterials = userMarketingMaterials.map(material => ({
    id: material.id,
    name: material.title,
    type: material.type === 'flyer' ? 'flyer' : 
          material.type === 'shelf_card' ? 'card' :
          material.type === 'recipe_card' ? 'recipe' : 'social',
    product: userProducts.find(p => p.id === material.productId)?.name || "未指定產品",
    createdAt: material.createdAt ? "2 小時前" : "剛剛", // This would be formatted from timestamp
    downloads: material.usage?.timesUsed || 0,
    status: material.isActive ? "ready" : "draft",
    previewImage: marketingImage1 // Default image
  }));

  const handleGenerateMaterial = async (materialData: any) => {
    try {
      if (!user) return;
      
      await DatabaseService.createMarketingMaterial(user.id, materialData);
      await refreshUserData();
      
      toast({
        title: "行銷材料生成完成！ 🎨",
        description: "您的 AI 設計行銷材料已準備下載。",
      });
      setShowGenerator(false);
    } catch (error) {
      console.error('Failed to create marketing material:', error);
      toast({
        title: "生成失敗",
        description: "請稍後再試。",
        variant: "destructive"
      });
    }
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
    <div className="space-y-8">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-orange-500 via-orange-600 to-orange-700 rounded-2xl p-8 text-white shadow-xl">
        <div className="flex items-center justify-between">
          <div className="space-y-3">
            <h1 className="text-3xl font-bold">{t('farmer.marketing.title')}</h1>
            <p className="text-orange-100 text-lg">{t('farmer.marketing.subtitle')}</p>
            <div className="flex items-center space-x-6 text-sm">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-orange-300 rounded-full mr-2"></div>
                <span>{generatedMaterials.length} {t('farmer.marketing.materials')}</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-300 rounded-full mr-2"></div>
                <span>{generatedMaterials.reduce((sum, m) => sum + m.downloads, 0)} {t('farmer.marketing.downloads')}</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-blue-300 rounded-full mr-2"></div>
                <span>{t('farmer.marketing.aiPowered')}</span>
              </div>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center">
              <Wand2 className="w-12 h-12 text-white" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{t('farmer.marketing.marketingMaterials')}</h2>
          <p className="text-gray-600">
            {generatedMaterials.length > 0 ? t('farmer.marketing.useAiDescription') : t('farmer.marketing.startCreating')}
          </p>
        </div>
        <Dialog open={showGenerator} onOpenChange={setShowGenerator}>
          <DialogTrigger asChild>
            <Button size="lg" className="bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 shadow-lg gap-2">
              <Wand2 className="h-5 w-5" />
              {t('farmer.marketing.generateMaterial')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>{t('farmer.marketing.aiGenerator')}</DialogTitle>
              <DialogDescription>
                {t('farmer.marketing.uploadPhotos')}
              </DialogDescription>
            </DialogHeader>
            
            <Tabs defaultValue="template" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="template">{t('farmer.marketing.selectTemplate')}</TabsTrigger>
                <TabsTrigger value="upload">{t('farmer.marketing.uploadPhotos')}</TabsTrigger>
                <TabsTrigger value="customize">{t('farmer.marketing.customize')}</TabsTrigger>
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
                      <Label>{t('farmer.marketing.productPhotos')}</Label>
                      <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                        <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-sm text-muted-foreground mb-2">
                          {t('farmer.marketing.dragDropPhotos')}
                        </p>
                        <Button variant="outline" size="sm">{t('farmer.marketing.selectFile')}</Button>
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="product">{t('farmer.marketing.selectProduct')}</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder={t('farmer.marketing.selectProduct')} />
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
                      <Label htmlFor="title">{t('farmer.marketing.marketingTitle')}</Label>
                      <Input id="title" placeholder={t('farmer.marketing.fromFarmToTable')} />
                    </div>
                    
                    <div>
                      <Label htmlFor="description">{t('farmer.marketing.description')}</Label>
                      <Textarea 
                        id="description" 
                        placeholder={t('farmer.marketing.describeSpecial')}
                        className="min-h-[100px]"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="price">{t('farmer.marketing.price')}</Label>
                        <Input id="price" placeholder="NT$180" />
                      </div>
                      <div>
                        <Label htmlFor="unit">{t('farmer.marketing.unit')}</Label>
                        <Input id="unit" placeholder={t('farmer.marketing.per30Pack')} />
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
                      {t('farmer.marketing.colors')}
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
                      {t('farmer.marketing.fonts')}
                    </h4>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder={t('farmer.marketing.fontStyle')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="modern">{t('farmer.marketing.modernSans')}</SelectItem>
                        <SelectItem value="classic">{t('farmer.marketing.classicSerif')}</SelectItem>
                        <SelectItem value="friendly">{t('farmer.marketing.friendlyRounded')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-4">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      {t('farmer.marketing.layout')}
                    </h4>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder={t('farmer.marketing.layoutStyle')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minimal">{t('farmer.marketing.minimal')}</SelectItem>
                        <SelectItem value="detailed">{t('farmer.marketing.detailed')}</SelectItem>
                        <SelectItem value="bold">{t('farmer.marketing.bold')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="mt-6 p-4 rounded-lg bg-accent-light border border-accent/20">
                  <h4 className="font-semibold mb-2">{t('farmer.marketing.aiPreview')}</h4>
                  <p className="text-sm opacity-80 mb-3">
                    {t('farmer.marketing.willGenerate', { templateName: templates.find(t => t.id === selectedTemplate)?.name })}
                  </p>
                  <ul className="text-sm space-y-1 opacity-80">
                    <li>• {t('farmer.marketing.professionalEnhancement')}</li>
                    <li>• {t('farmer.marketing.bilingualOptimization')}</li>
                    <li>• {t('farmer.marketing.brandConsistent')}</li>
                    <li>• {t('farmer.marketing.printReady')}</li>
                  </ul>
                </div>
              </TabsContent>
            </Tabs>
            
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowGenerator(false)}>
                {t('farmer.marketing.cancel')}
              </Button>
              <Button variant="hero" onClick={handleGenerateMaterial}>
                <Wand2 className="h-4 w-4 mr-2" />
                {t('farmer.marketing.generateWithAi')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Generated Materials */}
      <Card className="shadow-lg border-0">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center text-xl">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center mr-3">
              <PenTool className="h-5 w-5 text-orange-600" />
            </div>
            {t('farmer.marketing.yourMaterials')}
          </CardTitle>
          <CardDescription className="text-base">{t('farmer.marketing.recentlyGenerated')}</CardDescription>
        </CardHeader>
        <CardContent>
          {generatedMaterials.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {generatedMaterials.map((material) => (
              <Card key={material.id} className="group hover:shadow-xl transition-all duration-300 border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                        {getTypeIcon(material.type)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{material.name}</h3>
                        <p className="text-xs text-gray-500">{material.product}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                      {t('farmer.marketing.ready')}
                    </Badge>
                  </div>
                  
                  {/* Preview Area */}
                  <div className="aspect-[4/3] bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl overflow-hidden mb-4 border-2 border-orange-100 group-hover:border-orange-200 transition-colors">
                    <img 
                      src={material.previewImage} 
                      alt={`${material.name} preview`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  
                  <div className="space-y-2 text-sm text-gray-600 mb-4">
                    <div className="flex items-center justify-between">
                      <span>{t('farmer.marketing.created')}</span>
                      <span className="font-medium">{material.createdAt}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>{t('farmer.marketing.downloads')}</span>
                      <span className="font-medium text-orange-600">{material.downloads}</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1 hover:bg-orange-50 hover:border-orange-200">
                      <Download className="h-4 w-4 mr-2" />
                      {t('farmer.marketing.download')}
                    </Button>
                    <Button size="sm" variant="ghost" className="hover:bg-orange-50">
                      <Share className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-orange-100 to-orange-200 rounded-full flex items-center justify-center">
                <PenTool className="w-12 h-12 text-orange-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">{t('farmer.marketing.noMaterialsYet')}</h3>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">{t('farmer.marketing.useAiToGenerate')}</p>
              <Button onClick={() => setShowGenerator(true)} size="lg" className="bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 gap-2">
                <Wand2 className="w-5 h-5" />
                {t('farmer.marketing.generateFirst')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Marketing Tips */}
      <Card className="shadow-lg border-0">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center text-xl">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
              <Wand2 className="h-5 w-5 text-blue-600" />
            </div>
            {t('farmer.marketing.aiInsights')}
          </CardTitle>
          <CardDescription className="text-base">{t('farmer.marketing.personalizedRecommendations')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-xl bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 hover:border-green-300 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <h4 className="font-bold text-green-800">{t('farmer.marketing.topPerformingContent')}</h4>
              </div>
              <p className="text-sm text-green-700 mb-4">
                {t('farmer.marketing.recipeCardsEngagement')}
              </p>
              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white">
                {t('farmer.marketing.createRecipeCard')}
              </Button>
            </div>
            
            <div className="p-6 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 hover:border-blue-300 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <h4 className="font-bold text-blue-800">{t('farmer.marketing.seasonalOpportunity')}</h4>
              </div>
              <p className="text-sm text-blue-700 mb-4">
                {t('farmer.marketing.holidayBakingSeason')}
              </p>
              <Button size="sm" variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50">
                {t('farmer.marketing.generateHolidayContent')}
              </Button>
            </div>
            
            <div className="p-6 rounded-xl bg-gradient-to-br from-yellow-50 to-yellow-100 border-2 border-yellow-200 hover:border-yellow-300 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-yellow-500 rounded-lg flex items-center justify-center">
                  <Type className="w-5 h-5 text-white" />
                </div>
                <h4 className="font-bold text-yellow-800">{t('farmer.marketing.languageOptimization')}</h4>
              </div>
              <p className="text-sm text-yellow-700 mb-4">
                {t('farmer.marketing.englishTranslations')}
              </p>
              <Button size="sm" className="bg-yellow-600 hover:bg-yellow-700 text-white">
                {t('farmer.marketing.updateMaterials')}
              </Button>
            </div>
            
            <div className="p-6 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 hover:border-purple-300 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                  <Camera className="w-5 h-5 text-white" />
                </div>
                <h4 className="font-bold text-purple-800">{t('farmer.marketing.photographyQuality')}</h4>
              </div>
              <p className="text-sm text-purple-700 mb-4">
                {t('farmer.marketing.naturalLightPhotos')}
              </p>
              <Button size="sm" variant="outline" className="border-purple-300 text-purple-700 hover:bg-purple-50">
                {t('farmer.marketing.photographyGuide')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MarketingTools;