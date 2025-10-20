// Mobile Optimization Utilities for Farm2Market AI Platform
// Optimized for LINE LIFF and mobile-first design

export interface MobileOptimizationConfig {
  isMobile: boolean;
  isLiffApp: boolean;
  screenSize: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  touchDevice: boolean;
  orientation: 'portrait' | 'landscape';
}

export class MobileOptimization {
  private static instance: MobileOptimization;
  private config: MobileOptimizationConfig;

  private constructor() {
    this.config = this.detectDevice();
    this.setupEventListeners();
  }

  public static getInstance(): MobileOptimization {
    if (!MobileOptimization.instance) {
      MobileOptimization.instance = new MobileOptimization();
    }
    return MobileOptimization.instance;
  }

  private detectDevice(): MobileOptimizationConfig {
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    const isLiffApp = userAgent.includes('line');
    const touchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    // Screen size detection
    const width = window.innerWidth;
    let screenSize: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    if (width < 640) screenSize = 'xs';
    else if (width < 768) screenSize = 'sm';
    else if (width < 1024) screenSize = 'md';
    else if (width < 1280) screenSize = 'lg';
    else screenSize = 'xl';

    const orientation = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';

    return {
      isMobile,
      isLiffApp,
      screenSize,
      touchDevice,
      orientation
    };
  }

  private setupEventListeners(): void {
    // Listen for resize events
    window.addEventListener('resize', () => {
      this.config = this.detectDevice();
    });

    // Listen for orientation changes
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        this.config = this.detectDevice();
      }, 100);
    });
  }

  public getConfig(): MobileOptimizationConfig {
    return { ...this.config };
  }

  // Responsive class utilities
  public getResponsiveClasses(baseClasses: string, mobileClasses?: string, liffClasses?: string): string {
    let classes = baseClasses;
    
    if (this.config.isMobile && mobileClasses) {
      classes += ` ${mobileClasses}`;
    }
    
    if (this.config.isLiffApp && liffClasses) {
      classes += ` ${liffClasses}`;
    }
    
    return classes;
  }

  // Mobile-optimized spacing
  public getSpacingClasses(desktop: string, mobile: string): string {
    return this.config.isMobile ? mobile : desktop;
  }

  // Touch-friendly button sizing
  public getTouchButtonSize(): string {
    if (this.config.isLiffApp) {
      return 'min-h-[44px] min-w-[44px]'; // iOS touch target minimum
    }
    return this.config.isMobile ? 'min-h-[40px] min-w-[40px]' : '';
  }

  // Mobile-optimized text sizing
  public getTextSizeClasses(baseSize: string, mobileSize?: string): string {
    if (this.config.isMobile && mobileSize) {
      return mobileSize;
    }
    return baseSize;
  }

  // LIFF-specific optimizations
  public getLiffOptimizations(): {
    safeArea: string;
    bottomPadding: string;
    navigationHeight: string;
  } {
    if (!this.config.isLiffApp) {
      return {
        safeArea: '',
        bottomPadding: '',
        navigationHeight: ''
      };
    }

    return {
      safeArea: 'pt-safe-top pb-safe-bottom',
      bottomPadding: this.config.isMobile ? 'pb-20' : 'pb-4',
      navigationHeight: 'h-16'
    };
  }

  // Mobile grid utilities
  public getGridClasses(desktopCols: number, mobileCols: number = 1): string {
    const mobileGrid = `grid-cols-${mobileCols}`;
    const desktopGrid = `md:grid-cols-${desktopCols}`;
    return `grid ${mobileGrid} ${desktopGrid}`;
  }

  // Mobile card optimization
  public getCardClasses(): string {
    const baseClasses = 'rounded-lg shadow-sm border';
    const mobileClasses = 'p-3 m-2';
    const desktopClasses = 'p-6 m-0';
    
    return this.getResponsiveClasses(
      baseClasses,
      mobileClasses,
      desktopClasses
    );
  }

  // Mobile form optimization
  public getFormClasses(): string {
    const baseClasses = 'space-y-4';
    const mobileClasses = 'space-y-3';
    const liffClasses = 'space-y-4';
    
    return this.getResponsiveClasses(
      baseClasses,
      mobileClasses,
      liffClasses
    );
  }

  // Mobile input optimization
  public getInputClasses(): string {
    const baseClasses = 'w-full';
    const mobileClasses = 'h-12 text-base'; // Larger touch targets
    const liffClasses = 'h-12 text-base';
    
    return this.getResponsiveClasses(
      baseClasses,
      mobileClasses,
      liffClasses
    );
  }

  // Mobile navigation optimization
  public getNavigationClasses(): string {
    if (this.config.isLiffApp && this.config.isMobile) {
      return 'fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50';
    }
    
    if (this.config.isMobile) {
      return 'fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-50';
    }
    
    return 'sticky top-0 bg-white border-b border-gray-200 z-40';
  }

  // Mobile modal optimization
  public getModalClasses(): string {
    const baseClasses = 'fixed inset-0 z-50';
    const mobileClasses = 'p-4';
    const liffClasses = 'p-2';
    
    return this.getResponsiveClasses(
      baseClasses,
      mobileClasses,
      liffClasses
    );
  }

  // Performance optimizations for mobile
  public getPerformanceOptimizations(): {
    imageLoading: 'lazy' | 'eager';
    animationReduced: boolean;
    touchAction: string;
  } {
    return {
      imageLoading: this.config.isMobile ? 'lazy' : 'eager',
      animationReduced: this.config.isMobile,
      touchAction: this.config.touchDevice ? 'manipulation' : 'auto'
    };
  }

  // Mobile-specific accessibility
  public getAccessibilityClasses(): string {
    const classes = [];
    
    if (this.config.touchDevice) {
      classes.push('touch-manipulation');
    }
    
    if (this.config.isMobile) {
      classes.push('select-none'); // Prevent text selection on mobile
    }
    
    return classes.join(' ');
  }
}

