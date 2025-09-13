import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft,
  Search,
  Menu,
  MoreHorizontal,
  Plus,
  Camera,
  Image,
  Mic,
  Smile
} from "lucide-react";

const LineBotDemo = () => {
  return (
    <div className="max-w-md mx-auto bg-white shadow-2xl overflow-hidden h-[700px] flex flex-col">
      {/* Status Bar */}
      <div className="bg-gray-100 px-4 py-1 flex justify-between items-center text-xs text-gray-600">
        <span>2:58</span>
        <div className="flex gap-1">
          <span>🔇</span>
          <span>📶</span>
          <span>🔋</span>
          <span>25</span>
        </div>
      </div>

      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ArrowLeft className="w-5 h-5" />
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">★</span>
          </div>
          <span className="font-medium text-gray-900">Farm2Market AI</span>
        </div>
        <div className="flex gap-4">
          <Search className="w-5 h-5 text-gray-600" />
          <Menu className="w-5 h-5 text-gray-600" />
          <MoreHorizontal className="w-5 h-5 text-gray-600" />
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 bg-gray-50 p-4 space-y-4 overflow-y-auto">
        {/* Welcome Message */}
        <div className="flex items-start gap-2">
          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            AI
          </div>
          <div className="flex-1">
            <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm max-w-xs">
              <div className="text-sm text-gray-900">
                🌾 歡迎使用 Farm2Market AI！
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-1 ml-2">10:30 am</div>
          </div>
        </div>

        {/* Bot Menu Message */}
        <div className="flex items-start gap-2">
          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            AI
          </div>
          <div className="flex-1">
            <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm max-w-xs">
              <div className="text-sm text-gray-900 mb-3">
                您的智慧農業銷售助理已啟動。選擇功能：
              </div>
              <div className="space-y-2">
                <Button className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm py-2 rounded-lg justify-start">
                  📦 管理產品
                </Button>
                <Button className="w-full bg-orange-50 hover:bg-orange-100 text-orange-700 text-sm py-2 rounded-lg justify-start">
                  🤝 查看交易
                </Button>
                <Button className="w-full bg-purple-50 hover:bg-purple-100 text-purple-700 text-sm py-2 rounded-lg justify-start">
                  📈 行銷工具
                </Button>
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-1 ml-2">10:30 am</div>
          </div>
        </div>

        {/* User Selection */}
        <div className="flex justify-end">
          <div className="bg-blue-500 text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-xs">
            <div className="text-sm">📦 管理產品</div>
          </div>
        </div>
        <div className="flex justify-end">
          <div className="text-xs text-gray-500 mr-2">10:31 am</div>
        </div>

        {/* Product Management Response */}
        <div className="flex items-start gap-2">
          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            AI
          </div>
          <div className="flex-1">
            <div className="bg-white rounded-2xl rounded-tl-sm overflow-hidden shadow-sm max-w-xs">
              <div className="p-4">
                <div className="text-sm font-medium text-gray-900 mb-3">
                  📦 您的產品庫存
                </div>
                <div className="space-y-3">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-sm">新鮮雞蛋</span>
                      <Badge className="bg-green-100 text-green-800 text-xs">充足</Badge>
                    </div>
                    <div className="text-xs text-gray-600">庫存: 150箱 | 價格: NT$180/箱</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-sm">有機雞蛋</span>
                      <Badge className="bg-yellow-100 text-yellow-800 text-xs">偏低</Badge>
                    </div>
                    <div className="text-xs text-gray-600">庫存: 25箱 | 價格: NT$280/箱</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <Button className="bg-blue-500 hover:bg-blue-600 text-white text-xs py-2 rounded-lg">
                    新增產品
                  </Button>
                  <Button className="bg-green-500 hover:bg-green-600 text-white text-xs py-2 rounded-lg">
                    更新庫存
                  </Button>
                </div>
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-1 ml-2">10:31 am</div>
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-white border-t px-4 py-3 flex items-center gap-3">
        <Plus className="w-6 h-6 text-gray-600" />
        <Camera className="w-6 h-6 text-gray-600" />
        <Image className="w-6 h-6 text-gray-600" />
        <div className="flex-1 h-1 border-l border-gray-300"></div>
        <Smile className="w-6 h-6 text-gray-600" />
        <Mic className="w-6 h-6 text-gray-600" />
      </div>

      {/* Bottom Navigation */}
      <div className="bg-white border-t flex justify-center">
        <div className="flex gap-16 py-2">
          <div className="w-8 h-1 bg-gray-300 rounded-full"></div>
          <div className="w-8 h-8 border border-gray-300 rounded-full"></div>
          <div className="w-8 h-8 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LineBotDemo;