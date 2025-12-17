import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { Timestamp } from 'firebase/firestore';
import { useLanguage } from '@/contexts/LanguageContext';

const LocationReminder: React.FC = () => {
  const { user, isLoading, updateUserProfile } = useAuth();
  const { t } = useLanguage();
  const { toast, dismiss } = useToast();
  // Used only to avoid duplicate toasts during a single component mount.
  // It resets whenever the authenticated user changes.
  const hasShownLocationPromptRef = useRef(false);
  const toastIdRef = useRef<string | null>(null);
  const lastUserIdRef = useRef<string | null>(null);
  const location = useLocation();

  // Reset reminder tracking when the signed-in user changes (including logout)
  useEffect(() => {
    const currentUserId = user?.id ?? null;
    console.log('[LocationReminder] auth user changed', {
      prevUserId: lastUserIdRef.current,
      nextUserId: currentUserId,
    });
    if (currentUserId !== lastUserIdRef.current) {
      hasShownLocationPromptRef.current = false;
      lastUserIdRef.current = currentUserId;

      if (toastIdRef.current) {
        console.log('[LocationReminder] dismissing existing toast due to user change', {
          toastId: toastIdRef.current,
        });
        dismiss(toastIdRef.current);
        toastIdRef.current = null;
      }
    }
  }, [user?.id, dismiss]);

  useEffect(() => {
    console.log('[LocationReminder] effect run', {
      isLoading,
      hasUser: !!user,
      userId: user?.id,
      hasLocation: !!user?.location,
      pathname: location.pathname,
      hasShown: hasShownLocationPromptRef.current,
      toastId: toastIdRef.current,
    });

    if (isLoading) return;
    if (!user) {
      console.log('[LocationReminder] no user, clearing toast if any');
      if (toastIdRef.current) {
        dismiss(toastIdRef.current);
        toastIdRef.current = null;
      }
      return;
    }
    // Only run when a user is logged in
    // Skip on auth-related pages (signin/signup/role-selection/logout flows)
    if (location.pathname.startsWith('/auth')) {
      console.log('[LocationReminder] on auth route, clearing toast if any', {
        pathname: location.pathname,
      });
      if (toastIdRef.current) {
        dismiss(toastIdRef.current);
        toastIdRef.current = null;
      }
      return;
    }
    // Determine whether the user effectively has a usable location
    const hasEffectiveLocation =
      !!user.location &&
      typeof user.location.lat === 'number' &&
      typeof user.location.lng === 'number' &&
      Number.isFinite(user.location.lat) &&
      Number.isFinite(user.location.lng);

    // Skip if location already set with valid coordinates
    if (hasEffectiveLocation) {
      console.log('[LocationReminder] user already has a valid location, skipping', {
        location: user.location,
      });
      return;
    }
    if (hasShownLocationPromptRef.current) {
      console.log('[LocationReminder] prompt already shown in this session, skipping');
      return;
    }

    hasShownLocationPromptRef.current = true;
    console.log('[LocationReminder] scheduling location reminder toast');

    const id = window.setTimeout(() => {
      console.log('[LocationReminder] firing location reminder toast');
      const { id: toastId } = toast({
        title: t('locationReminder.title'),
        description: t('locationReminder.description'),
        // Keep this toast visible until the user explicitly closes or updates it
        duration: Infinity,
        action: (
          <ToastAction
            altText={t('locationReminder.actionAlt')}
            onClick={async () => {
              try {
                if (!('geolocation' in navigator)) {
                  console.warn('[LocationReminder] geolocation not available in navigator');
                  toast({
                    title: t('locationReminder.unavailable.title'),
                    description: t('locationReminder.unavailable.description'),
                  });
                  return;
                }

                const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                  navigator.geolocation.getCurrentPosition(
                    resolve,
                    reject,
                    {
                      enableHighAccuracy: true,
                      timeout: 10000,
                      maximumAge: 0,
                    }
                  );
                });

                const { latitude, longitude } = position.coords;
                console.log('[LocationReminder] received coords from browser', {
                  latitude,
                  longitude,
                });
                await updateUserProfile({
                  location: {
                    lat: latitude,
                    lng: longitude,
                    source: 'browser',
                    updatedAt: Timestamp.now(),
                  } as any,
                });

                toast({
                  title: t('locationReminder.saved.title'),
                  description: t('locationReminder.saved.description'),
                });
              } catch (error) {
                console.warn('Failed to update user location from reminder:', error);
                toast({
                  title: t('locationReminder.failed.title'),
                  description: t('locationReminder.failed.description'),
                });
              } finally {
                console.log('[LocationReminder] location reminder flow completed');
              }
            }}
          >
            {t('locationReminder.action')}
          </ToastAction>
        ),
      });
      toastIdRef.current = toastId;
    }, 0);

    return () => {
      console.log('[LocationReminder] cleanup, clearing timeout', { timeoutId: id });
      window.clearTimeout(id);
    };
  }, [isLoading, user, toast, updateUserProfile, location.pathname, t]);

  return null;
};

export default LocationReminder;

