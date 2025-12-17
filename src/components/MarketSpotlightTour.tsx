import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

const DEMO_LOCK_KEY = 'farm2market_market_demo_active';
const DEMO_PAGE_KEY = 'farm2market_market_demo_page';
const DEMO_STEP_KEY = 'farm2market_market_demo_step';
const DEMO_SUBSTEP_KEY = 'farm2market_market_demo_substep';

const pageOrder = ['dashboard', 'products', 'farms'] as const;

interface SpotlightTourProps {
  onComplete?: () => void;
}

interface SpotlightTarget {
  selector: string;
  title: string;
  body: string;
}

const MarketSpotlightTour: React.FC<SpotlightTourProps> = ({ onComplete }) => {
  const { t } = useLanguage();
  const [active, setActive] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [content, setContent] = useState<SpotlightTarget | null>(null);
  const [pageKey, setPageKey] = useState<string>('dashboard');
  const [subStep, setSubStep] = useState<number>(0);
  const attemptsRef = React.useRef(0);

  const mapping = useMemo<Record<string, SpotlightTarget[]>>(
    () => ({
      dashboard: [
        {
          selector: '[data-tour="market-welcome"]',
          title: t('tutorial.market.spot.welcome.title'),
          body: t('tutorial.market.spot.welcome.body')
        },
        {
          selector: '[data-tour="market-metric-farms"]',
          title: t('tutorial.market.spot.farms.title'),
          body: t('tutorial.market.spot.farms.body')
        },
        {
          selector: '[data-tour="market-metric-products"]',
          title: t('tutorial.market.spot.products.title'),
          body: t('tutorial.market.spot.products.body')
        }
      ],
      products: [
        {
          selector: '[data-tour="market-products-search"]',
          title: t('tutorial.market.spot.search.title'),
          body: t('tutorial.market.spot.search.body')
        },
        {
          selector: '[data-tour="market-products-list"]',
          title: t('tutorial.market.spot.list.title'),
          body: t('tutorial.market.spot.list.body')
        }
      ],
      farms: [
        {
          selector: '[data-tour="market-farms-list"]',
          title: t('tutorial.market.spot.farmList.title'),
          body: t('tutorial.market.spot.farmList.body')
        },
        {
          selector: '[data-tour="market-farms-map"]',
          title: t('tutorial.market.spot.map.title'),
          body: t('tutorial.market.spot.map.body')
        }
      ]
    }),
    [t]
  );

  const computeTarget = () => {
    try {
      const activeFlag = sessionStorage.getItem(DEMO_LOCK_KEY) === 'true';
      const page = sessionStorage.getItem(DEMO_PAGE_KEY);
      const stepKey = sessionStorage.getItem(DEMO_STEP_KEY) || 'dashboard';
      const subIdxRaw = sessionStorage.getItem(DEMO_SUBSTEP_KEY);
      const subIdx = subIdxRaw ? Number(subIdxRaw) || 0 : 0;
      if (!activeFlag || page !== window.location.pathname) {
        setActive(false);
        return;
      }

      const targetSteps = mapping[stepKey] || mapping.dashboard;
      const target = targetSteps[subIdx] || targetSteps[targetSteps.length - 1];
      const el = document.querySelector(target.selector) as HTMLElement | null;
      const rect = el?.getBoundingClientRect() ?? null;
      if (rect) {
        const padding = 120;
        const inView =
          rect.top >= padding &&
          rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) - padding;
        if (!inView) {
          window.scrollTo({
            top: rect.top + window.scrollY - padding,
            behavior: 'smooth'
          });
        }
      } else if (el?.scrollIntoView) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      setTargetRect(rect);
      setContent(target);
      setPageKey(stepKey);
      setSubStep(subIdx);
      sessionStorage.setItem(DEMO_SUBSTEP_KEY, String(subIdx));
      setActive(true);
      attemptsRef.current = 0;
    } catch {
      setActive(false);
    }
  };

  useEffect(() => {
    const tryCompute = () => {
      computeTarget();
      if (!content && attemptsRef.current < 10) {
        attemptsRef.current += 1;
        setTimeout(tryCompute, 150);
      }
    };

    tryCompute();
    const handleResize = () => computeTarget();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [mapping, content]);

  const stepsForPage = mapping[pageKey] || [];
  const isLastSub = subStep >= (stepsForPage.length ? stepsForPage.length - 1 : 0);

  const highlightStyle: React.CSSProperties = targetRect
    ? {
        position: 'fixed',
        top: (targetRect.top ?? 0) + window.scrollY - 8,
        left: (targetRect.left ?? 0) + window.scrollX - 8,
        width: (targetRect.width ?? 0) + 16,
        height: (targetRect.height ?? 0) + 16,
        borderRadius: 12,
        boxShadow: '0 0 0 9999px rgba(0,0,0,0.65)',
        zIndex: 9999,
        pointerEvents: 'none',
        transition: 'top 0.2s ease, left 0.2s ease, width 0.2s ease, height 0.2s ease'
      }
    : {
        position: 'fixed',
        top: '30vh',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 220,
        height: 120,
        borderRadius: 12,
        boxShadow: '0 0 0 9999px rgba(0,0,0,0.65)',
        zIndex: 9999,
        pointerEvents: 'none'
      };

  const tooltipStyle: React.CSSProperties = targetRect
    ? (() => {
        const viewportH = window.innerHeight || document.documentElement.clientHeight;
        const viewportW = window.innerWidth || document.documentElement.clientWidth;
        const tooltipHeight = 180;
        const tooltipWidth = 280;
        const padding = 16;
        const spaceBelow = viewportH - (targetRect?.bottom ?? 0);
        const placeBelow = spaceBelow > tooltipHeight + padding || (targetRect?.top ?? 0) < tooltipHeight;

        const desiredTop = placeBelow
          ? (targetRect?.bottom ?? 0) + window.scrollY + 12
          : (targetRect?.top ?? 0) + window.scrollY - tooltipHeight - 12;

        const clampedTop = Math.min(
          Math.max(desiredTop, window.scrollY + padding),
          window.scrollY + viewportH - tooltipHeight - padding
        );

        const desiredLeft = (targetRect?.left ?? 0) + window.scrollX;
        const clampedLeft = Math.min(
          Math.max(desiredLeft, window.scrollX + padding),
          window.scrollX + viewportW - tooltipWidth - padding
        );
        return {
          position: 'fixed',
          top: clampedTop,
          left: clampedLeft,
          zIndex: 10000,
          maxWidth: tooltipWidth
        };
      })()
    : {
        position: 'fixed',
        top: '30vh',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10000,
        maxWidth: 280
      };

  const advance = () => {
    const stepsFor = mapping[pageKey] || [];
    const nextSub = subStep + 1;
    if (nextSub < stepsFor.length) {
      sessionStorage.setItem(DEMO_SUBSTEP_KEY, String(nextSub));
      computeTarget();
      return;
    }

    const idx = pageOrder.indexOf(pageKey as any);
    const nextPage = idx >= 0 && idx < pageOrder.length - 1 ? pageOrder[idx + 1] : null;
    if (nextPage) {
      sessionStorage.setItem(DEMO_LOCK_KEY, 'true');
      sessionStorage.setItem(
        DEMO_PAGE_KEY,
        `/market/${nextPage === 'dashboard' ? '' : nextPage === 'products' ? 'products' : 'farms'}`
      );
      sessionStorage.setItem(DEMO_STEP_KEY, nextPage);
      sessionStorage.setItem(DEMO_SUBSTEP_KEY, '0');
      window.location.href =
        nextPage === 'dashboard'
          ? '/market'
          : nextPage === 'products'
          ? '/market/products'
          : '/market/farms';
      return;
    }

    try {
      sessionStorage.removeItem(DEMO_LOCK_KEY);
      sessionStorage.removeItem(DEMO_PAGE_KEY);
      sessionStorage.removeItem(DEMO_STEP_KEY);
      sessionStorage.removeItem(DEMO_SUBSTEP_KEY);
    } catch {
      // ignore
    }
    setActive(false);
    onComplete?.();
    window.dispatchEvent(new CustomEvent('farm2market-demo-complete'));
  };

  if (!active || !content) return null;

  return (
    <>
      <div style={highlightStyle} className="animate-pulse" />
      <div style={tooltipStyle} className="rounded-lg bg-white shadow-xl border border-emerald-200 p-3">
        <p className="text-sm font-semibold text-gray-900">{content.title}</p>
        <p className="text-xs text-gray-600 mt-1">{content.body}</p>
        <div className="flex justify-end mt-2">
          <button
            onClick={advance}
            className="px-3 py-1 text-xs rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition"
          >
            {isLastSub ? t('tutorial.market.spot.finish') : t('tutorial.market.spot.next')}
          </button>
        </div>
      </div>
    </>
  );
};

export default MarketSpotlightTour;
