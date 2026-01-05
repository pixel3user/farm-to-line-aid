import React, { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TopNavigation from './TopNavigation';
import { useAuth } from '@/contexts/AuthContext';
import VoiceAssistantPopup from '@/components/VoiceAssistantPopup';
import LocationReminder from '@/components/LocationReminder';
import {
  buildPostOnboardingRedirectPath,
  savePostOnboardingRedirect
} from '@/lib/postOnboardingRedirect';

const queryClient = new QueryClient();

interface AppLayoutProps {
  children?: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, firebaseUser, liffUser, isLoading } = useAuth();
  const userRole = user?.role;
  const showVoiceAssistant = Boolean(user || firebaseUser || liffUser);

  useEffect(() => {
    if (!isLoading && user && !userRole && location.pathname !== '/auth/role-selection') {
      savePostOnboardingRedirect(buildPostOnboardingRedirectPath(location));
      navigate('/auth/role-selection', { replace: true });
    }
  }, [isLoading, user, userRole, location.pathname, navigate]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen bg-background">
          <TopNavigation />
          <main className="pt-16">
            <LocationReminder />
            {children || <Outlet />}
          </main>
          <Toaster />
          <Sonner />
          {showVoiceAssistant && <VoiceAssistantPopup />}
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default AppLayout;
