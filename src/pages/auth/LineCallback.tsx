import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle, 
  XCircle, 
  Loader2,
  ArrowLeft
} from 'lucide-react';
import { lineAuthService, LineLoginUser } from '@/lib/lineAuth';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

const LineCallback: React.FC = () => {
  const navigate = useNavigate();
  const { login, setLiffProfile } = useAuth();
  const { t } = useLanguage();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string>('');
  const [user, setUser] = useState<LineLoginUser | null>(null);
  const hasHandledRef = useRef(false);
  const loginRef = useRef(login);
  const setLiffProfileRef = useRef(setLiffProfile);

  useEffect(() => {
    loginRef.current = login;
  }, [login]);

  useEffect(() => {
    setLiffProfileRef.current = setLiffProfile;
  }, [setLiffProfile]);

  useEffect(() => {
    let isMounted = true;
    
    const handleCallback = async () => {
      try {
        if (!isMounted || hasHandledRef.current) {
          return;
        }
        hasHandledRef.current = true;
        setStatus('loading');
        
        const lineUser = await lineAuthService.handleCallback();
        if (!isMounted) return;
        setUser(lineUser);
        if (lineUser) {
          setLiffProfileRef.current(lineUser);
        }
        
        await loginRef.current(lineUser);
        if (!isMounted) return;
        
        setStatus('success');
        
        setTimeout(() => {
          if (isMounted) {
            navigate('/auth/role-selection');
          }
        }, 2000);
        
      } catch (error) {
        if (!isMounted) return;
        console.error('LINE Login callback error:', error);
        setError(error instanceof Error ? error.message : 'Login failed');
        setStatus('error');
      }
    };

    handleCallback();
    
    return () => {
      isMounted = false;
    };
  }, [navigate]);

  const handleRetry = () => {
    navigate('/auth/signin');
  };

  const handleGoHome = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">F</span>
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
          LINE Login
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Processing your LINE authentication...
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card>
          <CardContent className="p-6">
            {status === 'loading' && (
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">
                    Authenticating with LINE...
                  </h3>
                  <p className="text-sm text-gray-600 mt-2">
                    Please wait while we verify your LINE account.
                  </p>
                </div>
              </div>
            )}

            {status === 'success' && (
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <CheckCircle className="w-12 h-12 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">
                    Login Successful!
                  </h3>
                  <p className="text-sm text-gray-600 mt-2">
                    Welcome back, {user?.displayName || 'User'}!
                  </p>
                  {user?.pictureUrl && (
                    <div className="mt-4">
                      <img 
                        src={user.pictureUrl} 
                        alt={user.displayName}
                        className="w-16 h-16 rounded-full mx-auto"
                      />
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-4">
                    Redirecting to your dashboard...
                  </p>
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <XCircle className="w-12 h-12 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">
                    Login Failed
                  </h3>
                  <Alert className="mt-4">
                    <AlertDescription>
                      {error || 'An error occurred during LINE authentication.'}
                    </AlertDescription>
                  </Alert>
                </div>
                <div className="flex space-x-3">
                  <Button onClick={handleRetry} className="flex-1">
                    Try Again
                  </Button>
                  <Button variant="outline" onClick={handleGoHome} className="flex-1">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Go Home
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LineCallback;
