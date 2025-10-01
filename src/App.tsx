import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import LoginButton from "@/components/LoginButton";
import SimpleTest from "./pages/SimpleTest";

const queryClient = new QueryClient();

const AppContent = () => {
  try {
    const { user, isLoading, isLiffReady } = useAuth();

    console.log('AppContent render:', { user, isLoading, isLiffReady });

    if (isLoading || !isLiffReady) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">正在載入...</p>
            <p className="text-xs text-muted-foreground mt-2">
              Loading: {isLoading ? 'true' : 'false'}, LIFF Ready: {isLiffReady ? 'true' : 'false'}
            </p>
          </div>
        </div>
      );
    }

    if (!user) {
      return <LoginButton />;
    }

    return (
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/test" element={<SimpleTest />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    );
  } catch (error) {
    console.error('Error in AppContent:', error);
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-500 mb-4">Error Loading App</h1>
          <p className="text-muted-foreground mb-4">There was an error loading the application.</p>
          <details className="text-left bg-gray-100 p-4 rounded">
            <summary className="cursor-pointer font-medium">Error Details</summary>
            <pre className="mt-2 text-sm text-red-600">{error?.toString()}</pre>
          </details>
        </div>
      </div>
    );
  }
};

const App = () => {
  console.log('App component rendering...');
  
  return (
    <div className="min-h-screen bg-background pt-safe-top pb-safe-bottom">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </div>
  );
};

export default App;
