import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import FarmerLayout from '@/components/layouts/FarmerLayout';
import MarketLayout from '@/components/layouts/MarketLayout';

const InvoicesLayout: React.FC = () => {
  const { user } = useAuth();
  const role = user?.role;

  if (role === 'market') {
    return <MarketLayout />;
  }

  return <FarmerLayout />;
};

export default InvoicesLayout;

