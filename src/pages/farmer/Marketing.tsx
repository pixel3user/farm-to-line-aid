import React from 'react';
import MarketingTools from '@/components/MarketingTools';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { featureFlags } from '@/config/featureFlags';
import { useLanguage } from '@/contexts/LanguageContext';

const FarmerMarketing: React.FC = () => {
  const { t } = useLanguage();

  if (!featureFlags.marketingTools) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('marketing.title')}</CardTitle>
          <CardDescription>Marketing tools are temporarily hidden while we focus on other improvements.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-gray-600">
          Check back soon for updated marketing automation features.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <MarketingTools />
    </div>
  );
};

export default FarmerMarketing;
