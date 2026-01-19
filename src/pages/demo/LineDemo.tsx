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
  Package,
  Sparkles,
  Store
} from 'lucide-react';
import heroImage from '@/assets/hero-farm-tech.jpg';
import phoneShowcase from '@/assets/sample_img/Gemini_Generated_Image_qikttnqikttnqikt.webp';
import step1Img from '@/assets/sample_img/Gemini_Generated_Image_qikttnqikttnqikt (1).webp';
import step2Img from '@/assets/sample_img/Gemini_Generated_Image_qikttnqikttnqikt (2).webp';
import step3Img from '@/assets/sample_img/Gemini_Generated_Image_qikttnqikttnqikt (3).webp';

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
      image: step1Img
    },
    {
      id: 2,
      title: t('demo.step2'),
      description: t('demo.step2Desc'),
      icon: MessageSquare,
      features: t('demo.step2Features').split(', '),
      image: step2Img
    },
    {
      id: 3,
      title: t('demo.step3'),
      description: t('demo.step3Desc'),
      icon: Clock,
      features: t('demo.step3Features').split(', '),
      image: step3Img
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

  const handleScanQRCode = () => {
    window.open('https://line.me/R/ti/p/%40196xyoju', '_blank');
  };

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gray-900 text-white">
        <div className="absolute inset-0">
          <img src={heroImage} alt="LINE demo hero" className="w-full h-full object-cover opacity-70" />
          <div className="absolute inset-0 bg-gradient-to-r from-gray-900/80 via-green-900/60 to-blue-900/50" />
        </div>
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-18">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div className="space-y-6">
              <Badge className="bg-white text-green-700 border border-green-100 shadow-sm">
                LINE Demo · Taiwan & SEA
              </Badge>
              <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight">
                {t('demo.title')}
              </h1>
              <p className="text-lg sm:text-xl text-green-50 max-w-2xl">
                {t('demo.subtitle')}
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  size="lg"
                  variant="secondary"
                  onClick={handleOpenLIFF}
                  className="flex items-center bg-white text-green-700 hover:bg-green-50"
                >
                  <Smartphone className="w-5 h-5 mr-2" />
                  {t('demo.open')}
                  <ExternalLink className="w-4 h-4 ml-2" />
                </Button>
                <Button size="lg" variant="outline" className="bg-white/10 border-white/30 text-white hover:bg-white/20" onClick={handleScanQRCode}>
                  <QrCode className="w-5 h-5 mr-2" />
                  {t('demo.scan')}
                </Button>
              </div>
              <div className="flex flex-wrap gap-3 pt-2 text-sm text-green-100">
                <span className="flex items-center gap-2"><Sparkles className="w-4 h-4" /> In-app ads for weekly picks</span>
                <span className="flex items-center gap-2"><Store className="w-4 h-4" /> LINE-first shopping flow</span>
              </div>
            </div>
            <div className="bg-white/10 border border-white/20 rounded-[28px] p-6 backdrop-blur-sm">
              <div className="bg-white rounded-3xl p-4 shadow-2xl">
                <div className="rounded-2xl overflow-hidden">
                  <img src={phoneShowcase} alt="Line demo phone" className="w-full h-full object-cover" />
                </div>
                <p className="text-sm text-gray-700 mt-3 text-center">
                  Run your LINE storefront, promos, and bot flows in one mobile-first experience.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section>
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
              <Card key={step.id} className="relative shadow-lg hover:shadow-2xl transition">
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
                    <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden border border-gray-100">
                      <img
                        src={step.image}
                        alt={step.title}
                        className="w-full h-full object-cover"
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
      </section>

      {/* QR Code Section */}
      <Card className="shadow-xl">
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
      <Card className="shadow-xl">
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
      <Card className="shadow-xl">
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

      {/* Promo band */}
      <section className="py-12 bg-gradient-to-r from-green-600 via-emerald-500 to-blue-600 rounded-3xl text-white text-center shadow-xl">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <p className="text-sm uppercase tracking-[0.2em] font-semibold">In-app advertising</p>
          <h3 className="text-3xl sm:text-4xl font-extrabold">Spotlight your seasonal harvests on LINE</h3>
          <p className="text-lg text-emerald-100 max-w-3xl mx-auto">
            Showcase weekly deals to Taiwan and SEA buyers, then close the loop with LIFF ordering and tracked delivery.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-white text-green-700 hover:bg-emerald-50 px-8 py-6 rounded-full">
              {t('demo.open')}
            </Button>
            <Button size="lg" variant="outline" className="border-2 border-white text-white hover:bg-white hover:text-green-700 px-8 py-6 rounded-full" onClick={handleOpenLIFF}>
              {t('demo.openInLine')}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LineDemo;
