import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  buildPostOnboardingRedirectPath,
  savePostOnboardingRedirect
} from '@/lib/postOnboardingRedirect';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'farmer' | 'market';
  allowedRoles?: Array<'farmer' | 'market'>;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole, allowedRoles }) => {
  const { user, isLoading, isInLineApp, isLiffReady } = useAuth();
  const location = useLocation();

  const isAdmin = !!user?.isAdmin;
  const availableRoles = allowedRoles?.length
    ? allowedRoles
    : requiredRole
    ? [requiredRole]
    : undefined;

  // Show loading while checking authentication
  // If inside LINE app and LIFF is not ready yet, wait for LIFF authentication
  if (isLoading || (isInLineApp && !isLiffReady && !user)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, redirect to sign in
  // BUT: If inside LINE app, don't redirect - LIFF will authenticate automatically
  if (!user) {
    // Inside LINE app - wait for LIFF authentication, don't redirect to signin
    if (isInLineApp) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Authenticating...</p>
          </div>
        </div>
      );
    }
    
    // Outside LINE app - redirect to signin
    savePostOnboardingRedirect(buildPostOnboardingRedirectPath(location));
    return <Navigate to="/auth/signin" state={{ from: location }} replace />;
  }

  // If no role selected and not admin, redirect to role selection
  if (!user.role && !isAdmin) {
    savePostOnboardingRedirect(buildPostOnboardingRedirectPath(location));
    return <Navigate to="/auth/role-selection" replace />;
  }

  // If specific roles are required and doesn't include the user, redirect unless admin
  if (availableRoles && (!user.role || !availableRoles.includes(user.role)) && !isAdmin) {
    const targetPath = user.role ? `/${user.role}` : '/';
    return <Navigate to={targetPath} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
