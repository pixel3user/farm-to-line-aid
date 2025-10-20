import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  Smartphone, 
  QrCode, 
  MessageSquare, 
  Bot, 
  ArrowRight,
  CheckCircle,
  ExternalLink,
  Shield,
  Clock,
  Users,
  Package
} from 'lucide-react';

const LineDemo: React.FC = () => {
  const { t } = useLanguage();
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      id: 1,
      title: t('demo.step1'),
      description: t('demo.step1Desc'),
      icon: Bot,
      features: t('demo.step1Features').split(', '),
      image: '/assets/sample_img/Gemini_Generated_Image_qikttnqikttnqikt (1).png'
    },
    {
      id: 2,
      title: t('demo.step2'),
      description: t('demo.step2Desc'),
      icon: MessageSquare,
      features: t('demo.step2Features').split(', '),
      image: '/assets/sample_img/Gemini_Generated_Image_qikttnqikttnqikt (2).png'
    },
    {
      id: 3,
      title: t('demo.step3'),
      description: t('demo.step3Desc'),
      icon: Clock,
      features: t('demo.step3Features').split(', '),
      image: '/assets/sample_img/Gemini_Generated_Image_qikttnqikttnqikt (3).png'
    }
  ];

  const safetyFeatures = [
    {
      icon: Shield,
      title: t('demo.consentBased'),
      description: t('demo.consentBasedDesc')
    },
    {
      icon: Clock,
      title: t('demo.quietHours'),
      description: t('demo.quietHoursDesc')
    },
    {
      icon: Users,
      title: t('demo.frequencyLimits'),
      description: t('demo.frequencyLimitsDesc')
    },
    {
      icon: MessageSquare,
      title: t('demo.optOut'),
      description: t('demo.optOutDesc')
    }
  ];

  const handleOpenLIFF = () => {
    const liffId = import.meta.env.VITE_LIFF_ID;
    if (liffId && liffId !== 'your-liff-id') {
      // In real implementation, this would open the LIFF app
      window.open(`https://liff.line.me/${liffId}`, '_blank');
    } else {
      // Demo mode - show alert
      alert('LIFF ID not configured. This would open the LINE LIFF app in a real implementation.');
    }
  };

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center py-12 bg-gradient-to-r from-green-500 to-green-600 rounded-lg text-white">
        <div className="max-w-4xl mx-auto px-6">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {t('demo.title')}
          </h1>
          <p className="text-xl md:text-2xl opacity-90 mb-6">
            {t('demo.subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              variant="secondary"
              onClick={handleOpenLIFF}
              className="flex items-center"
            >
              <Smartphone className="w-5 h-5 mr-2" />
              {t('demo.open')}
              <ExternalLink className="w-4 h-4 ml-2" />
            </Button>
            <Button size="lg" variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
              <QrCode className="w-5 h-5 mr-2" />
              {t('demo.scan')}
            </Button>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div>
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            {t('demo.howItWorks')}
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {t('demo.howItWorksDesc')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <Card key={step.id} className="relative">
                <CardHeader>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <Icon className="w-6 h-6 text-green-600" />
                    </div>
                    <Badge variant="secondary">{t('common.step')} {step.id}</Badge>
                  </div>
                  <CardTitle className="text-xl">{step.title}</CardTitle>
                  <CardDescription>{step.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {step.features.map((feature, featureIndex) => (
                      <div key={featureIndex} className="flex items-center">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-6">
                    <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                      <img 
                        src={step.image} 
                        alt={step.title}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    </div>
                  </div>
                </CardContent>
                
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2">
                    <ArrowRight className="w-8 h-8 text-gray-400" />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* QR Code Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <QrCode className="w-5 h-5 mr-2" />
            {t('demo.tryItNow')}
          </CardTitle>
          <CardDescription>
            {t('demo.tryItNowDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="text-center">
              <div className="w-48 h-48 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4 overflow-hidden">
                <img 
                  src="/qr-code-line-bot.png" 
                  alt="LINE Bot QR Code"
                  className="w-full h-full object-contain"
                />
              </div>
              <p className="text-sm text-gray-600 mb-4">
                {t('demo.scanWithLine')}
              </p>
              <Button onClick={handleOpenLIFF} className="flex items-center mx-auto">
                <Smartphone className="w-4 h-4 mr-2" />
                {t('demo.openInLine')}
              </Button>
            </div>
            
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">{t('demo.whatYouCanDo')}</h3>
              <div className="space-y-3">
                <div className="flex items-start">
                  <Package className="w-5 h-5 text-green-600 mr-3 mt-0.5" />
                  <div>
                    <p className="font-medium">{t('demo.manageProducts')}</p>
                    <p className="text-sm text-gray-600">{t('demo.manageProductsDesc')}</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <Users className="w-5 h-5 text-blue-600 mr-3 mt-0.5" />
                  <div>
                    <p className="font-medium">{t('demo.findStores')}</p>
                    <p className="text-sm text-gray-600">{t('demo.findStoresDesc')}</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <MessageSquare className="w-5 h-5 text-purple-600 mr-3 mt-0.5" />
                  <div>
                    <p className="font-medium">{t('demo.generateMarketing')}</p>
                    <p className="text-sm text-gray-600">{t('demo.generateMarketingDesc')}</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <Bot className="w-5 h-5 text-orange-600 mr-3 mt-0.5" />
                  <div>
                    <p className="font-medium">{t('demo.getInsights')}</p>
                    <p className="text-sm text-gray-600">{t('demo.getInsightsDesc')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Safety & Compliance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="w-5 h-5 mr-2" />
            {t('demo.safetyCompliance')}
          </CardTitle>
          <CardDescription>
            {t('demo.safetyComplianceDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {safetyFeatures.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div key={index} className="flex items-start space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">{feature.title}</h4>
                    <p className="text-sm text-gray-600">{feature.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="mt-6 p-4 bg-green-50 rounded-lg">
            <h4 className="font-medium text-green-900 mb-2">{t('demo.ourPromise')}</h4>
            <p className="text-sm text-green-800">
              {t('demo.ourPromiseDesc')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Technical Details */}
      <Card>
        <CardHeader>
          <CardTitle>{t('demo.technicalImplementation')}</CardTitle>
          <CardDescription>
            {t('demo.technicalImplementationDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-3">{t('demo.lineBotFeatures')}</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  {t('demo.richMenu')}
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  {t('demo.liffIntegration')}
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  {t('demo.pushNotifications')}
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  {t('demo.webhookHandling')}
                </li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-3">{t('demo.dataSecurity')}</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  {t('demo.endToEndEncryption')}
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  {t('demo.gdprCompliant')}
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  {t('demo.secureAuth')}
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  {t('demo.securityAudits')}
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LineDemo;
