import { useEffect, useRef } from 'react';

export interface UseScrollRevealOptions extends IntersectionObserverInit {
  once?: boolean;
  selector?: string;
}

export function useScrollReveal(options?: UseScrollRevealOptions) {
  const { once = true, selector = '.reveal', root, rootMargin, threshold } = options || {};
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const container = (containerRef.current as HTMLElement | null) ?? document.body;
    const elements = Array.from(container.querySelectorAll(selector));

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            if (once) {
              observer.unobserve(entry.target);
            }
          }
        });
      },
      { root: root ?? null, rootMargin, threshold: threshold ?? 0.15 }
    );

    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
    // We purposefully do not include `elements` in deps to avoid re-observing on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, rootMargin, threshold, once, selector]);

  return containerRef;
}

export default useScrollReveal;


