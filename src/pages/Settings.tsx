import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { 
  User, 
  Bell, 
  Globe, 
  Shield, 
  Trash2, 
  Save, 
  Camera,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Crown,
  AlertTriangle,
  Link as LinkIcon,
  Unlink
} from 'lucide-react';
import { LineUser } from '@/lib/database';

const Settings: React.FC = () => {
  const { user, liffUser, firebaseUser, updateUserProfile, updateUserPreferences, login, refreshUserData } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLinkingLine, setIsLinkingLine] = useState(false);
  const isLineLoginAccount = Boolean(
    liffUser?.userId ||
    firebaseUser?.providerData?.some((p) => (p.providerId || '').toLowerCase().includes('line'))
  );

  // Form states
  const [profileData, setProfileData] = useState({
    displayName: '',
    email: '',
    statusMessage: '',
    pictureUrl: ''
  });

  const [preferences, setPreferences] = useState({
    language: 'zh-TW' as 'zh-TW' | 'en',
    notifications: true,
    marketingOptIn: false
  });

  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'premium' | 'pro'>('free');

  // Initialize form data from user
  useEffect(() => {
    if (user) {
      setProfileData({
        displayName: user.displayName || '',
        email: (user as any).email || '',
        statusMessage: user.statusMessage || '',
        pictureUrl: user.pictureUrl || ''
      });

      setPreferences({
        language: user.preferences?.language || 'zh-TW',
        notifications: user.preferences?.notifications ?? true,
        marketingOptIn: user.preferences?.marketingOptIn ?? false
      });

      setSubscriptionTier(user.subscriptionTier || 'free');
    }
  }, [user]);

  const handleLinkLine = async () => {
    if (!user) return;
    if (isLineLoginAccount) {
      toast({
        title: 'LINE already linked',
        description: 'This account uses LINE login and cannot be re-linked.',
      });
      return;
    }
    try {
      setIsLinkingLine(true);
      await login(undefined, undefined, { force: true });
      await refreshUserData();
      toast({
        title: 'LINE linked',
        description: 'Your account is now connected for order alerts.',
      });
    } catch (error) {
      console.error('LINE link failed', error);
      toast({
        title: 'Unable to link LINE',
        description: 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLinkingLine(false);
    }
  };

  const handleRemoveLine = async () => {
    if (!user) return;
    if (isLineLoginAccount) {
      toast({
        title: 'LINE unlink disabled',
        description: 'This account was created with LINE login and cannot unlink LINE.',
      });
      return;
    }
    if (!window.confirm('Remove LINE link? You will stop receiving order alerts on LINE.')) return;
    try {
      setIsLinkingLine(true);
      await updateUserProfile({ lineId: null } as Partial<LineUser>);
      await refreshUserData();
      toast({
        title: 'LINE removed',
        description: 'You can relink LINE anytime.',
      });
    } catch (error) {
      console.error('Failed to remove LINE link', error);
      toast({
        title: 'Unable to remove LINE link',
        description: 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLinkingLine(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    setIsSaving(true);

    try {
      const updates: any = {
        displayName: profileData.displayName,
        statusMessage: profileData.statusMessage
      };

      if (profileData.email) {
        updates.email = profileData.email;
      }

      await updateUserProfile(updates);
      toast({
        title: t('settings.profileSaved'),
        description: t('settings.profileSavedDesc'),
      });
    } catch (error) {
      console.error('Failed to save profile:', error);
      toast({
        title: t('settings.profileSaveError'),
        description: t('settings.profileSaveErrorDesc'),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePreferences = async () => {
    if (!user) return;

    setIsSaving(true);

    try {
      await updateUserPreferences({
        language: preferences.language,
        notifications: preferences.notifications,
        marketingOptIn: preferences.marketingOptIn
      });

      // Update language context if changed
      if (preferences.language !== language) {
        setLanguage(preferences.language);
      }

      toast({
        title: t('settings.preferencesSaved'),
        description: t('settings.preferencesSavedDesc'),
      });
    } catch (error) {
      console.error('Failed to save preferences:', error);
      toast({
        title: t('settings.preferencesSaveError'),
        description: t('settings.preferencesSaveErrorDesc'),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm(t('settings.deleteAccountConfirm'))) return;
    
    // This would typically call a backend API to delete the account
    alert(t('settings.deleteAccountNotImplemented'));
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return t('common.notAvailable');
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString(language === 'zh-TW' ? 'zh-TW' : 'en-US');
  };

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {t('settings.loginRequired')}
          </h2>
          <p className="text-gray-600">
            {t('settings.loginRequiredDesc')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('settings.title')}</h1>
          <p className="text-gray-600 mt-1">{t('settings.description')}</p>
        </div>
        <Badge variant={subscriptionTier === 'free' ? 'secondary' : 'default'} className="flex items-center gap-1">
          <Crown className="w-3 h-3" />
          {t(`settings.subscription.${subscriptionTier}`)}
        </Badge>
      </div>


      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            {t('settings.profile.title')}
          </CardTitle>
          <CardDescription>
            {t('settings.profile.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Profile Picture */}
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
              {profileData.pictureUrl ? (
                <img 
                  src={profileData.pictureUrl} 
                  alt={profileData.displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-8 h-8 text-gray-400" />
              )}
            </div>
            <div>
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <Camera className="w-4 h-4" />
                {t('settings.profile.changePhoto')}
              </Button>
              <p className="text-sm text-gray-500 mt-1">
                {t('settings.profile.photoNote')}
              </p>
            </div>
          </div>

          {/* Profile Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">{t('settings.profile.displayName')}</Label>
              <Input
                id="displayName"
                value={profileData.displayName}
                onChange={(e) => setProfileData(prev => ({ ...prev, displayName: e.target.value }))}
                placeholder={t('settings.profile.displayNamePlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t('settings.profile.email')}</Label>
              <Input
                id="email"
                type="email"
                value={profileData.email}
                onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                placeholder={t('settings.profile.emailPlaceholder')}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="statusMessage">{t('settings.profile.statusMessage')}</Label>
              <Input
                id="statusMessage"
                value={profileData.statusMessage}
                onChange={(e) => setProfileData(prev => ({ ...prev, statusMessage: e.target.value }))}
                placeholder={t('settings.profile.statusMessagePlaceholder')}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button 
              onClick={handleSaveProfile} 
              disabled={isSaving}
              className="flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {isSaving ? t('common.saving') : t('settings.profile.save')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* LINE Link */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="w-5 h-5" />
            {t('settings.line.title')}
          </CardTitle>
          <CardDescription>
            {t('settings.line.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-900">
                {user.lineId
                  ? t('settings.line.linkedId', { id: user.lineId })
                  : isLineLoginAccount
                    ? t('settings.line.linkedVia', { id: liffUser?.userId || t('settings.line.lineAccount') })
                    : t('settings.line.notLinked')}
              </p>
              <p className="text-xs text-gray-600">
                {t('settings.line.helper')}
              </p>
            </div>
            {user.lineId ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRemoveLine}
                disabled={isLinkingLine || isLineLoginAccount}
              >
                <Unlink className="w-4 h-4 mr-2" />
                {isLineLoginAccount ? t('settings.line.viaLogin') : t('settings.line.remove')}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleLinkLine}
                disabled={isLinkingLine || isLineLoginAccount}
              >
                <LinkIcon className="w-4 h-4 mr-2" />
                {isLineLoginAccount
                  ? t('settings.line.viaLogin')
                  : isLinkingLine
                    ? t('settings.line.linking')
                    : t('settings.line.linkCta')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            {t('settings.preferences.title')}
          </CardTitle>
          <CardDescription>
            {t('settings.preferences.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Language */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              {t('settings.preferences.language')}
            </Label>
            <Select 
              value={preferences.language} 
              onValueChange={(value: 'zh-TW' | 'en') => 
                setPreferences(prev => ({ ...prev, language: value }))
              }
            >
              <SelectTrigger className="w-full md:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zh-TW">繁體中文</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notifications */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>{t('settings.preferences.notifications')}</Label>
              <p className="text-sm text-gray-500">
                {t('settings.preferences.notificationsDesc')}
              </p>
            </div>
            <Switch
              checked={preferences.notifications}
              onCheckedChange={(checked) => 
                setPreferences(prev => ({ ...prev, notifications: checked }))
              }
            />
          </div>

          {/* Marketing Opt-in */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>{t('settings.preferences.marketingOptIn')}</Label>
              <p className="text-sm text-gray-500">
                {t('settings.preferences.marketingOptInDesc')}
              </p>
            </div>
            <Switch
              checked={preferences.marketingOptIn}
              onCheckedChange={(checked) => 
                setPreferences(prev => ({ ...prev, marketingOptIn: checked }))
              }
            />
          </div>

          <div className="flex justify-end">
            <Button 
              onClick={handleSavePreferences} 
              disabled={isSaving}
              className="flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {isSaving ? t('common.saving') : t('settings.preferences.save')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Account Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            {t('settings.account.title')}
          </CardTitle>
          <CardDescription>
            {t('settings.account.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {t('settings.account.memberSince')}
              </Label>
              <p className="text-sm text-gray-600">
                {formatDate(user.createdAt)}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <User className="w-4 h-4" />
                {t('settings.account.userId')}
              </Label>
              <p className="text-sm text-gray-600 font-mono">
                {user.id}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Crown className="w-4 h-4" />
                {t('settings.account.subscription')}
              </Label>
              <div className="flex items-center gap-2">
                <Badge variant={subscriptionTier === 'free' ? 'secondary' : 'default'}>
                  {t(`settings.subscription.${subscriptionTier}`)}
                </Badge>
                {subscriptionTier === 'free' && (
                  <Button variant="outline" size="sm">
                    {t('settings.account.upgrade')}
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                {t('settings.account.role')}
              </Label>
              <Badge variant="outline">
                {user.role ? t(`auth.${user.role}`) : t('settings.account.noRole')}
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Danger Zone */}
          <div className="space-y-4">
            <h4 className="font-medium text-red-600">{t('settings.account.dangerZone')}</h4>
            <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50">
              <div>
                <h5 className="font-medium text-red-800">{t('settings.account.deleteAccount')}</h5>
                <p className="text-sm text-red-600">
                  {t('settings.account.deleteAccountDesc')}
                </p>
              </div>
              <Button 
                variant="destructive" 
                size="sm"
                onClick={handleDeleteAccount}
                className="flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {t('settings.account.delete')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
