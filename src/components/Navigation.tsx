import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { 
  Menu, 
  Home, 
  BarChart3, 
  Package, 
  Store, 
  PenTool, 
  Users,
  Settings,
  HelpCircle,
  MessageCircle,
  Brain
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Navigation = ({ activeTab, onTabChange }: NavigationProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "products", label: "Products", icon: Package },
    { id: "stores", label: "Stores", icon: Store },
    { id: "marketing", label: "Marketing", icon: PenTool },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "ai-brain", label: "AI Brain", icon: Brain },
    { id: "buyers", label: "Buyers", icon: Users },
    { id: "line-demo", label: "LINE Demo", icon: MessageCircle },
  ];

  const NavItems = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {menuItems.map((item) => {
        const Icon = item.icon;
        return (
          <Button
            key={item.id}
            variant={activeTab === item.id ? "default" : "ghost"}
            size={mobile ? "default" : "sm"}
            className={cn(
              "justify-start gap-3",
              mobile ? "w-full" : "min-w-[120px]",
              activeTab === item.id && "bg-primary shadow-medium"
            )}
            onClick={() => {
              onTabChange(item.id);
              if (mobile) setIsOpen(false);
            }}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Button>
        );
      })}
    </>
  );

  return (
    <>
      {/* Mobile Navigation */}
      <div className="lg:hidden">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="fixed top-4 left-4 z-50">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 bg-gradient-card">
            <div className="pt-12 space-y-4">
              <div className="px-4">
                <h2 className="text-lg font-semibold text-primary">Farm2Market AI</h2>
                <p className="text-sm text-muted-foreground">Agricultural Sales Assistant</p>
              </div>
              <nav className="space-y-2 px-4">
                <NavItems mobile />
              </nav>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Navigation */}
      <nav className="hidden lg:flex items-center justify-center gap-2 p-4 bg-gradient-card/50 backdrop-blur-sm border-b border-border/50 sticky top-0 z-40">
        <div className="flex items-center gap-4 max-w-6xl w-full">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Package className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-xl font-bold text-primary">Farm2Market AI</h1>
          </div>
          
          <div className="flex-1 flex justify-center">
            <div className="flex gap-2 bg-background/60 rounded-lg p-1 shadow-soft">
              <NavItems />
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="ghost" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <HelpCircle className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </nav>
    </>
  );
};

export default Navigation;