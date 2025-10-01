import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, Users, Settings, Activity } from 'lucide-react';
import WebhookServer from '@/components/bots/WebhookServer';

interface DashboardData {
  totalUsers: number;
  activeUsers: number;
  totalMessages: number;
  totalProducts: number;
  totalStores: number;
  totalMarketingMaterials: number;
  recentActivity: Array<{
    id: string;
    type: string;
    action: string;
    timestamp: string;
    userId: string;
  }>;
}

export default function WebhookDashboard() {
  const [dashboardData] = useState<DashboardData>({
    totalUsers: 42,
    activeUsers: 28,
    totalMessages: 156,
    totalProducts: 12,
    totalStores: 8,
    totalMarketingMaterials: 24,
    recentActivity: [
      {
        id: '1',
        type: 'message',
        action: 'Product inquiry',
        timestamp: '2024-01-15 14:30:00',
        userId: 'U123456789'
      },
      {
        id: '2',
        type: 'image',
        action: 'Product image upload',
        timestamp: '2024-01-15 14:25:00',
        userId: 'U987654321'
      },
      {
        id: '3',
        type: 'postback',
        action: 'Marketing material created',
        timestamp: '2024-01-15 14:20:00',
        userId: 'U555666777'
      }
    ]
  });

  const lineConfig = {
    channelAccessToken: process.env.REACT_APP_LINE_CHANNEL_ACCESS_TOKEN || '',
    channelSecret: process.env.REACT_APP_LINE_CHANNEL_SECRET || '',
    webhookUrl: `${window.location.origin}/api/webhook`
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Farm2Market AI Dashboard
          </h1>
          <p className="text-gray-600">
            智慧農業銷售助手管理平台
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card className="bg-white/70 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">總用戶數</p>
                  <p className="text-3xl font-bold text-green-600">{dashboardData.totalUsers}</p>
                </div>
                <Users className="h-12 w-12 text-green-500" />
              </div>
              <div className="mt-2">
                <Badge variant="secondary" className="text-green-700">
                  活躍用戶: {dashboardData.activeUsers}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">總訊息數</p>
                  <p className="text-3xl font-bold text-blue-600">{dashboardData.totalMessages}</p>
                </div>
                <MessageSquare className="h-12 w-12 text-blue-500" />
              </div>
              <div className="mt-2">
                <Badge variant="secondary" className="text-blue-700">
                  AI 回覆率: 95%
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">行銷素材</p>
                  <p className="text-3xl font-bold text-orange-600">{dashboardData.totalMarketingMaterials}</p>
                </div>
                <Activity className="h-12 w-12 text-orange-500" />
              </div>
              <div className="mt-2">
                <Badge variant="secondary" className="text-orange-700">
                  AI 生成: {dashboardData.totalMarketingMaterials}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">總覽</TabsTrigger>
            <TabsTrigger value="users">用戶管理</TabsTrigger>
            <TabsTrigger value="analytics">數據分析</TabsTrigger>
            <TabsTrigger value="settings">設定</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    數據摘要
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">管理產品</span>
                      <Badge variant="outline" className="text-green-600">
                        {dashboardData.totalProducts}
                      </Badge>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">合作店家</span>
                      <Badge variant="outline" className="text-blue-600">
                        {dashboardData.totalStores}
                      </Badge>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">行銷素材</span>
                      <Badge variant="outline" className="text-orange-600">
                        {dashboardData.totalMarketingMaterials}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    最近活動
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {dashboardData.recentActivity.map((activity) => (
                      <div key={activity.id} className="flex items-center justify-between p-2 bg-muted rounded">
                        <div>
                          <p className="text-sm font-medium">{activity.action}</p>
                          <p className="text-xs text-gray-500">{activity.timestamp}</p>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {activity.type}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>用戶管理</CardTitle>
                <CardDescription>
                  管理 LINE Bot 用戶和他們的產品數據
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  功能正在開發中，將包含用戶資料管理、產品統計等功能。
                </p>
                <Button variant="outline">
                  查看用戶列表
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>數據分析</CardTitle>
                <CardDescription>
                  AI 使用統計和業務表現分析
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  功能正在開發中，將包含 Gemini API 使用統計、產品分析等數據。
                </p>
                <Button variant="outline">
                  查看詳細報告
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <WebhookServer lineConfig={lineConfig} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

