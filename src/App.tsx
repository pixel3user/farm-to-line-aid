import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "./components/layouts/AppLayout";
import DeepLinkRouter from "./components/DeepLinkRouter";
import DeepLinkHomeGate from "./components/DeepLinkHomeGate";
import FarmerLayout from "./components/layouts/FarmerLayout";
import MarketLayout from "./components/layouts/MarketLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import DebugOverlay from "./components/DebugOverlay";

const Home = lazy(() => import("./pages/Home"));
const SignIn = lazy(() => import("./pages/auth/SignIn"));
const SignUp = lazy(() => import("./pages/auth/SignUp"));
const LineCallback = lazy(() => import("./pages/auth/LineCallback"));
const RoleSelection = lazy(() => import("./pages/auth/RoleSelection"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Farmer pages
const FarmerDashboard = lazy(() => import("./pages/farmer/Dashboard"));
const FarmerProducts = lazy(() => import("./pages/farmer/Products"));
const FarmerStores = lazy(() => import("./pages/farmer/Stores"));
const FarmerMarketing = lazy(() => import("./pages/farmer/Marketing"));
const FarmerAnalytics = lazy(() => import("./pages/farmer/Analytics"));
const FarmerReferences = lazy(() => import("./pages/farmer/References"));
const FarmerDeliverySchedule = lazy(() => import("./pages/farmer/DeliverySchedule"));

// Market pages
const MarketDashboard = lazy(() => import("./pages/market/Dashboard"));
const MarketFarms = lazy(() => import("./pages/market/Farms"));
const MarketProducts = lazy(() => import("./pages/market/Products"));
const MarketSchedule = lazy(() => import("./pages/market/Schedule"));
const MarketRatings = lazy(() => import("./pages/market/Ratings"));
const MarketCheckout = lazy(() => import("./pages/market/Checkout"));

// Demo pages
const LineDemo = lazy(() => import("./pages/demo/LineDemo"));
const LinePayResult = lazy(() => import("./pages/payments/LinePayResult"));

// Settings page
const Settings = lazy(() => import("./pages/Settings"));

const App = () => {
  return (
    <BrowserRouter>
      <DeepLinkRouter />
      <DebugOverlay />
      <Suspense fallback={<div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>}>
        <Routes>
            {/* Public routes */}
            <Route path="/" element={<AppLayout><DeepLinkHomeGate /></AppLayout>} />
            <Route path="/auth/signin" element={<AppLayout><SignIn /></AppLayout>} />
            <Route path="/auth/signup" element={<AppLayout><SignUp /></AppLayout>} />
            <Route path="/auth/line/callback" element={<AppLayout><LineCallback /></AppLayout>} />
            <Route path="/auth/role-selection" element={<AppLayout><RoleSelection /></AppLayout>} />
            <Route path="/payments/line-pay/result" element={<AppLayout><LinePayResult /></AppLayout>} />
        
        {/* Farmer routes - farmers and markets can access */}
        <Route
          path="/farmer"
          element={
            <ProtectedRoute allowedRoles={['farmer', 'market']}>
              <FarmerLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<FarmerDashboard />} />
          <Route path="products" element={<FarmerProducts />} />
          <Route path="stores" element={<FarmerStores />} />
          <Route path="marketing" element={<FarmerMarketing />} />
          <Route path="analytics" element={<FarmerAnalytics />} />
          <Route path="references" element={<FarmerReferences />} />
          <Route path="delivery" element={<FarmerDeliverySchedule />} />
        </Route>

        {/* Market routes - farmers and markets can access */}
        <Route
          path="/market"
          element={
            <ProtectedRoute allowedRoles={['farmer', 'market']}>
              <MarketLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<MarketDashboard />} />
          <Route path="farms" element={<MarketFarms />} />
          <Route path="products" element={<MarketProducts />} />
          <Route path="checkout" element={<MarketCheckout />} />
          <Route path="schedule" element={<MarketSchedule />} />
          <Route path="ratings" element={<MarketRatings />} />
        </Route>
        
        {/* Demo routes */}
        <Route path="/demo/line" element={<AppLayout><LineDemo /></AppLayout>} />
        
        {/* Settings route */}
        <Route path="/settings" element={<AppLayout><Settings /></AppLayout>} />
        
        {/* Catch-all route */}
        <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default App;
