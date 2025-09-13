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
        {/* Large Event Card */}
        <div className="relative">
          <div className="absolute top-2 right-2 text-xs text-gray-500">5:39 pm</div>
          <div className="bg-black rounded-2xl overflow-hidden">
            <div className="relative h-48 bg-gradient-to-br from-blue-900 via-blue-800 to-teal-600">
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                <div className="text-4xl font-bold mb-1">09.19</div>
                <div className="text-sm tracking-wider">FRIDAY</div>
              </div>
              <div className="absolute bottom-4 left-4 right-4">
                <div className="flex justify-center space-x-2 mb-3">
                  {Array.from({length: 6}).map((_, i) => (
                    <div key={i} className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center text-xs text-black font-bold">
                      {String(i + 1).padStart(2, '0')}
                    </div>
                  ))}
                </div>
                <div className="text-xs text-white/80 text-center">
                  7F, NO.12 SONGSHOU RD.,XINYI DIST.,TAIPEI CITY 110, TAIWAN(R.O.C.)
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bot Avatar and Card */}
        <div className="flex items-start gap-2">
          <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            AI
          </div>
          <div className="flex-1">
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm max-w-xs">
              <div className="relative h-40 bg-gradient-to-r from-blue-400 to-teal-400">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-white">
                    <div className="text-3xl font-bold mb-2">SON OF SON</div>
                    <div className="text-xs opacity-90">AFTERLIFE SIAMESE MELODIC TECHNO THE GREAT BLONDINO</div>
                  </div>
                </div>
                <div className="absolute bottom-4 right-4 w-16 h-16">
                  <img 
                    src="/api/placeholder/64/64" 
                    alt="Person floating in water"
                    className="w-full h-full object-cover rounded"
                  />
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Badge className="bg-green-500 text-white text-xs px-2 py-1">免費</Badge>
                </div>
                <div className="text-sm font-medium text-gray-900 mb-2">
                  09.12 (FRI) SON OF SON = ...
                </div>
                <div className="flex justify-between items-center text-xs text-gray-500 mb-4">
                  <span>有效期間</span>
                  <span>2025/09/13</span>
                </div>
                <Button className="w-full bg-green-500 hover:bg-green-600 text-white rounded-lg py-3">
                  查看優惠券
                </Button>
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-1 ml-2">5:39 pm</div>
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