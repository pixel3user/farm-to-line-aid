import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Apple,
  Carrot,
  Wheat,
  Milk,
  ShieldCheck,
  Truck,
  Sparkles,
  Leaf,
  Store,
  HeartHandshake,
  Sprout,
  CheckCircle2,
  Smartphone,
  ArrowRight,
  LineChart,
  Users,
  Clock3
} from 'lucide-react';
import heroImage from '@/assets/hero-farm-tech.jpg';
import heroVideo from '@/assets/farmer-video.mp4';
import phoneShowcase from '@/assets/sample_img/Gemini_Generated_Image_qikttnqikttnqikt.png';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import { useLanguage } from '@/contexts/LanguageContext';

const Home: React.FC = () => {
  const revealContainerRef = useScrollReveal({ selector: '.reveal' });
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Light mobile guard so we keep the video only on larger screens.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    setIsMobile(mq.matches);
    const handler = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Hero background video loop (start at 00:25, loop until 02:13).
  useEffect(() => {
    if (isMobile) return;
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (video.currentTime >= 133) {
        video.currentTime = 25;
      }
    };

    const handleEnded = () => {
      video.currentTime = 25;
      video.play().catch(() => undefined);
    };

    const handleLoadedMetadata = () => {
      video.currentTime = 25;
      video.play().catch(() => undefined);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [isMobile]);

  const trustBadges = [
    { icon: ShieldCheck, label: t('home.trust.traceable.title'), detail: t('home.trust.traceable.desc') },
    { icon: HeartHandshake, label: t('home.trust.fair.title'), detail: t('home.trust.fair.desc') },
    { icon: Truck, label: t('home.trust.cold.title'), detail: t('home.trust.cold.desc') },
  ];

  const promiseCards = [
    { icon: Sparkles, title: t('home.promise.premium.title'), description: t('home.promise.premium.desc') },
    { icon: HeartHandshake, title: t('home.promise.service.title'), description: t('home.promise.service.desc') },
    { icon: Truck, title: t('home.promise.ontime.title'), description: t('home.promise.ontime.desc') },
    { icon: Store, title: t('home.promise.assortment.title'), description: t('home.promise.assortment.desc') },
  ];

  const savings = [
    { title: t('home.savings.items.slab.title'), body: t('home.savings.items.slab.desc') },
    { title: t('home.savings.items.tracker.title'), body: t('home.savings.items.tracker.desc') },
    { title: t('home.savings.items.deals.title'), body: t('home.savings.items.deals.desc') },
    { title: t('home.savings.items.spoilage.title'), body: t('home.savings.items.spoilage.desc') },
  ];

  const valueProps = [
    { icon: Sprout, title: t('home.value.direct.title'), copy: t('home.value.direct.desc') },
    { icon: LineChart, title: t('home.value.data.title'), copy: t('home.value.data.desc') },
    { icon: Users, title: t('home.value.network.title'), copy: t('home.value.network.desc') },
    { icon: Leaf, title: t('home.value.green.title'), copy: t('home.value.green.desc') },
  ];

  const categories = [
    { icon: Apple, label: t('home.categories.fruits'), tone: 'from-rose-50 to-amber-50', text: 'text-rose-700' },
    { icon: Carrot, label: t('home.categories.vegetables'), tone: 'from-emerald-50 to-lime-50', text: 'text-emerald-700' },
    { icon: Wheat, label: t('home.categories.grains'), tone: 'from-amber-50 to-orange-50', text: 'text-amber-700' },
    { icon: Milk, label: t('home.categories.dairy'), tone: 'from-blue-50 to-indigo-50', text: 'text-blue-700' },
  ];

  const heroBody = isMobile ? t('home.hero.bodyShort') : t('home.hero.body');

  return (
    <div ref={revealContainerRef as any} className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          {!isMobile ? (
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              playsInline
              muted
              autoPlay
            >
              <source src={heroVideo} type="video/mp4" />
            </video>
          ) : (
            <img src={heroImage} alt="Fresh produce market" className="w-full h-full object-cover opacity-60" />
          )}
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20">
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            {/* Text + CTAs */}
            <div className="space-y-6 order-1 lg:order-1">
              <Badge className="bg-white text-green-700 border border-green-100 shadow-sm w-fit reveal reveal-up">
                {t('home.hero.badge')}
              </Badge>
              <h1 className={`reveal reveal-up text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight ${isMobile ? 'text-gray-900' : 'text-white'}`}>
                {t('home.hero.title')}
              </h1>
              <p className={`reveal reveal-up reveal-delay-100 text-lg max-w-2xl ${isMobile ? 'text-gray-800' : 'text-green-50'}`}>
                {heroBody}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 reveal reveal-up reveal-delay-150">
                <Button asChild size="lg" className="bg-green-600 hover:bg-green-700 text-white px-6 py-6 rounded-full">
                  <Link to="/auth/signup?role=market">
                    {t('home.hero.ctaBuyer')}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-2 border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white px-6 py-6 rounded-full">
                  <Link to="/auth/signup?role=farmer">
                    {t('home.hero.ctaPartner')}
                  </Link>
                </Button>
              </div>
            </div>

            {/* Card */}
            <div className="reveal reveal-up lg:reveal-right relative max-w-xl w-full mx-auto order-2 lg:order-2">
              <div className="relative bg-white border border-green-50 rounded-[32px] shadow-2xl overflow-hidden">
                <div className="px-6 sm:px-8 pt-8 pb-6 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-green-600 font-semibold">{t('home.hero.card.preheading')}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{t('home.hero.card.title')}</p>
                  </div>
                  <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-100">{t('home.hero.card.badge')}</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2">
                  <div className="p-6 sm:p-8 space-y-3 sm:space-y-4">
                    {categories.map((category) => {
                      const Icon = category.icon;
                      return (
                        <div key={category.label} className={`flex items-center gap-3 p-3 rounded-2xl bg-gradient-to-r ${category.tone} border border-gray-100`}>
                          <span className="p-2 rounded-xl bg-white shadow-sm">
                            <Icon className={`w-5 h-5 ${category.text}`} />
                          </span>
                          <span className="font-semibold capitalize text-gray-900">{category.label}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="relative bg-gradient-to-b from-green-700 to-green-900 h-full flex items-center justify-center p-6">
                    <div className="absolute top-4 right-4 sm:top-6 sm:right-6 bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full border border-white/30">
                      {t('home.hero.card.liveRates')}
                    </div>
                    <div className="w-full max-w-xs">
                      <div className="rounded-[28px] bg-white shadow-lg overflow-hidden">
                        <img src={phoneShowcase} alt="Farm2Market app preview" className="w-full h-full object-cover" />
                      </div>
                      <div className="mt-4 text-center text-sm text-green-50">
                        {t('home.hero.card.note')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Trust badges */}
            <div className="order-3 lg:order-3 lg:col-span-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-3 gap-4 mt-2">
                {trustBadges.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className={`reveal reveal-up ${index === 1 ? 'reveal-delay-100' : index === 2 ? 'reveal-delay-200' : ''} bg-white border border-gray-100 rounded-2xl shadow-sm p-4`}>
                      <div className="w-10 h-10 rounded-xl bg-green-50 text-green-700 flex items-center justify-center mb-3">
                        <Icon className="w-5 h-5" />
                      </div>
                      <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                      <p className="text-xs text-gray-500 mt-1 leading-snug">{item.detail}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Grow effortlessly */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <h2 className="reveal reveal-up text-3xl sm:text-4xl font-extrabold text-gray-900">
            {t('home.grow.title')}
          </h2>
          <p className="reveal reveal-up reveal-delay-100 text-lg text-gray-600 max-w-3xl mx-auto">
            {t('home.grow.subtitle')}
          </p>
          <div className="flex justify-center">
            <div className="h-1 w-48 bg-gradient-to-r from-green-500 via-amber-400 to-pink-500 rounded-full" />
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-10">
            {promiseCards.map((card, index) => {
              const Icon = card.icon;
              return (
                <div key={card.title} className={`reveal reveal-up ${index === 1 ? 'reveal-delay-100' : index === 2 ? 'reveal-delay-150' : index === 3 ? 'reveal-delay-200' : ''} bg-amber-50/60 rounded-3xl p-6 border border-amber-100 shadow-sm hover:shadow-lg transition`}>
                  <div className="flex justify-center mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-white text-amber-700 flex items-center justify-center shadow-sm">
                      <Icon className="w-6 h-6" />
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold text-[#4d3dff] mb-2">{card.title}</h3>
                  <p className="text-sm text-gray-700 leading-relaxed">{card.description}</p>
                </div>
              );
            })}
          </div>

          <Button asChild size="lg" className="mt-8 bg-green-600 hover:bg-green-700 text-white px-8 py-6 rounded-full reveal reveal-up">
            <Link to="/auth/signup?role=market">
              {t('home.hero.ctaBuyer')}
            </Link>
          </Button>
        </div>
      </section>

      {/* Savings */}
      <section className="py-16 bg-gradient-to-b from-white to-green-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-12 items-center">
          <div className="reveal reveal-left space-y-4">
            <h3 className="text-3xl font-extrabold text-gray-900">
              {t('home.savings.title')}
            </h3>
            <div className="h-1 w-32 bg-gradient-to-r from-green-500 via-amber-400 to-blue-500 rounded-full" />
            <p className="text-lg text-gray-600">
              {t('home.savings.body')}
            </p>
            <div className="space-y-4">
              {savings.map((item, idx) => (
                <div key={item.title} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-1" />
                  <div>
                    <p className="font-semibold text-gray-900">{item.title}</p>
                    <p className="text-sm text-gray-600">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button asChild size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-6 rounded-full">
              <Link to="/market/products">{t('home.savings.cta')}</Link>
            </Button>
          </div>

          <div className="reveal reveal-right relative">
            <div className="absolute -inset-6 bg-gradient-to-tr from-green-100 via-white to-amber-50 rounded-[32px] blur-2xl opacity-70" />
            <div className="relative bg-white border border-gray-100 rounded-[32px] shadow-xl p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-gray-500">{t('home.savings.widget.preheading')}</p>
                  <p className="text-2xl font-bold text-gray-900">{t('home.savings.widget.title')}</p>
                </div>
                <Badge className="bg-green-50 text-green-700 border border-green-100">{t('home.savings.widget.badge')}</Badge>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between bg-green-50 border border-green-100 rounded-2xl p-4">
                  <div>
                    <p className="text-sm text-gray-600">{t('home.savings.widget.monthlyLabel')}</p>
                    <p className="text-2xl font-bold text-gray-900">NT$42,800</p>
                  </div>
                  <span className="text-green-700 font-semibold text-sm px-3 py-1 rounded-full bg-white">
                    {t('home.savings.widget.delta')}
                  </span>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="p-4 border border-gray-100 rounded-2xl">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Truck className="w-4 h-4 text-green-600" />
                      {t('home.savings.widget.delivery')}
                    </div>
                    <p className="text-xl font-semibold text-gray-900 mt-1">98.4%</p>
                  </div>
                  <div className="p-4 border border-gray-100 rounded-2xl">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock3 className="w-4 h-4 text-amber-600" />
                      {t('home.savings.widget.turnaround')}
                    </div>
                    <p className="text-xl font-semibold text-gray-900 mt-1">43 mins</p>
                  </div>
                </div>
                <div className="p-4 border border-gray-100 rounded-2xl flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                  <p className="text-sm text-gray-700">
                    {t('home.savings.widget.combo')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Value props */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-3 mb-12">
            <p className="text-sm uppercase tracking-[0.2em] text-green-700 font-semibold reveal reveal-up">{t('home.value.heading')}</p>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-gray-900 reveal reveal-up reveal-delay-100">
              {t('home.value.title')}
            </h3>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto reveal reveal-up reveal-delay-150">
              {t('home.value.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {valueProps.map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className={`reveal reveal-up ${index % 2 === 1 ? 'reveal-delay-100' : ''} bg-gradient-to-r from-green-50 to-white border border-gray-100 rounded-3xl p-6 shadow-sm hover:shadow-xl transition`}>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white text-green-700 flex items-center justify-center shadow-sm">
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xl font-semibold text-gray-900">{item.title}</p>
                      <p className="text-sm text-gray-600 mt-2 leading-relaxed">{item.copy}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 bg-gradient-to-r from-green-700 via-emerald-600 to-blue-700 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-10 items-center">
          <div className="space-y-4 reveal reveal-left">
            <h3 className="text-3xl sm:text-4xl font-extrabold">
              {t('home.final.title')}
            </h3>
            <p className="text-lg text-emerald-100">
              {t('home.final.subtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button asChild size="lg" className="bg-white text-green-700 hover:bg-emerald-50 px-8 py-6 rounded-full">
                <Link to="/demo/line">
                  {t('home.final.ctaLine')}
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-2 border-white text-white hover:bg-white hover:text-green-700 px-8 py-6 rounded-full">
                <Link to="/auth/signup?role=market">{t('home.final.ctaBuyer')}</Link>
              </Button>
            </div>
            <div className="flex flex-wrap gap-6 pt-4">
              <div className="flex items-center gap-2">
                <Store className="w-5 h-5" />
                <span className="text-sm">{t('home.final.metricRetailers')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                <span className="text-sm">{t('home.final.metricQuality')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5" />
                <span className="text-sm">{t('home.final.metricRoutes')}</span>
              </div>
            </div>
          </div>
          <div className="reveal reveal-right bg-white/10 border border-white/20 rounded-[32px] p-6 backdrop-blur-sm">
            <div className="bg-white text-gray-900 rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{t('home.final.catalog.preheading')}</p>
                  <p className="text-xl font-semibold text-gray-900">{t('home.final.catalog.title')}</p>
                </div>
                <Badge className="bg-green-50 text-green-700 border border-green-100">{t('home.final.catalog.badge')}</Badge>
              </div>
              <div className="mt-6 space-y-3">
                {['Tomato (local)', 'Baby Bottle Gourd', 'Banana Pachabale', 'Ash gourd'].map((item) => (
                  <div key={item} className="flex items-center justify-between border border-gray-100 rounded-xl px-3 py-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-700 font-semibold">
                        {item.slice(0, 1)}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{item}</p>
                        <p className="text-xs text-gray-500">{t('home.final.catalog.note')}</p>
                      </div>
                    </div>
                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white rounded-full px-4">
                      {t('home.final.catalog.add')}
                    </Button>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                {t('home.final.catalog.support')}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
