import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

const TestLineRedirect: React.FC = () => {
  const { user, liffUser, isInLineApp, isLiffReady } = useAuth();

  const simulateLineRedirect = () => {
    const testParams = new URLSearchParams({
      userId: 'test-user-123',
      displayName: encodeURIComponent('測試用戶'),
      pictureUrl: encodeURIComponent('https://example.com/avatar.jpg')
    });
    
    window.location.href = `${window.location.origin}?${testParams.toString()}`;
  };

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>LINE 重定向測試</CardTitle>
          <CardDescription>測試 LINE Bot 重定向功能</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">環境狀態</h4>
              <ul className="text-sm space-y-1">
                <li>LINE App: {isInLineApp ? '✅ 是' : '❌ 否'}</li>
                <li>LIFF Ready: {isLiffReady ? '✅ 是' : '❌ 否'}</li>
                <li>User Agent: {navigator.userAgent.includes('line') ? '✅ 包含 LINE' : '❌ 不包含 LINE'}</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">用戶狀態</h4>
              <ul className="text-sm space-y-1">
                <li>已登入: {user ? '✅ 是' : '❌ 否'}</li>
                <li>LIFF 用戶: {liffUser ? '✅ 是' : '❌ 否'}</li>
                {user && (
                  <li>用戶名稱: {user.displayName}</li>
                )}
              </ul>
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-2">URL 參數</h4>
            <div className="bg-gray-100 p-3 rounded text-sm font-mono">
              {window.location.search || '無參數'}
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={simulateLineRedirect} variant="outline">
              模擬 LINE 重定向
            </Button>
            <Button onClick={() => window.location.reload()} variant="outline">
              重新載入
            </Button>
          </div>

          <div className="bg-yellow-50 p-4 rounded-lg">
            <h4 className="font-medium text-yellow-900 mb-2">除錯資訊</h4>
            <div className="text-sm text-yellow-800 space-y-1">
              <div>URL 參數: {window.location.search || '無參數'}</div>
              <div>當前路徑: {window.location.pathname}</div>
              <div>完整 URL: {window.location.href}</div>
              <div>User Agent: {navigator.userAgent.includes('line') ? 'LINE App' : 'Web Browser'}</div>
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">測試說明</h4>
            <ol className="text-sm text-blue-800 space-y-1">
              <li>1. 點擊「模擬 LINE 重定向」按鈕</li>
              <li>2. 頁面會重新載入並帶有模擬的 LINE 參數</li>
              <li>3. 系統應該自動識別並登入用戶</li>
              <li>4. 檢查用戶狀態是否更新</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TestLineRedirect;
