import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ArrowLeft, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff,
  Smartphone
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import LineLoginButton from '@/components/LineLoginButton';
import {
  consumePostOnboardingRedirect,
  isRedirectAllowedForRole
} from '@/lib/postOnboardingRedirect';

const SignIn: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login, loginWithEmail, user, isInLineApp } = useAuth();
  const { t } = useLanguage();

  const role = searchParams.get('role') as 'farmer' | 'market' | null;

  useEffect(() => {
    if (user) {
      if (user.role === 'farmer' || user.role === 'market') {
        const redirect = consumePostOnboardingRedirect();
        if (redirect && isRedirectAllowedForRole(redirect, user.role)) {
          navigate(redirect, { replace: true });
        } else {
          navigate(`/${user.role}`);
        }
      } else {
        navigate('/auth/role-selection');
      }
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Prefer email/password if provided
      if (email && password) {
        await loginWithEmail(email, password);
      } else {
        // Only call login() if not inside LINE app
        // Inside LINE, LIFF will authenticate automatically - don't trigger LINE Login
        if (!isInLineApp) {
          await login();
        } else {
          setError('Please wait for automatic authentication or use email/password login.');
        }
      }
      // Navigation will be handled by useEffect
    } catch (err) {
      setError('Sign in failed. Please try again.');
      console.error('Sign in error:', err);
    } finally {
      setIsLoading(false);
    }
  };


  const handleLineLoginError = (error: string) => {
    setError(error);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">F</span>
            </div>
            <span className="font-bold text-xl text-gray-900">Farm2Market</span>
          </Link>
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
          {t('auth.signinTitle')}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          {t('common.or')}{' '}
          <Link to="/" className="font-medium text-green-600 hover:text-green-500">
            {t('nav.home')}
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.welcome')}</CardTitle>
            <CardDescription>
              {role ? (
                <>
                  {t('auth.signin')}{' '}as{' '}
                  <span className="font-semibold capitalize">{role}</span>{' '}
                  {t('home.features.description')}
                </>
              ) : (
                t('auth.signinDescription')
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert className="mb-4" variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">{t('auth.email')}</Label>
                <div className="mt-1 relative">
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    placeholder={t('auth.emailPlaceholder')}
                  />
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                </div>
              </div>

              <div>
                <Label htmlFor="password">{t('auth.password')}</Label>
                <div className="mt-1 relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    placeholder={t('auth.passwordPlaceholder')}
                  />
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 text-gray-400" />
                    ) : (
                      <Eye className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                    {t('auth.remember')}
                  </label>
                </div>

                <div className="text-sm">
                  <Link to="#" className="font-medium text-green-600 hover:text-green-500">
                    {t('auth.forgot')}
                  </Link>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? t('auth.signingIn') : t('auth.signin')}
              </Button>
            </form>

            {/* LINE Login */}
            <div className="mt-6">
              <LineLoginButton
                className="w-full"
                onError={handleLineLoginError}
              />
            </div>


            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                {t('auth.noAccount')}{' '}
                <Link to="/auth/signup" className="font-medium text-green-600 hover:text-green-500">
                  {t('auth.signup')}
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SignIn;
