import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, CheckCircle, AlertCircle } from 'lucide-react';

interface WebhookServerProps {
  lineConfig: {
    channelAccessToken: string;
    channelSecret: string;
    webhookUrl: string;
    liffId?: string;
    frontendBaseUrl?: string;
  };
}

export default function WebhookServer({ lineConfig }: WebhookServerProps) {
  const [richMenuFile, setRichMenuFile] = useState<File | null>(null);
  const [richMenuStatus, setRichMenuStatus] = useState<string | null>(null);
  const [richMenuId, setRichMenuId] = useState<string | null>(null);
  const [isDeployingRichMenu, setIsDeployingRichMenu] = useState(false);
  const [richMenuForm, setRichMenuForm] = useState({
    liffAppId: lineConfig.liffId || '',
    menuName: 'Farm2Market 主選單',
    chatBarText: '開啟選單',
  });

  const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });

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

  const handleDeployRichMenu = async () => {
    try {
      setRichMenuStatus('正在建立 LINE Rich Menu...');
      setIsDeployingRichMenu(true);
      setRichMenuId(null);

      const imageBase64 = richMenuFile ? await fileToBase64(richMenuFile) : undefined;
      const liffLink = richMenuForm.liffAppId
        ? `https://liff.line.me/${richMenuForm.liffAppId}`
        : (lineConfig.frontendBaseUrl || window.location.origin);

      const payload = {
        liffAppId: richMenuForm.liffAppId || undefined,
        setDefault: true,
        config: {
          size: { width: 2500, height: 1686 },
          selected: true,
          name: richMenuForm.menuName || 'Farm2Market 主選單',
          chatBarText: richMenuForm.chatBarText || 'Open Menu',
          areas: [
            {
              bounds: { x: 0, y: 0, width: 1250, height: 1686 },
              action: { type: 'uri', uri: `${liffLink}?tab=products&role=farmer` },
            },
            {
              bounds: { x: 1250, y: 0, width: 1250, height: 1686 },
              action: { type: 'message', text: 'Help' },
            },
          ],
        },
        imageBase64,
      };

      const response = await fetch('/api/line/richmenu/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Rich Menu 建立失敗');
      }

      setRichMenuId(data?.richMenuId || null);
      const message = data?.skipped
        ? '已在模擬模式建立 mock rich menu。'
        : 'Rich Menu 已建立並設為預設。';
      setRichMenuStatus(message);
    } catch (error: any) {
      console.error('Rich Menu deploy failed', error);
      setRichMenuStatus(error?.message || 'Rich Menu 建立失敗，請檢查設定。');
    } finally {
      setIsDeployingRichMenu(false);
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
            <CardTitle>Rich Menu 快速部署</CardTitle>
            <CardDescription>
              使用 LINE Messaging API 三步驟建立、上傳圖片並設為預設 rich menu。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">LIFF App ID</label>
                <Input
                  placeholder="YOUR-LIFF-ID"
                  value={richMenuForm.liffAppId}
                  onChange={(e) => setRichMenuForm((prev) => ({ ...prev, liffAppId: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  左側按鈕將開啟 LIFF：{richMenuForm.liffAppId ? `https://liff.line.me/${richMenuForm.liffAppId}` : '未設定時使用當前網站'}
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">聊天列文案</label>
                <Input
                  placeholder="Open menu"
                  value={richMenuForm.chatBarText}
                  onChange={(e) => setRichMenuForm((prev) => ({ ...prev, chatBarText: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Rich Menu 名稱</label>
                <Input
                  placeholder="Farm2Market 主選單"
                  value={richMenuForm.menuName}
                  onChange={(e) => setRichMenuForm((prev) => ({ ...prev, menuName: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  兩個區域：左邊開啟 LIFF、右邊送出 Help 訊息。
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Rich Menu 圖片</label>
                <Input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(e) => setRichMenuFile(e.target.files?.[0] || null)}
                />
                <p className="text-xs text-muted-foreground">
                  建議 2500x1686 PNG/JPEG。未上傳圖片時只會建立骨架。
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Button
                className="w-full"
                onClick={handleDeployRichMenu}
                disabled={isDeployingRichMenu}
              >
                {isDeployingRichMenu ? '部署中…' : '建立並啟用 Rich Menu'}
              </Button>
              {richMenuStatus && (
                <p className="text-sm text-muted-foreground">
                  {richMenuStatus} {richMenuId ? `richMenuId: ${richMenuId}` : ''}
                </p>
              )}
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

