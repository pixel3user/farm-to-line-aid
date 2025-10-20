import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, CheckCircle, AlertCircle } from 'lucide-react';

interface WebhookServerProps {
  lineConfig: {
    channelAccessToken: string;
    channelSecret: string;
    webhookUrl: string;
  };
}

export default function WebhookServer({ lineConfig }: WebhookServerProps) {
  const handleSetWebhook = async () => {
    try {
      const response = await fetch('/api/webhook/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: lineConfig.webhookUrl,
          channelAccessToken: lineConfig.channelAccessToken,
          channelSecret: lineConfig.channelSecret
        })
      });
      
      if (response.ok) {
        alert('Webhook設定成功！');
      } else {
        alert('Webhook設定失敗，請檢查設定。');
      }
    } catch (error) {
      alert('設定過程中發生錯誤');
      console.error(error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Webhook 伺服器設定</h2>
        <Badge variant="secondary">Beta</Badge>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Webhook 端點
            </CardTitle>
            <CardDescription>
              LINE Platform 將透過此端點發送事件到您的應用程式
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Webhook URL</label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 p-2 bg-muted rounded text-sm">
                    {lineConfig.webhookUrl}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigator.clipboard.writeText(lineConfig.webhookUrl)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <Button onClick={handleSetWebhook} className="w-full">
                設定 Webhook 到 LINE Developers Console
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>環境變數設定</CardTitle>
            <CardDescription>
              確認您的環境變數已正確設定
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">LINE Channel Access Token</span>
                <Badge variant={lineConfig.channelAccessToken ? 'default' : 'destructive'}>
                  {lineConfig.channelAccessToken ? '已設定' : '未設定'}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">LINE Channel Secret</span>
                <Badge variant={lineConfig.channelSecret ? 'default' : 'destructive'}>
                  {lineConfig.channelSecret ? '已設定' : '未設定'}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Gemini API Key</span>
                <Badge variant="default">需要設定</Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Firebase 配置</span>
                <Badge variant="default">需要設定</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              部署說明
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>在 Firebase Console 建立新專案</li>
              <li>啟用 Firestore 和 Authentication</li>
              <li>取得 Google Gemini API Key</li>
              <li>在 LINE Developers Console 建立 Messaging API 頻道</li>
              <li>設定環境變數檔案 (.env)</li>
              <li>部署應用程式到 Vercel 或 Firebase Hosting</li>
              <li>在 LINE Developers Console 設定 Webhook URL</li>
              <li>測試 LINE Bot 功能</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


