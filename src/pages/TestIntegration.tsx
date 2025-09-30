import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { createSampleDataForUser } from '@/utils/sampleData';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

const TestIntegration: React.FC = () => {
  const { user, userStats, userProducts, userStores, userMarketingMaterials, refreshUserData } = useAuth();
  const [isCreatingData, setIsCreatingData] = useState(false);
  const [testResults, setTestResults] = useState<{[key: string]: boolean}>({});

  const runTests = async () => {
    if (!user) return;

    const results: {[key: string]: boolean} = {};

    // Test 1: User authentication
    results.authentication = !!user;

    // Test 2: User stats loading
    results.userStats = !!userStats;

    // Test 3: Products loading
    results.products = userProducts.length > 0;

    // Test 4: Stores loading
    results.stores = userStores.length > 0;

    // Test 5: Marketing materials loading
    results.marketingMaterials = userMarketingMaterials.length > 0;

    setTestResults(results);
  };

  const createTestData = async () => {
    if (!user) return;
    
    setIsCreatingData(true);
    try {
      const success = await createSampleDataForUser(user.id);
      if (success) {
        await refreshUserData();
        await runTests();
      }
    } catch (error) {
      console.error('Failed to create test data:', error);
    } finally {
      setIsCreatingData(false);
    }
  };

  const getTestIcon = (passed: boolean | undefined) => {
    if (passed === undefined) return null;
    return passed ? (
      <CheckCircle className="w-5 h-5 text-green-500" />
    ) : (
      <XCircle className="w-5 h-5 text-red-500" />
    );
  };

  const getTestBadge = (passed: boolean | undefined) => {
    if (passed === undefined) return <Badge variant="secondary">未測試</Badge>;
    return passed ? (
      <Badge variant="default" className="bg-green-500">通過</Badge>
    ) : (
      <Badge variant="destructive">失敗</Badge>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">整合測試</h1>
        <p className="text-muted-foreground">測試 LINE 登入和數據整合功能</p>
      </div>

      {/* User Info */}
      <Card>
        <CardHeader>
          <CardTitle>用戶資訊</CardTitle>
          <CardDescription>當前登入用戶的詳細資訊</CardDescription>
        </CardHeader>
        <CardContent>
          {user ? (
            <div className="space-y-2">
              <p><strong>用戶 ID:</strong> {user.id}</p>
              <p><strong>顯示名稱:</strong> {user.displayName}</p>
              <p><strong>訂閱等級:</strong> {user.subscriptionTier}</p>
              <p><strong>語言設定:</strong> {user.preferences.language}</p>
              <p><strong>總訊息數:</strong> {user.metadata.totalMessages}</p>
            </div>
          ) : (
            <p className="text-muted-foreground">未登入</p>
          )}
        </CardContent>
      </Card>

      {/* Data Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>數據統計</CardTitle>
          <CardDescription>用戶數據的統計資訊</CardDescription>
        </CardHeader>
        <CardContent>
          {userStats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold">{userStats.totalProducts}</p>
                <p className="text-sm text-muted-foreground">產品總數</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{userStats.totalStores}</p>
                <p className="text-sm text-muted-foreground">商店總數</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{userStats.totalMarketingMaterials}</p>
                <p className="text-sm text-muted-foreground">行銷素材</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{userStats.totalConversations}</p>
                <p className="text-sm text-muted-foreground">對話記錄</p>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">無數據</p>
          )}
        </CardContent>
      </Card>

      {/* Test Results */}
      <Card>
        <CardHeader>
          <CardTitle>測試結果</CardTitle>
          <CardDescription>各項功能的測試狀態</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getTestIcon(testResults.authentication)}
                <span>用戶認證</span>
              </div>
              {getTestBadge(testResults.authentication)}
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getTestIcon(testResults.userStats)}
                <span>用戶統計</span>
              </div>
              {getTestBadge(testResults.userStats)}
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getTestIcon(testResults.products)}
                <span>產品數據</span>
              </div>
              {getTestBadge(testResults.products)}
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getTestIcon(testResults.stores)}
                <span>商店數據</span>
              </div>
              {getTestBadge(testResults.stores)}
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getTestIcon(testResults.marketingMaterials)}
                <span>行銷素材</span>
              </div>
              {getTestBadge(testResults.marketingMaterials)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-4 justify-center">
        <Button onClick={runTests} variant="outline">
          執行測試
        </Button>
        <Button 
          onClick={createTestData} 
          disabled={isCreatingData || !user}
          className="min-w-[120px]"
        >
          {isCreatingData ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              創建中...
            </>
          ) : (
            '創建測試數據'
          )}
        </Button>
        <Button onClick={refreshUserData} variant="secondary">
          重新載入數據
        </Button>
      </div>

      {/* Data Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">產品列表</CardTitle>
          </CardHeader>
          <CardContent>
            {userProducts.length > 0 ? (
              <div className="space-y-2">
                {userProducts.slice(0, 3).map((product, index) => (
                  <div key={index} className="p-2 bg-muted rounded">
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-muted-foreground">
                      庫存: {product.stock} | 價格: NT${product.price}
                    </p>
                  </div>
                ))}
                {userProducts.length > 3 && (
                  <p className="text-sm text-muted-foreground">
                    ...還有 {userProducts.length - 3} 個產品
                  </p>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">無產品數據</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">商店列表</CardTitle>
          </CardHeader>
          <CardContent>
            {userStores.length > 0 ? (
              <div className="space-y-2">
                {userStores.slice(0, 3).map((store, index) => (
                  <div key={index} className="p-2 bg-muted rounded">
                    <p className="font-medium">{store.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {store.location} | {store.status}
                    </p>
                  </div>
                ))}
                {userStores.length > 3 && (
                  <p className="text-sm text-muted-foreground">
                    ...還有 {userStores.length - 3} 個商店
                  </p>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">無商店數據</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">行銷素材</CardTitle>
          </CardHeader>
          <CardContent>
            {userMarketingMaterials.length > 0 ? (
              <div className="space-y-2">
                {userMarketingMaterials.slice(0, 3).map((material, index) => (
                  <div key={index} className="p-2 bg-muted rounded">
                    <p className="font-medium">{material.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {material.type} | 使用 {material.usage?.timesUsed || 0} 次
                    </p>
                  </div>
                ))}
                {userMarketingMaterials.length > 3 && (
                  <p className="text-sm text-muted-foreground">
                    ...還有 {userMarketingMaterials.length - 3} 個素材
                  </p>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">無行銷素材</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TestIntegration;
