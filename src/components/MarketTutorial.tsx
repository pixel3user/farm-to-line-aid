import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Info } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import MarketSpotlightTour from '@/components/MarketSpotlightTour';
import { useAuth } from '@/contexts/AuthContext';

const LOCAL_STORAGE_KEY = 'farm2market_market_tutorial';
const DEMO_LOCK_KEY = 'farm2market_market_demo_active';
const DEMO_PAGE_KEY = 'farm2market_market_demo_page';
const DEMO_STEP_KEY = 'farm2market_market_demo_step';
const DEMO_SUBSTEP_KEY = 'farm2market_market_demo_substep';

const MarketTutorial: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();

  const steps = useMemo(
    () => [
      {
        title: t('tutorial.market.steps.dashboard.title'),
        description: t('tutorial.market.steps.dashboard.desc'),
        cta: t('tutorial.market.steps.dashboard.cta'),
        href: '/market',
        nav: t('tutorial.market.steps.dashboard.nav'),
        video: 'dashboard'
      },
      {
        title: t('tutorial.market.steps.products.title'),
        description: t('tutorial.market.steps.products.desc'),
        cta: t('tutorial.market.steps.products.cta'),
        href: '/market/products',
        nav: t('tutorial.market.steps.products.nav'),
        video: 'products'
      },
      {
        title: t('tutorial.market.steps.farms.title'),
        description: t('tutorial.market.steps.farms.desc'),
        cta: t('tutorial.market.steps.farms.cta'),
        href: '/market/farms',
        nav: t('tutorial.market.steps.farms.nav'),
        video: 'farms'
      }
    ],
    [t]
  );

  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [shouldShowPrompt, setShouldShowPrompt] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!user || user.role !== 'market') {
      setShouldShowPrompt(false);
      return;
    }
    const storageKey = user.id ? `${LOCAL_STORAGE_KEY}:${user.id}` : LOCAL_STORAGE_KEY;
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : {};
      setShouldShowPrompt(parsed.dismissed !== true);
    } catch {
      setShouldShowPrompt(true);
    }
  }, [user?.id, user?.role]);

  const startTutorial = () => {
    setCurrentStep(0);
    setIsOpen(true);
  };

  const goToStepPage = (href?: string, video?: string) => {
    if (!href) return;
    try {
      sessionStorage.setItem(DEMO_LOCK_KEY, 'true');
      sessionStorage.setItem(DEMO_PAGE_KEY, href.split('?')[0]);
      sessionStorage.setItem(DEMO_STEP_KEY, video || 'dashboard');
      sessionStorage.setItem(DEMO_SUBSTEP_KEY, '0');
    } catch {
      // ignore
    }
    setIsOpen(false);
    window.location.href = href;
  };

  const dismiss = () => {
    const storageKey = user?.id ? `${LOCAL_STORAGE_KEY}:${user.id}` : LOCAL_STORAGE_KEY;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ dismissed: true }));
    } catch {
      // ignore
    }
    setShouldShowPrompt(false);
    setIsOpen(false);
  };

  return (
    <>
      {shouldShowPrompt && !isOpen && (
        <Card className="mb-4 border-2 border-blue-200 bg-blue-50">
          <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4">
            <div className="flex items-start sm:items-center gap-3">
              <div className="bg-white rounded-full p-2 border border-blue-200">
                <Info className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-blue-800">{t('tutorial.market.prompt.title')}</p>
                <p className="text-sm text-blue-700">{t('tutorial.market.prompt.desc')}</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button variant="outline" onClick={dismiss} className="w-full sm:w-auto">
                {t('tutorial.market.prompt.later')}
              </Button>
              <Button onClick={startTutorial} className="w-full sm:w-auto">
                {t('tutorial.market.prompt.start')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-3xl w-full">
          <DialogHeader>
            <DialogTitle>{t('tutorial.market.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <Badge variant="secondary">
                {t('common.step')} {currentStep + 1} / {steps.length}
              </Badge>
              <Progress value={((currentStep + 1) / steps.length) * 100} className="w-full sm:w-1/2" />
            </div>

            <div className="relative overflow-hidden rounded-xl border bg-black text-white shadow-lg">
              <img
                src="https://placehold.co/800x450?text=Market+Demo"
                alt="Tutorial demo"
                className="w-full h-56 sm:h-72 object-cover opacity-90"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-6 gap-3">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide">
                  <div className="h-1 w-6 bg-blue-300 rounded-full" />
                  <span>{t('tutorial.market.heroTag')}</span>
                </div>
                <p className="text-lg sm:text-2xl font-semibold">{t('tutorial.market.heroTitle')}</p>
                <p className="text-sm text-gray-200">{t('tutorial.market.heroDesc')}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {steps.map((step, idx) => (
                <div
                  key={step.title}
                  className={`p-3 rounded-lg border ${
                    idx === currentStep ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold">{step.title}</span>
                    <div
                      className={`w-3 h-3 rounded-full ${
                        idx === currentStep ? 'bg-blue-500' : idx < currentStep ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    />
                  </div>
                  <p className="text-xs text-gray-600">{step.description}</p>
                </div>
              ))}
            </div>

            <div className="w-full flex justify-center">
              {steps[currentStep]?.href && (
                <Button
                  size="lg"
                  className="w-full sm:w-auto"
                  onClick={() => goToStepPage(steps[currentStep]?.href, steps[currentStep]?.video)}
                >
                  {t('tutorial.market.startDemo')}
                </Button>
              )}
            </div>

            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={dismiss}>
                {t('tutorial.market.prompt.later')}
              </Button>
              <div className="space-x-0 sm:space-x-2 flex flex-col sm:flex-row gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setCurrentStep(Math.max(currentStep - 1, 0))} disabled={currentStep === 0} className="w-full sm:w-auto">
                  {t('common.previous')}
                </Button>
                {currentStep === steps.length - 1 ? (
                  <Button onClick={() => setIsOpen(false)} className="w-full sm:w-auto">
                    {t('tutorial.farmer.done.cta')}
                  </Button>
                ) : (
                  <Button onClick={() => setCurrentStep(Math.min(currentStep + 1, steps.length - 1))} className="w-full sm:w-auto">
                    {t('common.next')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <MarketSpotlightTour />
    </>
  );
};

export default MarketTutorial;
