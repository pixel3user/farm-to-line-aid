import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Circle, CircleDot, Info, PlayCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import SpotlightTour from '@/components/SpotlightTour';

const LOCAL_STORAGE_KEY = 'farm2market_farmer_tutorial';
const DEMO_LOCK_KEY = 'farm2market_demo_active';
const DEMO_PAGE_KEY = 'farm2market_demo_page';
const DEMO_STEP_KEY = 'farm2market_demo_step';

interface TutorialState {
  completed?: boolean;
  lastStep?: number;
  dismissed?: boolean;
}

const FarmerTutorial: React.FC = () => {
  const { user, updateUserProfile } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();

  const steps = useMemo(
    () => [
      {
        title: t('tutorial.farmer.steps.dashboard.title'),
        description: t('tutorial.farmer.steps.dashboard.desc'),
        cta: t('tutorial.farmer.steps.dashboard.cta'),
        href: '/farmer',
        nav: t('tutorial.farmer.steps.dashboard.nav'),
        video: 'dashboard',
        demo: [
          t('tutorial.farmer.steps.dashboard.demo1'),
          t('tutorial.farmer.steps.dashboard.demo2')
        ]
      },
      {
        title: t('tutorial.farmer.steps.product.title'),
        description: t('tutorial.farmer.steps.product.desc'),
        cta: t('tutorial.farmer.steps.product.cta'),
        href: '/farmer/products?action=add',
        nav: t('tutorial.farmer.steps.product.nav'),
        video: 'products',
        demo: [
          t('tutorial.farmer.steps.product.demo1'),
          t('tutorial.farmer.steps.product.demo2')
        ]
      },
      {
        title: t('tutorial.farmer.steps.store.title'),
        description: t('tutorial.farmer.steps.store.desc'),
        cta: t('tutorial.farmer.steps.store.cta'),
        href: '/farmer/stores',
        nav: t('tutorial.farmer.steps.store.nav'),
        video: 'stores',
        demo: [
          t('tutorial.farmer.steps.store.demo1'),
          t('tutorial.farmer.steps.store.demo2')
        ]
      }
    ],
    [t]
  );
  const samplePanels = useMemo(
    () => ({
      dashboard: {
        statCards: [
          { label: t('tutorial.farmer.sample.sales'), value: 'NT$120,000', hint: t('tutorial.farmer.sample.salesHint') },
          { label: t('tutorial.farmer.sample.orders'), value: '48', hint: t('tutorial.farmer.sample.ordersHint') },
          { label: t('tutorial.farmer.sample.lowStock'), value: '3', hint: t('tutorial.farmer.sample.lowStockHint') }
        ]
      },
      product: {
        name: t('tutorial.farmer.sample.productName'),
        price: 'NT$180 / kg',
        stock: '120 kg',
        notes: t('tutorial.farmer.sample.productNotes')
      },
      store: {
        name: t('tutorial.farmer.sample.storeName'),
        status: t('tutorial.farmer.sample.storeStatus'),
        next: t('tutorial.farmer.sample.storeNext')
      },
      marketing: {
        title: t('tutorial.farmer.sample.flyerTitle'),
        reach: '3 LINE posts + 2 flyers',
        note: t('tutorial.farmer.sample.flyerNote')
      },
      analytics: {
        insight: t('tutorial.farmer.sample.insight'),
        action: t('tutorial.farmer.sample.insightAction')
      }
    }),
    [t]
  );

  const [tutorialState, setTutorialState] = useState<TutorialState>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [useSandbox, setUseSandbox] = useState(() => {
    try {
      const raw = localStorage.getItem(`${LOCAL_STORAGE_KEY}_sandbox`);
      return raw ? JSON.parse(raw) === true : true;
    } catch {
      return true;
    }
  });
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [currentVideo, setCurrentVideo] = useState('https://placehold.co/800x450?text=Farm2Market+Demo');
  const [sandboxLocked, setSandboxLocked] = useState(() => {
    try {
      const active = sessionStorage.getItem(DEMO_LOCK_KEY) === 'true';
      const page = sessionStorage.getItem(DEMO_PAGE_KEY);
      const matches = active && page === window.location.pathname;
      return matches;
    } catch {
      return false;
    }
  });

  const isCompleted = tutorialState.completed || !!user?.metadata?.tutorialCompletedAt;
  const shouldShowPrompt = !isCompleted && !tutorialState.dismissed && user?.role === 'farmer';

  useEffect(() => {
    if (tutorialState.completed && user?.role === 'farmer' && !user?.metadata?.tutorialCompletedAt) {
      updateUserProfile({
        metadata: {
          ...(user.metadata || {}),
          tutorialCompletedAt: new Date().toISOString(),
          tutorialLastStep: steps[steps.length - 1]?.title
        }
      }).catch(() => {
        // ignore failures; local state still tracks
      });
    }
  }, [tutorialState.completed, user?.role, user?.metadata, updateUserProfile, steps]);

  const persistState = (state: TutorialState) => {
    setTutorialState(state);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const videoKey = steps[currentStep]?.video || 'default';
    const src = {
      dashboard: 'https://placehold.co/800x450?text=Dashboard+10s+demo',
      products: 'https://placehold.co/800x450?text=Add+Product+GIF',
      stores: 'https://placehold.co/800x450?text=Stores+follow-up+walkthrough',
      marketing: 'https://placehold.co/800x450?text=Marketing+AI+demo',
      analytics: 'https://placehold.co/800x450?text=Analytics+insight+demo',
      default: 'https://placehold.co/800x450?text=Farm2Market+Demo'
    } as Record<string, string>;
    setCurrentVideo(src[videoKey] || src.default);
  }, [currentStep, steps]);

  useEffect(() => {
    try {
      const active = sessionStorage.getItem(DEMO_LOCK_KEY) === 'true';
      const page = sessionStorage.getItem(DEMO_PAGE_KEY);
      const matches = active && page === window.location.pathname;
      if (matches) {
        setSandboxLocked(true);
        setUseSandbox(true);
      } else {
        setSandboxLocked(false);
        sessionStorage.removeItem(DEMO_LOCK_KEY);
        sessionStorage.removeItem(DEMO_PAGE_KEY);
      }
    } catch {
      // ignore
    }
  }, []);

  const startTutorial = () => {
    setCurrentStep(0);
    setIsOpen(true);
  };

  const finishTutorial = () => {
    persistState({ completed: true, lastStep: steps.length - 1 });
    setIsOpen(false);
    toast({
      title: t('tutorial.farmer.done.title'),
      description: t('tutorial.farmer.done.desc')
    });
  };

  const goToStepPage = (href?: string) => {
    if (!href) return;
    setUseSandbox(true);
    setSandboxLocked(true);
    try {
      localStorage.setItem(`${LOCAL_STORAGE_KEY}_sandbox`, JSON.stringify(true));
      sessionStorage.setItem(DEMO_LOCK_KEY, 'true');
      sessionStorage.setItem(DEMO_PAGE_KEY, href.split('?')[0]);
      sessionStorage.setItem(DEMO_STEP_KEY, steps[currentStep]?.video || 'dashboard');
      sessionStorage.setItem('farm2market_demo_substep', '0');
    } catch {
      // ignore
    }
    setIsOpen(false);
    window.location.href = href;
  };

  const dismiss = () => {
    persistState({ ...tutorialState, dismissed: true });
  };

  const toggleSandbox = () => {
    if (sandboxLocked) return;
    const next = !useSandbox;
    setUseSandbox(next);
    try {
      localStorage.setItem(`${LOCAL_STORAGE_KEY}_sandbox`, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      const next = currentStep + 1;
      setCurrentStep(next);
      persistState({ ...tutorialState, lastStep: next });
    } else {
      finishTutorial();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  if (!user || user.role !== 'farmer') {
    return null;
  }

  return (
    <>
      {shouldShowPrompt && !isOpen && (
        <Card className="mb-4 border-2 border-amber-200 bg-amber-50">
        <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="bg-white rounded-full p-2 border border-amber-200">
              <Info className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-amber-800">{t('tutorial.farmer.prompt.title')}</p>
              <p className="text-sm text-amber-700">{t('tutorial.farmer.prompt.desc')}</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={dismiss} className="w-full sm:w-auto">
              {t('tutorial.farmer.prompt.later')}
            </Button>
            <Button onClick={startTutorial} className="w-full sm:w-auto">
              {t('tutorial.farmer.prompt.start')}
            </Button>
          </div>
        </CardContent>
      </Card>
    )}

    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-3xl w-full">
        <DialogHeader>
          <DialogTitle>{t('tutorial.farmer.title')}</DialogTitle>
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
              src={currentVideo}
              alt="Tutorial demo"
              className="w-full h-56 sm:h-72 object-cover opacity-90"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-6 gap-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide">
                <div className="h-1 w-6 bg-emerald-400 rounded-full" />
                <span>{t('tutorial.farmer.heroTag')}</span>
              </div>
              <p className="text-lg sm:text-2xl font-semibold">{t('tutorial.farmer.heroTitle')}</p>
              <p className="text-sm text-gray-200">{t('tutorial.farmer.heroDesc')}</p>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-emerald-100">
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-emerald-400" />
                  {t('tutorial.farmer.heroHint')}
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-emerald-400" />
                  {t('tutorial.farmer.heroCTA')}
                </div>
              </div>
            </div>
          </div>

          <div className="hidden sm:grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {steps.map((step, idx) => {
              const StatusIcon =
                idx < currentStep ? CheckCircle2 : idx === currentStep ? CircleDot : Circle;
              return (
                <div
                    key={step.title}
                    className={`p-3 rounded-lg border ${
                      idx === currentStep
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold">{step.title}</span>
                      <StatusIcon
                        className={`w-4 h-4 ${
                          idx < currentStep
                            ? 'text-green-600'
                            : idx === currentStep
                            ? 'text-orange-500'
                            : 'text-gray-400'
                        }`}
                      />
                    </div>
                    <p className="text-xs text-gray-600">{step.description}</p>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <Button
                variant={useSandbox ? 'default' : 'outline'}
                onClick={toggleSandbox}
                className="w-full sm:w-auto"
                disabled={sandboxLocked}
              >
                {useSandbox ? t('tutorial.farmer.sandbox.on') : t('tutorial.farmer.sandbox.off')}
              </Button>
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                {useSandbox ? t('tutorial.farmer.sandbox.descOn') : t('tutorial.farmer.sandbox.descOff')}
                {sandboxLocked && (
                  <span className="text-[11px] text-gray-500">
                    {t('tutorial.farmer.sandbox.lock')}
                  </span>
                )}
              </div>
            </div>

            <div className="w-full flex justify-center">
              {steps[currentStep]?.href && (
                <Button
                  size="lg"
                  className="w-full sm:w-auto"
                  onClick={() => goToStepPage(steps[currentStep]?.href)}
                >
                  {t('tutorial.farmer.startDemo')}
                </Button>
              )}
            </div>

            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={dismiss}>
                {t('tutorial.farmer.prompt.later')}
              </Button>
              <div className="space-x-0 sm:space-x-2 flex flex-col sm:flex-row gap-2 sm:gap-0">
                <Button variant="outline" onClick={prevStep} disabled={currentStep === 0} className="w-full sm:w-auto">
                  {t('common.previous')}
                </Button>
                {currentStep === steps.length - 1 ? (
                  <Button onClick={finishTutorial} className="w-full sm:w-auto">
                    {t('tutorial.farmer.done.cta')}
                  </Button>
                ) : (
                  <Button onClick={nextStep} className="w-full sm:w-auto">
                    {t('common.next')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <SpotlightTour
        onComplete={() => {
          setSandboxLocked(false);
          setUseSandbox(true);
        }}
      />
    </>
  );
};

export default FarmerTutorial;
