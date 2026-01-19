import React, { useEffect, useMemo } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const parsePayloadFromHash = () => {
  if (typeof window === 'undefined') return null;
  const raw = window.location.hash.replace(/^#/, '').trim();
  if (!raw) return null;
  const payloadText = raw.startsWith('payload=') ? raw.slice('payload='.length) : raw;
  try {
    const decoded = decodeURIComponent(payloadText);
    return JSON.parse(decoded);
  } catch (error) {
    return null;
  }
};

const MapReturn: React.FC = () => {
  const { t } = useLanguage();
  const payload = useMemo(() => parsePayloadFromHash(), []);
  const hasPayload = Boolean(payload);

  useEffect(() => {
    if (!payload || typeof window === 'undefined') return;
    try {
      localStorage.setItem('yamato-map-selection', JSON.stringify(payload));
      localStorage.removeItem('yamato-map-selection');
    } catch (error) {}
    const timer = window.setTimeout(() => {
      try {
        window.close();
      } catch (error) {}
    }, 150);
    return () => window.clearTimeout(timer);
  }, [payload]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      {hasPayload ? (
        <CheckCircle2 className="h-10 w-10 text-emerald-600" />
      ) : (
        <AlertTriangle className="h-10 w-10 text-amber-500" />
      )}
      <h1 className="text-lg font-semibold">{t('logistics.mapReturn.title')}</h1>
      <p className="text-sm text-muted-foreground">
        {hasPayload ? t('logistics.mapReturn.desc') : t('logistics.mapReturn.missing')}
      </p>
    </div>
  );
};

export default MapReturn;
