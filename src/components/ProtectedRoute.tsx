import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'farmer' | 'market';
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  const isAdmin = !!user?.isAdmin;

  // Show loading while checking authentication
  if (isLoading) {
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
  if (!user) {
    return <Navigate to="/auth/signin" state={{ from: location }} replace />;
  }

  // If no role selected and not admin, redirect to role selection
  if (!user.role && !isAdmin) {
    return <Navigate to="/auth/role-selection" replace />;
  }

  // If role is required and doesn't match, redirect to appropriate dashboard,
  // but allow admin users to access all areas.
  if (requiredRole && user.role !== requiredRole && !isAdmin) {
    const targetPath = user.role ? `/${user.role}` : '/';
    return <Navigate to={targetPath} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
