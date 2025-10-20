import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "./components/layouts/AppLayout";
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

// Market pages
import MarketDashboard from "./pages/market/Dashboard";
import MarketFarms from "./pages/market/Farms";
import MarketProducts from "./pages/market/Products";
import MarketSchedule from "./pages/market/Schedule";
import MarketRatings from "./pages/market/Ratings";

// Demo pages
import LineDemo from "./pages/demo/LineDemo";

// Settings page
import Settings from "./pages/Settings";

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
            {/* Public routes */}
            <Route path="/" element={<AppLayout><Home /></AppLayout>} />
            <Route path="/auth/signin" element={<AppLayout><SignIn /></AppLayout>} />
            <Route path="/auth/signup" element={<AppLayout><SignUp /></AppLayout>} />
            <Route path="/auth/line/callback" element={<AppLayout><LineCallback /></AppLayout>} />
            <Route path="/auth/role-selection" element={<AppLayout><RoleSelection /></AppLayout>} />
        
        {/* Farmer routes */}
        <Route path="/farmer" element={
          <ProtectedRoute requiredRole="farmer">
            <FarmerLayout />
          </ProtectedRoute>
        }>
          <Route index element={<FarmerDashboard />} />
          <Route path="products" element={<FarmerProducts />} />
          <Route path="stores" element={<FarmerStores />} />
          <Route path="marketing" element={<FarmerMarketing />} />
          <Route path="analytics" element={<FarmerAnalytics />} />
          <Route path="references" element={<FarmerReferences />} />
        </Route>

        {/* Market routes */}
        <Route path="/market" element={
          <ProtectedRoute requiredRole="market">
            <MarketLayout />
          </ProtectedRoute>
        }>
          <Route index element={<MarketDashboard />} />
          <Route path="farms" element={<MarketFarms />} />
          <Route path="products" element={<MarketProducts />} />
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
