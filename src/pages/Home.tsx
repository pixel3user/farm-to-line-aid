import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowRight, 
  Users, 
  Store, 
  Smartphone,
  TrendingUp,
  Shield,
  Clock,
  MessageSquare,
  MapPin,
  FileText,
  Package,
  Bot
} from 'lucide-react';
import heroImage from '@/assets/hero-farm-tech.jpg';
import slide2 from '@/assets/sample_img/Gemini_Generated_Image_qikttnqikttnqikt (1).png';
import slide3 from '@/assets/sample_img/Gemini_Generated_Image_qikttnqikttnqikt (2).png';
import { useMobileOptimization } from '@/utils/mobileOptimization';
import { useScrollReveal } from '@/hooks/useScrollReveal';

const Home: React.FC = () => {
  const { t, language, changeLanguage } = useLanguage();
  const mobileConfig = useMobileOptimization();
  const [isLiffApp, setIsLiffApp] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const revealContainerRef = useScrollReveal({ selector: '.reveal' });

  const slides = useMemo(() => [
    { src: heroImage, alt: 'Smart farming technology' },
    { src: slide2, alt: 'Farm to market logistics' },
    { src: slide3, alt: 'AI assistant for agriculture' },
  ], []);

  useEffect(() => {
    // Check if running inside LINE LIFF
    const userAgent = navigator.userAgent.toLowerCase();
    const isInLine = userAgent.includes('line');
    setIsLiffApp(isInLine);
  }, []);
  
  useEffect(() => {
    const id = window.setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => window.clearInterval(id);
  }, [slides.length]);
  
  const features = [
    {
      icon: Clock,
      title: t('home.features.demand'),
      description: t('home.features.demand.desc')
    },
    {
      icon: FileText,
      title: t('home.features.marketing'),
      description: t('home.features.marketing.desc')
    },
    {
      icon: MapPin,
      title: t('home.features.locator'),
      description: t('home.features.locator.desc')
    },
    {
      icon: MessageSquare,
      title: t('home.features.outreach'),
      description: t('home.features.outreach.desc')
    },
    {
      icon: TrendingUp,
      title: t('home.features.tracking'),
      description: t('home.features.tracking.desc')
    }
  ];

  return (
    <div ref={revealContainerRef as any} className="min-h-screen">
      {/* Hero Section */}
      <section className={`relative overflow-hidden ${
        mobileConfig.isMobile ? 'min-h-[500px]' : 'min-h-[600px]'
      }`}>
        {/* Background slideshow */}
        <div className="absolute inset-0">
          {slides.map((slide, idx) => (
            <img
              key={idx}
              src={slide.src}
              alt={slide.alt}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
                idx === currentSlide ? 'opacity-100' : 'opacity-0'
              }`}
            />
          ))}
        </div>
        <div className={`absolute inset-0 bg-gradient-to-r from-green-900/80 via-green-800/70 to-blue-900/80 flex items-center justify-center ${
          mobileConfig.isLiffApp ? 'pt-16 pb-8' : ''
        }`}>
          <div className={`text-center text-white space-y-6 sm:space-y-8 max-w-5xl px-4 sm:px-6`}>
            <div className="space-y-3 sm:space-y-4">
              <h1 className={`reveal reveal-up font-bold bg-gradient-to-r from-white to-green-100 bg-clip-text text-transparent ${
                mobileConfig.isMobile ? 'text-3xl sm:text-4xl' : 'text-5xl md:text-7xl'
              }`}>
                {t('home.title')}
              </h1>
              <p className={`reveal reveal-up reveal-delay-100 font-light opacity-95 ${
                mobileConfig.isMobile ? 'text-lg sm:text-xl' : 'text-2xl md:text-3xl'
              }`}>
                {t('home.subtitle')}
              </p>
              <p className={`reveal reveal-up reveal-delay-200 opacity-90 max-w-3xl mx-auto leading-relaxed ${
                mobileConfig.isMobile ? 'text-sm sm:text-base' : 'text-lg md:text-xl'
              }`}>
                {t('home.description')}
              </p>
            </div>
            
            {/* Key Benefits */}
            <div className={`grid gap-4 sm:gap-6 mt-8 sm:mt-12 max-w-4xl mx-auto ${
              mobileConfig.isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'
            }`}>
              <div className="reveal reveal-up bg-white/10 backdrop-blur-sm rounded-lg p-4 sm:p-6 border border-white/20">
                <div className={`bg-green-500 rounded-lg flex items-center justify-center mx-auto mb-3 sm:mb-4 ${
                  mobileConfig.isMobile ? 'w-10 h-10' : 'w-12 h-12'
                }`}>
                  <TrendingUp className={`text-white ${mobileConfig.isMobile ? 'w-5 h-5' : 'w-6 h-6'}`} />
                </div>
                <h3 className={`font-semibold mb-2 ${mobileConfig.isMobile ? 'text-base' : 'text-lg'}`}>{t('home.smartSales')}</h3>
                <p className="text-sm opacity-90">{t('home.smartSalesDesc')}</p>
              </div>
              <div className="reveal reveal-up reveal-delay-100 bg-white/10 backdrop-blur-sm rounded-lg p-4 sm:p-6 border border-white/20">
                <div className={`bg-blue-500 rounded-lg flex items-center justify-center mx-auto mb-3 sm:mb-4 ${
                  mobileConfig.isMobile ? 'w-10 h-10' : 'w-12 h-12'
                }`}>
                  <Smartphone className={`text-white ${mobileConfig.isMobile ? 'w-5 h-5' : 'w-6 h-6'}`} />
                </div>
                <h3 className={`font-semibold mb-2 ${mobileConfig.isMobile ? 'text-base' : 'text-lg'}`}>{t('home.lineIntegration')}</h3>
                <p className="text-sm opacity-90">{t('home.lineIntegrationDesc')}</p>
              </div>
              <div className="reveal reveal-up reveal-delay-200 bg-white/10 backdrop-blur-sm rounded-lg p-4 sm:p-6 border border-white/20">
                <div className={`bg-purple-500 rounded-lg flex items-center justify-center mx-auto mb-3 sm:mb-4 ${
                  mobileConfig.isMobile ? 'w-10 h-10' : 'w-12 h-12'
                }`}>
                  <Shield className={`text-white ${mobileConfig.isMobile ? 'w-5 h-5' : 'w-6 h-6'}`} />
                </div>
                <h3 className={`font-semibold mb-2 ${mobileConfig.isMobile ? 'text-base' : 'text-lg'}`}>{t('home.respectfulOutreach')}</h3>
                <p className="text-sm opacity-90">{t('home.respectfulOutreachDesc')}</p>
              </div>
            </div>

            {/* LINE Integration Badge */}
            {isLiffApp && (
              <div className="reveal reveal-up reveal-delay-300 mt-6 flex items-center justify-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 border border-white/20">
                <Bot className="w-4 h-4 text-green-300" />
                <span className="text-sm text-green-100">{t('home.runningInLine')}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Role Selection */}
      <section className={`bg-white ${mobileConfig.isMobile ? 'py-8' : 'py-16'}`}>
        <div className={`max-w-6xl mx-auto ${mobileConfig.isMobile ? 'px-4' : 'px-4 sm:px-6 lg:px-8'}`}>
          <div className={`text-center ${mobileConfig.isMobile ? 'mb-8' : 'mb-12'}`}>
            <h2 className={`reveal reveal-up font-bold text-gray-900 mb-4 ${
              mobileConfig.isMobile ? 'text-2xl' : 'text-3xl'
            }`}>
              {t('home.role.heading')}
            </h2>
            <p className={`reveal reveal-up reveal-delay-100 text-gray-600 max-w-2xl mx-auto ${
              mobileConfig.isMobile ? 'text-base' : 'text-lg'
            }`}>
              {t('home.role.description')}
            </p>
          </div>

          <div className={`grid gap-6 sm:gap-8 max-w-5xl mx-auto ${
            mobileConfig.isMobile ? 'grid-cols-1' : 'md:grid-cols-2'
          }`}>
            {/* Farmers Card */}
            <Card className="reveal reveal-left group hover:shadow-2xl transition-all duration-500 border-2 hover:border-green-300 bg-gradient-to-br from-green-50 to-white overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-green-100 rounded-full -translate-y-16 translate-x-16 opacity-50 group-hover:opacity-70 transition-opacity"></div>
              <CardHeader className={`text-center relative z-10 ${mobileConfig.isMobile ? 'pb-4' : 'pb-6'}`}>
                <div className={`bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6 group-hover:scale-110 transition-transform shadow-lg ${
                  mobileConfig.isMobile ? 'w-16 h-16' : 'w-20 h-20'
                }`}>
                  <Users className={`text-white ${mobileConfig.isMobile ? 'w-8 h-8' : 'w-10 h-10'}`} />
                </div>
                <CardTitle className={`text-gray-900 font-bold ${
                  mobileConfig.isMobile ? 'text-2xl' : 'text-3xl'
                }`}>{t('home.farmers.title')}</CardTitle>
                <CardDescription className={`text-gray-600 mt-2 ${
                  mobileConfig.isMobile ? 'text-base' : 'text-lg'
                }`}>
                  {t('home.farmers.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className={`space-y-4 sm:space-y-6 relative z-10 ${
                mobileConfig.isMobile ? 'px-4 pb-4' : ''
              }`}>
                <div className={`grid gap-3 ${
                  mobileConfig.isMobile ? 'grid-cols-1' : 'grid-cols-2'
                }`}>
                  <div className="flex items-center text-sm text-gray-700 bg-white/60 rounded-lg p-3">
                    <Package className="w-5 h-5 mr-3 text-green-600 flex-shrink-0" />
                    <span className="font-medium">{t('role.farmer.point1')}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-700 bg-white/60 rounded-lg p-3">
                    <Store className="w-5 h-5 mr-3 text-green-600 flex-shrink-0" />
                    <span className="font-medium">{t('role.farmer.point2')}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-700 bg-white/60 rounded-lg p-3">
                    <FileText className="w-5 h-5 mr-3 text-green-600 flex-shrink-0" />
                    <span className="font-medium">{t('role.farmer.point4')}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-700 bg-white/60 rounded-lg p-3">
                    <TrendingUp className="w-5 h-5 mr-3 text-green-600 flex-shrink-0" />
                    <span className="font-medium">{t('role.farmer.point3')}</span>
                  </div>
                </div>
                <Button 
                  asChild 
                  size={mobileConfig.isMobile ? "default" : "lg"} 
                  className={`w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold group-hover:shadow-lg transition-all ${
                    mobileConfig.isMobile ? 'h-12' : 'py-3'
                  }`}
                >
                  <Link to="/auth/signin?role=farmer">
                    {t('home.farmers.cta')}
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Markets Card */}
            <Card className="reveal reveal-right reveal-delay-100 group hover:shadow-2xl transition-all duration-500 border-2 hover:border-blue-300 bg-gradient-to-br from-blue-50 to-white overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-100 rounded-full -translate-y-16 translate-x-16 opacity-50 group-hover:opacity-70 transition-opacity"></div>
              <CardHeader className="text-center pb-6 relative z-10">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform shadow-lg">
                  <Store className="w-10 h-10 text-white" />
                </div>
                <CardTitle className="text-3xl text-gray-900 font-bold">{t('home.markets.title')}</CardTitle>
                <CardDescription className="text-gray-600 text-lg mt-2">
                  {t('home.markets.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 relative z-10">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center text-sm text-gray-700 bg-white/60 rounded-lg p-3">
                    <MapPin className="w-5 h-5 mr-3 text-blue-600 flex-shrink-0" />
                    <span className="font-medium">{t('role.market.point1')}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-700 bg-white/60 rounded-lg p-3">
                    <Package className="w-5 h-5 mr-3 text-blue-600 flex-shrink-0" />
                    <span className="font-medium">{t('role.market.point2')}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-700 bg-white/60 rounded-lg p-3">
                    <Clock className="w-5 h-5 mr-3 text-blue-600 flex-shrink-0" />
                    <span className="font-medium">{t('role.market.point3')}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-700 bg-white/60 rounded-lg p-3">
                    <TrendingUp className="w-5 h-5 mr-3 text-blue-600 flex-shrink-0" />
                    <span className="font-medium">{t('role.market.point4')}</span>
                  </div>
                </div>
                <Button asChild size="lg" variant="outline" className="w-full border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white font-semibold py-3 group-hover:shadow-lg transition-all">
                  <Link to="/auth/signin?role=market">
                    {t('home.markets.cta')}
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gradient-to-br from-gray-50 to-green-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="reveal reveal-up text-4xl font-bold text-gray-900 mb-6">
              {t('home.features.title')}
            </h2>
            <p className="reveal reveal-up reveal-delay-100 text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              {t('home.features.description')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div key={index} className="group reveal reveal-up" style={{ transitionDelay: `${100 * (index % 3)}ms` }}>
                  <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100 hover:border-green-200 h-full">
                    <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform shadow-lg">
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">
                      {feature.title}
                    </h3>
                    <p className="text-gray-600 text-center leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Secondary CTAs */}
      <section className="py-20 bg-gradient-to-r from-green-600 to-blue-600">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <h2 className="reveal reveal-up text-4xl font-bold text-white">
                {t('home.cta.title')}
              </h2>
              <p className="reveal reveal-up reveal-delay-100 text-xl text-green-100 max-w-2xl mx-auto">
                {t('home.cta.description')}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <Button asChild size="lg" className="reveal reveal-up bg-white text-green-600 hover:bg-green-50 font-semibold px-8 py-4 text-lg shadow-lg hover:shadow-xl transition-all">
                <Link to="/demo/line">
                  <Smartphone className="w-6 h-6 mr-3" />
                  {t('home.cta.line')}
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="reveal reveal-up reveal-delay-100 border-2 border-white text-white hover:bg-white hover:text-green-600 font-semibold px-8 py-4 text-lg transition-all">
                <Link to="#features">
                  {t('home.cta.learn')}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="reveal reveal-up">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">F</span>
                </div>
                <span className="font-bold text-xl">Farm to LINE</span>
              </div>
              <p className="text-gray-400 text-sm">
                {t('home.footer.tagline')}
              </p>
            </div>
            
            <div className="reveal reveal-up reveal-delay-100">
              <h3 className="font-semibold mb-4">{t('home.footer.product')}</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link to="/farmer" className="hover:text-white transition-colors">{t('home.footer.forFarmers')}</Link></li>
                <li><Link to="/market" className="hover:text-white transition-colors">{t('home.footer.forMarkets')}</Link></li>
                <li><Link to="/demo/line" className="hover:text-white transition-colors">{t('home.footer.lineDemo')}</Link></li>
              </ul>
            </div>
            
            <div className="reveal reveal-up reveal-delay-200">
              <h3 className="font-semibold mb-4">{t('home.footer.support')}</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link to="#" className="hover:text-white transition-colors">{t('home.footer.privacyPolicy')}</Link></li>
                <li><Link to="#" className="hover:text-white transition-colors">{t('home.footer.termsOfService')}</Link></li>
                <li><Link to="#" className="hover:text-white transition-colors">{t('home.footer.contact')}</Link></li>
              </ul>
            </div>
            
            <div className="reveal reveal-up reveal-delay-300">
              <h3 className="font-semibold mb-4">{t('home.footer.language')}</h3>
              <div className="flex bg-gray-800 rounded-lg p-1 w-fit">
                <button 
                  onClick={() => changeLanguage('en')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    language === 'en' 
                      ? 'bg-green-600 text-white shadow-md' 
                      : 'text-gray-300 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  {t('home.footer.english')}
                </button>
                <button 
                  onClick={() => changeLanguage('zh-TW')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    language === 'zh-TW' 
                      ? 'bg-green-600 text-white shadow-md' 
                      : 'text-gray-300 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  {t('home.footer.traditionalChinese')}
                </button>
              </div>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
            <p>{t('home.footer.copyright')}</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
