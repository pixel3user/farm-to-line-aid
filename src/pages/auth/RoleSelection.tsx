import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Users, 
  Store, 
  ArrowRight,
  CheckCircle
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

const RoleSelection: React.FC = () => {
  const navigate = useNavigate();
  const { user, refreshUserData } = useAuth();
  const { t } = useLanguage();
  const [selectedRole, setSelectedRole] = useState<'farmer' | 'market' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [emailInput, setEmailInput] = useState<string>(user?.email || '');
  const [nameInput, setNameInput] = useState<string>(user?.displayName || '');
  const [profileError, setProfileError] = useState<string>('');

  const missingEmail = !user?.email;

  const handleSaveProfile = async (): Promise<boolean> => {
    if (!user?.id) return false;
    setProfileError('');
    // simple validation
    const emailRegex = /.+@.+\..+/;
    if (!emailRegex.test(emailInput)) {
      setProfileError('Please enter a valid email address');
      return false;
    }
    if (!nameInput.trim()) {
      setProfileError('Please enter your name');
      return false;
    }
    try {
      setIsLoading(true);
      const { UserDataService } = await import('@/services/userDataService');
      await UserDataService.updateUserProfile(user.id, {
        email: emailInput,
        displayName: nameInput
      } as any);
      await refreshUserData();
      return true;
    } catch (e) {
      setProfileError('Failed to save profile. Please try again.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleSelection = async (role: 'farmer' | 'market') => {
    if (!user?.id) {
      console.error('No user ID available');
      return;
    }

    setSelectedRole(role);

    try {
      // Ensure profile basics are saved first if missing
      if (missingEmail) {
        const saved = await handleSaveProfile();
        if (!saved) {
          setSelectedRole(null);
          return;
        }
      }
      setIsLoading(true);
      // Update user profile with selected role
      const { UserDataService } = await import('@/services/userDataService');
      await UserDataService.updateUserProfile(user.id, {
        role: role,
        roleSelectedAt: new Date().toISOString()
      });

      // Refresh user data to get updated profile
      await refreshUserData();
      // Redirect immediately; ProtectedRoute will pass once role is set
      navigate(`/${role}`, { replace: true });

      // Wait for context to reflect role; navigation handled in useEffect below
    } catch (error) {
      console.error('Failed to update user role:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedRole && user?.role === selectedRole) {
      navigate(`/${selectedRole}`, { replace: true });
    }
  }, [user?.role, selectedRole, navigate]);

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-gray-600">Please sign in first</p>
            <Button asChild className="mt-4">
              <a href="/auth/signin">Go to Sign In</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome, {user.displayName}!
          </h1>
          <p className="text-lg text-gray-600">
            Please select your role to access the appropriate dashboard
          </p>
        </div>

        {/* Profile completion if email missing */}
        {missingEmail && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Complete your profile</CardTitle>
              <CardDescription>
                We need a few details to set up your account.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {profileError && (
                <div className="text-red-600 text-sm mb-3">{profileError}</div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Display name</Label>
                  <Input id="name" value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="Your name" />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} placeholder="you@example.com" />
                </div>
              </div>
              <div className="mt-4">
                <Button onClick={handleSaveProfile} disabled={isLoading}>
                  {isLoading ? 'Saving...' : 'Save profile'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Farmer Role */}
          <Card 
            className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
              selectedRole === 'farmer' ? 'ring-2 ring-green-500 bg-green-50' : 'hover:shadow-md'
            }`}
            onClick={() => !isLoading && handleRoleSelection('farmer')}
          >
            <CardHeader className="text-center pb-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors ${
                selectedRole === 'farmer' ? 'bg-green-600' : 'bg-green-100'
              }`}>
                <Users className={`w-8 h-8 ${
                  selectedRole === 'farmer' ? 'text-white' : 'text-green-600'
                }`} />
              </div>
              <CardTitle className={`text-xl ${
                selectedRole === 'farmer' ? 'text-green-800' : 'text-gray-900'
              }`}>
                I'm a Farmer
              </CardTitle>
              <CardDescription className="text-gray-600">
                I grow and sell agricultural products
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  Manage products and inventory
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  Find and connect with markets
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  Track sales and analytics
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  Create marketing materials
                </li>
              </ul>
              <Button 
                type="button"
                onClick={() => !isLoading && handleRoleSelection('farmer')}
                className={`w-full mt-4 ${
                  selectedRole === 'farmer' ? 'bg-green-600 hover:bg-green-700' : ''
                }`}
                disabled={isLoading}
              >
                {isLoading && selectedRole === 'farmer' ? (
                  'Setting up...'
                ) : (
                  <>
                    Choose as Farmer
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Market Role */}
          <Card 
            className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
              selectedRole === 'market' ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:shadow-md'
            }`}
            onClick={() => !isLoading && handleRoleSelection('market')}
          >
            <CardHeader className="text-center pb-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors ${
                selectedRole === 'market' ? 'bg-blue-600' : 'bg-blue-100'
              }`}>
                <Store className={`w-8 h-8 ${
                  selectedRole === 'market' ? 'text-white' : 'text-blue-600'
                }`} />
              </div>
              <CardTitle className={`text-xl ${
                selectedRole === 'market' ? 'text-blue-800' : 'text-gray-900'
              }`}>
                I'm a Market Owner
              </CardTitle>
              <CardDescription className="text-gray-600">
                I buy and sell agricultural products
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-blue-500 mr-2" />
                  Discover local farms
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-blue-500 mr-2" />
                  Compare products and prices
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-blue-500 mr-2" />
                  Manage delivery schedules
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-blue-500 mr-2" />
                  Rate and review farms
                </li>
              </ul>
              <Button 
                type="button"
                onClick={() => !isLoading && handleRoleSelection('market')}
                className={`w-full mt-4 ${
                  selectedRole === 'market' ? 'bg-blue-600 hover:bg-blue-700' : ''
                }`}
                disabled={isLoading}
              >
                {isLoading && selectedRole === 'market' ? (
                  'Setting up...'
                ) : (
                  <>
                    Choose as Market
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            You can change your role later in your profile settings
          </p>
        </div>
      </div>
    </div>
  );
};

export default RoleSelection;
