import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  ArrowLeft,
  Search,
  Menu,
  MoreHorizontal,
  Plus,
  Camera,
  Image,
  Mic,
  Smile,
  Bot,
  MessageCircle,
  TrendingUp,
  Package,
  Store,
  BarChart3,
  Sparkles,
  Send,
  Phone,
  MapPin,
  Star
} from "lucide-react";

const LineBotDemo = () => {
  const [currentView, setCurrentView] = useState<'chat' | 'menu'>('chat');
  const [selectedAction, setSelectedAction] = useState<string>('');

  return (
    <div className="max-w-md mx-auto bg-white shadow-2xl overflow-hidden h-[700px] flex flex-col rounded-2xl">
      {/* Enhanced Status Bar */}
      <div className="bg-gradient-to-r from-green-500 to-green-600 px-4 py-2 flex justify-between items-center text-xs text-white">
        <span className="font-medium">2:58</span>
        <div className="flex gap-1">
          <span>🔇</span>
          <span>📶</span>
          <span>🔋</span>
          <span>25%</span>
        </div>
      </div>

      {/* Enhanced Header */}
      <div className="bg-gradient-to-r from-green-50 to-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-lg">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-semibold text-gray-900">Farm2Market AI</span>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-xs text-green-600">Online</span>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Search className="w-5 h-5 text-gray-600 hover:text-green-600 transition-colors" />
          <Menu className="w-5 h-5 text-gray-600 hover:text-green-600 transition-colors" />
          <MoreHorizontal className="w-5 h-5 text-gray-600 hover:text-green-600 transition-colors" />
        </div>
      </div>

      {/* Enhanced Chat Area */}
      <div className="flex-1 bg-gradient-to-b from-gray-50 to-gray-100 p-4 space-y-4 overflow-y-auto">
        {/* Welcome Message */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-lg flex-shrink-0">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-lg max-w-xs border border-green-100">
              <div className="text-sm text-gray-900 font-medium">
                🌾 歡迎使用 Farm2Market AI！
              </div>
              <div className="text-xs text-gray-600 mt-1">
                您的智慧農業銷售助理已啟動
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-1 ml-2">10:30 am</div>
          </div>
        </div>

        {/* Enhanced Bot Menu Message */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-lg flex-shrink-0">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-lg max-w-xs border border-green-100">
              <div className="text-sm text-gray-900 mb-3 font-medium">
                選擇您需要的功能：
              </div>
              <div className="space-y-2">
                <Button 
                  className="w-full bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 text-blue-700 text-sm py-2 rounded-lg justify-start border border-blue-200"
                  onClick={() => setSelectedAction('products')}
                >
                  <Package className="w-4 h-4 mr-2" />
                  管理產品
                </Button>
                <Button 
                  className="w-full bg-gradient-to-r from-orange-50 to-orange-100 hover:from-orange-100 hover:to-orange-200 text-orange-700 text-sm py-2 rounded-lg justify-start border border-orange-200"
                  onClick={() => setSelectedAction('stores')}
                >
                  <Store className="w-4 h-4 mr-2" />
                  尋找店家
                </Button>
                <Button 
                  className="w-full bg-gradient-to-r from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 text-purple-700 text-sm py-2 rounded-lg justify-start border border-purple-200"
                  onClick={() => setSelectedAction('marketing')}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  行銷工具
                </Button>
                <Button 
                  className="w-full bg-gradient-to-r from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 text-green-700 text-sm py-2 rounded-lg justify-start border border-green-200"
                  onClick={() => setSelectedAction('analytics')}
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  數據分析
                </Button>
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-1 ml-2">10:30 am</div>
          </div>
        </div>

        {/* User Selection */}
        <div className="flex justify-end">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-xs shadow-lg">
            <div className="text-sm font-medium">📦 管理產品</div>
          </div>
        </div>
        <div className="flex justify-end">
          <div className="text-xs text-gray-500 mr-2">10:31 am</div>
        </div>

        {/* Enhanced Product Management Response */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-lg flex-shrink-0">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="bg-white rounded-2xl rounded-tl-sm overflow-hidden shadow-lg max-w-xs border border-green-100">
              <div className="bg-gradient-to-r from-green-500 to-green-600 px-4 py-2">
                <div className="text-sm font-semibold text-white flex items-center">
                  <Package className="w-4 h-4 mr-2" />
                  產品庫存概覽
                </div>
              </div>
              <div className="p-4">
                <div className="space-y-3">
                  <div className="bg-gradient-to-r from-green-50 to-white rounded-lg p-3 border border-green-100">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-sm text-gray-900">新鮮雞蛋</span>
                      <Badge className="bg-green-100 text-green-800 text-xs border border-green-200">充足</Badge>
                    </div>
                    <div className="text-xs text-gray-600">庫存: 150箱 | 價格: NT$180/箱</div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                      <div className="bg-green-500 h-1.5 rounded-full" style={{width: '85%'}}></div>
                    </div>
                  </div>
                  <div className="bg-gradient-to-r from-yellow-50 to-white rounded-lg p-3 border border-yellow-100">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-sm text-gray-900">有機雞蛋</span>
                      <Badge className="bg-yellow-100 text-yellow-800 text-xs border border-yellow-200">偏低</Badge>
                    </div>
                    <div className="text-xs text-gray-600">庫存: 25箱 | 價格: NT$280/箱</div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                      <div className="bg-yellow-500 h-1.5 rounded-full" style={{width: '25%'}}></div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <Button className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-xs py-2 rounded-lg shadow-md">
                    <Plus className="w-3 h-3 mr-1" />
                    新增產品
                  </Button>
                  <Button className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white text-xs py-2 rounded-lg shadow-md">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    更新庫存
                  </Button>
                </div>
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-1 ml-2">10:31 am</div>
          </div>
        </div>

        {/* Store Discovery Message */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-lg flex-shrink-0">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="bg-white rounded-2xl rounded-tl-sm overflow-hidden shadow-lg max-w-xs border border-green-100">
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-2">
                <div className="text-sm font-semibold text-white flex items-center">
                  <Store className="w-4 h-4 mr-2" />
                  發現新商機
                </div>
              </div>
              <div className="p-4">
                <div className="space-y-3">
                  <div className="bg-gradient-to-r from-orange-50 to-white rounded-lg p-3 border border-orange-100">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="w-4 h-4 text-orange-600" />
                      <span className="font-medium text-sm text-gray-900">永康市場</span>
                      <Star className="w-3 h-3 text-yellow-500 fill-current" />
                      <span className="text-xs text-gray-500">4.8</span>
                    </div>
                    <div className="text-xs text-gray-600">傳統市場 | 距離: 2.3km</div>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white text-xs px-2 py-1 rounded">
                        <MessageCircle className="w-3 h-3 mr-1" />
                        聯繫
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs px-2 py-1 rounded border-orange-200 text-orange-700">
                        <Phone className="w-3 h-3 mr-1" />
                        電話
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-1 ml-2">10:32 am</div>
          </div>
        </div>
      </div>

      {/* Enhanced Input Area */}
      <div className="bg-white border-t px-4 py-3 flex items-center gap-3">
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" className="w-8 h-8 p-0 hover:bg-green-50">
            <Plus className="w-5 h-5 text-gray-600 hover:text-green-600" />
          </Button>
          <Button size="sm" variant="ghost" className="w-8 h-8 p-0 hover:bg-green-50">
            <Camera className="w-5 h-5 text-gray-600 hover:text-green-600" />
          </Button>
          <Button size="sm" variant="ghost" className="w-8 h-8 p-0 hover:bg-green-50">
            <Image className="w-5 h-5 text-gray-600 hover:text-green-600" />
          </Button>
        </div>
        <div className="flex-1 bg-gray-100 rounded-full px-4 py-2 flex items-center">
          <input 
            type="text" 
            placeholder="輸入訊息..." 
            className="flex-1 bg-transparent text-sm outline-none"
          />
          <Button size="sm" className="w-8 h-8 p-0 bg-green-500 hover:bg-green-600 rounded-full">
            <Send className="w-4 h-4 text-white" />
          </Button>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" className="w-8 h-8 p-0 hover:bg-green-50">
            <Smile className="w-5 h-5 text-gray-600 hover:text-green-600" />
          </Button>
          <Button size="sm" variant="ghost" className="w-8 h-8 p-0 hover:bg-green-50">
            <Mic className="w-5 h-5 text-gray-600 hover:text-green-600" />
          </Button>
        </div>
      </div>

      {/* Enhanced Bottom Navigation */}
      <div className="bg-white border-t px-4 py-2">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button size="sm" variant="ghost" className="flex flex-col items-center gap-1 p-2 hover:bg-green-50">
              <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                <MessageCircle className="w-3 h-3 text-green-600" />
              </div>
              <span className="text-xs text-green-600 font-medium">聊天</span>
            </Button>
            <Button size="sm" variant="ghost" className="flex flex-col items-center gap-1 p-2 hover:bg-gray-50">
              <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                <Package className="w-3 h-3 text-gray-600" />
              </div>
              <span className="text-xs text-gray-500">產品</span>
            </Button>
            <Button size="sm" variant="ghost" className="flex flex-col items-center gap-1 p-2 hover:bg-gray-50">
              <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                <Store className="w-3 h-3 text-gray-600" />
              </div>
              <span className="text-xs text-gray-500">店家</span>
            </Button>
            <Button size="sm" variant="ghost" className="flex flex-col items-center gap-1 p-2 hover:bg-gray-50">
              <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                <BarChart3 className="w-3 h-3 text-gray-600" />
              </div>
              <span className="text-xs text-gray-500">分析</span>
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-xs text-green-600 font-medium">AI 助理</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LineBotDemo;