// Hook for React components
export const useMobileOptimization = () => {
  const optimization = MobileOptimization.getInstance();
  return optimization.getConfig();
};

// Utility functions for common mobile patterns
export const mobileUtils = {
  // Safe area handling for LIFF
  getSafeAreaClasses: (isLiff: boolean, isMobile: boolean) => {
    if (isLiff && isMobile) {
      return 'pt-safe-top pb-safe-bottom pl-safe-left pr-safe-right';
    }
    return '';
  },

  // Mobile-optimized container
  getContainerClasses: (isMobile: boolean) => {
    return isMobile 
      ? 'px-3 py-2 max-w-full' 
      : 'px-6 py-4 max-w-7xl mx-auto';
  },

  // Mobile-optimized button
  getButtonClasses: (isMobile: boolean, isLiff: boolean) => {
    const baseClasses = 'font-medium rounded-lg transition-colors';
    const mobileClasses = isMobile ? 'h-12 px-6 text-base' : 'h-10 px-4 text-sm';
    const liffClasses = isLiff ? 'min-h-[44px]' : '';
    
    return `${baseClasses} ${mobileClasses} ${liffClasses}`;
  },

  // Mobile-optimized card
  getCardClasses: (isMobile: boolean) => {
    return isMobile 
      ? 'rounded-xl p-4 shadow-md border-0' 
      : 'rounded-lg p-6 shadow-sm border';
  },

  // Mobile-optimized text
  getTextClasses: (isMobile: boolean, size: 'sm' | 'base' | 'lg' | 'xl') => {
    const sizeMap = {
      sm: isMobile ? 'text-sm' : 'text-xs',
      base: isMobile ? 'text-base' : 'text-sm',
      lg: isMobile ? 'text-lg' : 'text-base',
      xl: isMobile ? 'text-xl' : 'text-lg'
    };
    
    return sizeMap[size];
  }
};

export default MobileOptimization;
