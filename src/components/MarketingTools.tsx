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
      name: "Product Flyer",
      description: "A4 promotional flyer for print distribution",
      preview: "📄",
      category: "print"
    },
    {
      id: "card",
      name: "Shelf Card",
      description: "Small product card for store displays",
      preview: "🏷️",
      category: "print"
    },
    {
      id: "recipe",
      name: "Recipe Card",
      description: "Recipe card featuring your products",
      preview: "👨‍🍳",
      category: "print"
    },
    {
      id: "social",
      name: "Social Media Post",
      description: "Instagram/Facebook ready post",
      preview: "📱",
      category: "digital"
    },
    {
      id: "onepager",
      name: "One-Pager",
      description: "Comprehensive product overview",
      preview: "📋",
      category: "digital"
    }
  ];

  const generatedMaterials = [
    {
      id: 1,
      name: "Farm Fresh Eggs Flyer",
      type: "flyer",
      product: "Grade A Eggs",
      createdAt: "2 hours ago",
      downloads: 12,
      status: "ready"
    },
    {
      id: 2,
      name: "Organic Eggs Recipe Card",
      type: "recipe",
      product: "Organic Free-Range Eggs",
      createdAt: "1 day ago",
      downloads: 8,
      status: "ready"
    },
    {
      id: 3,
      name: "Duck Eggs Shelf Card",
      type: "card",
      product: "Duck Eggs Premium",
      createdAt: "3 days ago",
      downloads: 15,
      status: "ready"
    }
  ];

  const handleGenerateMaterial = () => {
    toast({
      title: "Marketing Material Generated! 🎨",
      description: "Your AI-designed marketing material is ready for download.",
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
          <h1 className="text-3xl font-bold text-foreground">Marketing Tools</h1>
          <p className="text-muted-foreground mt-1">Create professional marketing materials with AI assistance</p>
        </div>
        <Dialog open={showGenerator} onOpenChange={setShowGenerator}>
          <DialogTrigger asChild>
            <Button variant="hero" className="gap-2">
              <Wand2 className="h-4 w-4" />
              Generate Marketing Material
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>AI Marketing Generator</DialogTitle>
              <DialogDescription>
                Upload a product photo and let AI create professional marketing materials
              </DialogDescription>
            </DialogHeader>
            
            <Tabs defaultValue="template" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="template">Choose Template</TabsTrigger>
                <TabsTrigger value="upload">Upload Photo</TabsTrigger>
                <TabsTrigger value="customize">Customize</TabsTrigger>
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
                      <Label>Product Photo</Label>
                      <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                        <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-sm text-muted-foreground mb-2">
                          Drop your product photo here
                        </p>
                        <Button variant="outline" size="sm">Choose File</Button>
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="product">Select Product</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose product" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="grade-a">Farm Fresh Grade A Eggs</SelectItem>
                          <SelectItem value="organic">Organic Free-Range Eggs</SelectItem>
                          <SelectItem value="duck">Duck Eggs Premium</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="title">Marketing Title</Label>
                      <Input id="title" placeholder="Fresh from our farm to your table" />
                    </div>
                    
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea 
                        id="description" 
                        placeholder="Describe what makes your product special..."
                        className="min-h-[100px]"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="price">Price</Label>
                        <Input id="price" placeholder="NT$180" />
                      </div>
                      <div>
                        <Label htmlFor="unit">Unit</Label>
                        <Input id="unit" placeholder="per 30-egg tray" />
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
                      Colors
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
                      Typography
                    </h4>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Font style" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="modern">Modern Sans</SelectItem>
                        <SelectItem value="classic">Classic Serif</SelectItem>
                        <SelectItem value="friendly">Friendly Round</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-4">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Layout
                    </h4>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Layout style" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minimal">Minimal</SelectItem>
                        <SelectItem value="detailed">Detailed</SelectItem>
                        <SelectItem value="bold">Bold & Vibrant</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="mt-6 p-4 rounded-lg bg-accent-light border border-accent/20">
                  <h4 className="font-semibold mb-2">AI Preview</h4>
                  <p className="text-sm opacity-80 mb-3">
                    Your {templates.find(t => t.id === selectedTemplate)?.name} will be generated with:
                  </p>
                  <ul className="text-sm space-y-1 opacity-80">
                    <li>• Professional product photography enhancement</li>
                    <li>• Bilingual text (Chinese/English) optimization</li>
                    <li>• Brand-consistent color scheme</li>
                    <li>• Print-ready high resolution output</li>
                  </ul>
                </div>
              </TabsContent>
            </Tabs>
            
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowGenerator(false)}>
                Cancel
              </Button>
              <Button variant="hero" onClick={handleGenerateMaterial}>
                <Wand2 className="h-4 w-4 mr-2" />
                Generate with AI
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
            Your Marketing Materials
          </CardTitle>
          <CardDescription>Recently generated materials ready for use</CardDescription>
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
                    <Badge variant="outline" className="text-xs">Ready</Badge>
                  </div>
                  
                  {/* Preview Area */}
                  <div className="aspect-[4/3] bg-gradient-primary/10 rounded-lg flex items-center justify-center mb-4 border border-primary/20">
                    <div className="text-center">
                      <FileText className="h-8 w-8 text-primary/40 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">Preview</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <p>Product: {material.product}</p>
                    <p>Created: {material.createdAt}</p>
                    <p>Downloads: {material.downloads}</p>
                  </div>
                  
                  <div className="flex gap-2 mt-4">
                    <Button size="sm" variant="outline" className="flex-1">
                      <Download className="h-3 w-3 mr-1" />
                      Download
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
            AI Marketing Insights
          </CardTitle>
          <CardDescription>Personalized tips to improve your marketing effectiveness</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-success-light border border-success/20">
              <h4 className="font-semibold text-success-foreground mb-2">Best Performing Content</h4>
              <p className="text-sm text-success-foreground/80 mb-3">
                Recipe cards have 73% higher engagement than standard flyers. Consider creating more recipe content.
              </p>
              <Button size="sm" variant="success">Create Recipe Card</Button>
            </div>
            
            <div className="p-4 rounded-lg bg-accent-light border border-accent/20">
              <h4 className="font-semibold mb-2">Seasonal Opportunity</h4>
              <p className="text-sm opacity-80 mb-3">
                Holiday baking season is approaching. Create holiday-themed recipe cards featuring your eggs.
              </p>
              <Button size="sm" variant="outline">Generate Holiday Content</Button>
            </div>
            
            <div className="p-4 rounded-lg bg-warning-light border border-warning/20">
              <h4 className="font-semibold text-warning-foreground mb-2">Language Optimization</h4>
              <p className="text-sm text-warning-foreground/80 mb-3">
                Adding English translations increased store interest by 45%. Ensure all materials are bilingual.
              </p>
              <Button size="sm" variant="warning">Update Materials</Button>
            </div>
            
            <div className="p-4 rounded-lg bg-primary-lighter border border-primary/20">
              <h4 className="font-semibold text-primary mb-2">Photo Quality Tip</h4>
              <p className="text-sm text-primary/80 mb-3">
                Natural lighting photos perform 2x better. Take photos during golden hour for best results.
              </p>
              <Button size="sm" variant="outline">Photo Guidelines</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MarketingTools;