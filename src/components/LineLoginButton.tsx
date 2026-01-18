import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Smartphone, Loader2 } from 'lucide-react';
import { lineAuthService } from '@/lib/lineAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';

interface LineLoginButtonProps {
  className?: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  children?: React.ReactNode;
  onError?: (error: string) => void;
}

const LineLoginButton: React.FC<LineLoginButtonProps> = ({
  className = '',
  variant = 'outline',
  size = 'default',
  children,
  onError
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useLanguage();
  const { login, isInLineApp, isLiffReady } = useAuth();

  const handleLineLogin = async () => {
    setIsLoading(true);
    
    try {
      // If inside LINE app, use LIFF login instead of LINE Login
      if (isInLineApp) {
        console.log('Inside LINE app - using LIFF authentication');
        await login(undefined, undefined, { force: true });
        return;
      }
      
      // Outside LINE app - use LINE Login (web)
      await lineAuthService.login();
    } catch (error) {
      console.error('LINE login error:', error);
      const errorMessage = error instanceof Error ? error.message : 'LINE login failed';
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleLineLogin}
      disabled={isLoading}
      className={`flex items-center justify-center bg-green-50 border-green-200 text-green-700 hover:bg-green-100 ${className}`}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <Smartphone className="w-4 h-4 mr-2" />
      )}
      {children || t('auth.lineLogin') || 'Continue with LINE'}
    </Button>
  );
};

export default LineLoginButton;
