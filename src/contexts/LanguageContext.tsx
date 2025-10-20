import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { en, TranslationKey } from "@/i18n/en";
import { zhTW } from "@/i18n/zh-TW";

export type Language = "en" | "zh-TW";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  changeLanguage: (lang: Language) => void;
  t: (key: TranslationKey | string) => string;
}

const STORAGE_KEY = "farm2market_language";

const translations = {
  en,
  "zh-TW": zhTW,
} satisfies Record<Language, typeof en>;

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
}

const isBrowser = typeof window !== "undefined";

const mapCountryToLanguage = (countryCode: string | undefined): Language | null => {
  if (!countryCode) return null;
  const code = countryCode.toUpperCase();
  if (["TW", "HK", "MO", "CN"].includes(code)) {
    return "zh-TW";
  }
  return null;
};

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    // Initialize with browser language detection first for immediate display
    if (!isBrowser) return "en";
    
    // Check localStorage first
    const stored = localStorage.getItem(STORAGE_KEY) as Language | null;
    if (stored === "zh-TW" || stored === "en") {
      return stored;
    }
    
    // Quick browser language detection for immediate display
    if (typeof navigator !== "undefined") {
      const navLangs = navigator.languages && navigator.languages.length > 0
        ? navigator.languages
        : navigator.language
        ? [navigator.language]
        : [];
      const match = navLangs.find((lang) => lang.toLowerCase().startsWith("zh"));
      if (match) {
        return "zh-TW";
      }
    }
    
    return "en";
  });
  
  const [hasUserPreference, setHasUserPreference] = useState(() => {
    if (!isBrowser) return false;
    const stored = localStorage.getItem(STORAGE_KEY) as Language | null;
    return stored === "zh-TW" || stored === "en";
  });

  useEffect(() => {
    if (!isBrowser || hasUserPreference) return;

    let cancelled = false;
    const controller = new AbortController();

    const detectPreferredLanguage = async () => {
      let detected: Language | null = null;
      
      // Try multiple IP detection services for better reliability
      const ipServices = [
        "https://ipapi.co/json/",
        "https://ip-api.com/json/",
        "https://api.country.is/"
      ];

      for (const service of ipServices) {
        try {
          const response = await fetch(service, { 
            signal: controller.signal,
            timeout: 2000 // 2 second timeout
          });
          if (response.ok) {
            const data = await response.json();
            let code: string | undefined;
            
            // Handle different API response formats
            if (service.includes("ipapi.co")) {
              code = data?.country_code || data?.country;
            } else if (service.includes("ip-api.com")) {
              code = data?.countryCode;
            } else if (service.includes("country.is")) {
              code = data?.country;
            }
            
            detected = mapCountryToLanguage(code);
            if (detected) break; // Found a valid detection, stop trying other services
          }
        } catch (error) {
          // Continue to next service
          continue;
        }
      }

      // If IP detection failed, keep the browser-detected language
      if (!detected) {
        detected = language; // Keep current browser-detected language
      }

      if (!cancelled) {
        setLanguageState(detected);
        setHasUserPreference(true);
        localStorage.setItem(STORAGE_KEY, detected);
      }
    };

    // Run IP detection in background with a small delay to not block initial render
    const timeoutId = setTimeout(detectPreferredLanguage, 100);

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [hasUserPreference, language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    setHasUserPreference(true);
    if (isBrowser) {
      localStorage.setItem(STORAGE_KEY, lang);
    }
  }, []);

  const changeLanguage = useCallback((lang: Language) => {
    setLanguage(lang);
  }, [setLanguage]);

  const t = useCallback(
    (key: TranslationKey | string): string => {
      const dict = translations[language] as Record<string, string>;
      return dict[key] ?? key;
    },
    [language]
  );

  const value: LanguageContextType = {
    language,
    setLanguage,
    changeLanguage,
    t,
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};

export default LanguageContext;
