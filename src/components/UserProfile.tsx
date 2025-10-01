import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { User, LogOut, Settings, Calendar, MessageSquare, Database } from 'lucide-react';
import { createSampleDataForUser } from '@/utils/sampleData';
import { useToast } from '@/hooks/use-toast';

const UserProfile: React.FC = () => {
  const { user, logout, isInLineApp, refreshUserData } = useAuth();
  const { toast } = useToast();

  if (!user) return null;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '未知';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getSubscriptionBadge = (tier: string) => {
    switch (tier) {
      case 'premium':
        return <Badge variant="default" className="bg-yellow-500">Premium</Badge>;
      case 'pro':
        return <Badge variant="default" className="bg-purple-500">Pro</Badge>;
      default:
        return <Badge variant="secondary">Free</Badge>;
    }
  };

  const handleCreateSampleData = async () => {
    try {
      if (!user) return;
      
      await createSampleDataForUser(user.id);
      await refreshUserData();
      
      toast({
        title: "樣本資料已建立！ 🎉",
        description: "您的農場現在有範例產品和商店資料。",
      });
    } catch (error) {
      console.error('Failed to create sample data:', error);
      toast({
        title: "建立失敗",
        description: "請稍後再試。",
        variant: "destructive"
      });
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="flex flex-col items-center space-y-4">
          <Avatar className="w-20 h-20">
            <AvatarImage src={user.pictureUrl} alt={user.displayName} />
            <AvatarFallback className="text-lg">
              {getInitials(user.displayName)}
            </AvatarFallback>
          </Avatar>
          
          <div>
            <CardTitle className="text-xl">{user.displayName}</CardTitle>
            <CardDescription className="mt-1">
              {user.statusMessage || '農場主'}
            </CardDescription>
            {getSubscriptionBadge(user.subscriptionTier)}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground">加入日期</p>
              <p className="font-medium">{formatDate(user.createdAt)}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground">總訊息數</p>
              <p className="font-medium">{user.metadata.totalMessages}</p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">語言設定</span>
            <span className="font-medium">
              {user.preferences.language === 'zh-TW' ? '繁體中文' : 
               user.preferences.language === 'zh-CN' ? '简体中文' :
               user.preferences.language === 'en' ? 'English' : '日本語'}
            </span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">通知設定</span>
            <Badge variant={user.preferences.notifications ? "default" : "secondary"}>
              {user.preferences.notifications ? '開啟' : '關閉'}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">行銷推廣</span>
            <Badge variant={user.preferences.marketingOptIn ? "default" : "secondary"}>
              {user.preferences.marketingOptIn ? '同意' : '不同意'}
            </Badge>
          </div>
        </div>

        <div className="pt-4 border-t space-y-2">
          <Button 
            onClick={handleCreateSampleData} 
            variant="outline" 
            className="w-full"
          >
            <Database className="w-4 h-4 mr-2" />
            建立樣本資料
          </Button>
          
          {isInLineApp && (
            <Button 
              onClick={logout} 
              variant="outline" 
              className="w-full"
            >
              <LogOut className="w-4 h-4 mr-2" />
              登出
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default UserProfile;
