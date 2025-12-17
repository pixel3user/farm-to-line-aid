import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "./components/layouts/AppLayout";
import DeepLinkRouter from "./components/DeepLinkRouter";
import FarmerLayout from "./components/layouts/FarmerLayout";
import MarketLayout from "./components/layouts/MarketLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import SignIn from "./pages/auth/SignIn";
import SignUp from "./pages/auth/SignUp";
import LineCallback from "./pages/auth/LineCallback";
import RoleSelection from "./pages/auth/RoleSelection";
import NotFound from "./pages/NotFound";

// Farmer pages
import FarmerDashboard from "./pages/farmer/Dashboard";
import FarmerProducts from "./pages/farmer/Products";
import FarmerStores from "./pages/farmer/Stores";
import FarmerMarketing from "./pages/farmer/Marketing";
import FarmerAnalytics from "./pages/farmer/Analytics";
import FarmerReferences from "./pages/farmer/References";
import FarmerDeliverySchedule from "./pages/farmer/DeliverySchedule";

// Market pages
import MarketDashboard from "./pages/market/Dashboard";
import MarketFarms from "./pages/market/Farms";
import MarketProducts from "./pages/market/Products";
import MarketSchedule from "./pages/market/Schedule";
import MarketRatings from "./pages/market/Ratings";
import MarketCheckout from "./pages/market/Checkout";

// Demo pages
import LineDemo from "./pages/demo/LineDemo";
import LinePayResult from "./pages/payments/LinePayResult";

// Settings page
import Settings from "./pages/Settings";

const App = () => {
  return (
    <BrowserRouter>
      <DeepLinkRouter />
      <Routes>
            {/* Public routes */}
            <Route path="/" element={<AppLayout><Home /></AppLayout>} />
            <Route path="/auth/signin" element={<AppLayout><SignIn /></AppLayout>} />
            <Route path="/auth/signup" element={<AppLayout><SignUp /></AppLayout>} />
            <Route path="/auth/line/callback" element={<AppLayout><LineCallback /></AppLayout>} />
            <Route path="/auth/role-selection" element={<AppLayout><RoleSelection /></AppLayout>} />
            <Route path="/payments/line-pay/result" element={<AppLayout><LinePayResult /></AppLayout>} />
        
        {/* Farmer routes - only farmers and admins can access */}
        <Route
          path="/farmer"
          element={
            <ProtectedRoute requiredRole="farmer">
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

        {/* Market routes - only markets and admins can access */}
        <Route
          path="/market"
          element={
            <ProtectedRoute requiredRole="market">
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
    </BrowserRouter>
  );
};

export default App;
