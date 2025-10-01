import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { LogIn, Smartphone } from 'lucide-react';

const LoginButton: React.FC = () => {
  const { login, isInLineApp, isLiffReady } = useAuth();

  if (!isLiffReady) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">正在初始化...</p>
        </div>
      </div>
    );
  }

  if (!isInLineApp) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Smartphone className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Farm2Market AI</CardTitle>
            <CardDescription>
              智慧農業銷售助理
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center text-sm text-muted-foreground">
              <p>此應用程式專為 LINE 環境設計</p>
              <p>您也可以使用演示模式體驗功能</p>
            </div>
            
            <Button 
              onClick={login} 
              className="w-full" 
              size="lg"
              variant="outline"
            >
              <LogIn className="w-4 h-4 mr-2" />
              使用演示模式
            </Button>
            
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">完整功能請使用 LINE：</h4>
              <ol className="text-sm text-blue-800 space-y-1">
                <li>1. 在 LINE 中搜尋 Farm2Market AI Bot</li>
                <li>2. 加入好友並開始對話</li>
                <li>3. 點擊 Bot 提供的連結</li>
                <li>4. 自動登入並使用完整功能</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <LogIn className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">歡迎使用 Farm2Market AI</CardTitle>
          <CardDescription>
            您的智慧農業銷售助理
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={login} 
            className="w-full" 
            size="lg"
          >
            <LogIn className="w-4 h-4 mr-2" />
            使用 LINE 登入 / 演示模式
          </Button>
          
          <div className="text-center text-sm text-muted-foreground">
            <p>登入後即可使用：</p>
            <ul className="mt-2 space-y-1">
              <li>• 產品管理與庫存追蹤</li>
              <li>• AI 行銷素材生成</li>
              <li>• 客戶關係管理</li>
              <li>• 銷售數據分析</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginButton;
