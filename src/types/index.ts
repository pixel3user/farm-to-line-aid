// Core data models for Farm→LINE web app

export interface Product {
  id: string;
  farmerId: string;
  name: string;
  category: 'eggs' | 'poultry' | 'vegetables' | 'fruits' | 'dairy' | 'other';
  grade: 'A' | 'AA' | 'AAA' | 'Premium' | 'Standard';
  unit: string;
  pack: number;
  price: number; // TWD
  stock: number;
  photos: string[];
  active: boolean;
  updatedAt: Date;
  description?: string;
  certifications?: string[];
}

export interface Store {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  distanceKm: number;
  keywords: string[];
  rating: number;
  phone?: string;
  website?: string;
  leadScore: number; // 0-100
  status: 'new' | 'contacted' | 'follow-up' | 'won' | 'lost';
  notes?: string;
  lastContactAt?: Date;
  contactPerson?: string;
  businessHours?: string;
}

export interface Farm {
  id: string;
  name: string;
  location: string;
  city: string;
  district: string;
  lat: number;
  lng: number;
  rating: number;
  deliveryDays: ('monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday')[];
  certifications: string[];
  products: Product[];
  contact: {
    name: string;
    phone: string;
    email?: string;
  };
  description?: string;
  establishedYear?: number;
  farmSize?: string;
}

export interface Lead {
  id: string;
  storeId: string;
  farmerId: string;
  score: number;
  status: 'new' | 'contacted' | 'follow-up' | 'won' | 'lost';
  notes: string;
  lastContactAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduleSlot {
  farmId: string;
  weekday: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  window: 'AM' | 'PM';
  capacity: number;
  available: boolean;
  price?: number; // delivery fee
}

export interface Rating {
  id: string;
  farmId: string;
  buyerId: string;
  stars: 1 | 2 | 3 | 4 | 5;
  dimensions: {
    consistency: number;
    timeliness: number;
    packaging: number;
    comms: number;
  };
  comment: string;
  createdAt: Date;
  productId?: string;
}

export interface ForecastInput {
  buyerId: string;
  lastOrderDate: Date;
  qty: number;
  pack: number;
  productId: string;
}

export interface ForecastOutput {
  nextWindowISO: string;
  qtyRange: {
    min: number;
    max: number;
  };
  confidence: number; // 0-1
  reasoning: string;
}

export interface MarketingMaterial {
  id: string;
  farmerId: string;
  type: 'flyer' | 'shelf-card' | 'one-pager' | 'recipe-card';
  template: string;
  content: {
    title: string;
    subtitle?: string;
    description: string;
    price?: string;
    contact: string;
    bilingual: {
      en: string;
      zh: string;
    };
  };
  imageUrl: string;
  downloadUrl: string;
  createdAt: Date;
  productId?: string;
}

export interface UserRole {
  type: 'farmer' | 'market';
  preferences: {
    language: 'en' | 'zh-TW';
    notifications: boolean;
    marketingOptIn: boolean;
    location?: {
      city: string;
      district: string;
    };
    buyingPreferences?: {
      categories: string[];
      grades: string[];
      budgetRange: {
        min: number;
        max: number;
      };
      deliveryDays: string[];
    };
  };
}

export interface KPIData {
  remindersDueToday: number;
  leadsThisWeek: number;
  activeProducts: number;
  onTimeReorders: number;
  stockoutRisk: number;
  conversionRate: number;
  totalRevenue: number;
  monthlyGrowth: number;
}

export interface SearchFilters {
  location?: {
    city: string;
    district?: string;
    distance?: number;
  };
  category?: string;
  grade?: string;
  priceBand?: {
    min: number;
    max: number;
  };
  deliveryDay?: string;
  rating?: number;
  keywords?: string[];
  certifications?: string[];
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// UI State types
export interface LoadingState {
  isLoading: boolean;
  error?: string;
}

export interface FilterState {
  search: string;
  category: string;
  grade: string;
  priceRange: [number, number];
  location: string;
  deliveryDay: string;
  rating: number;
}

// Form types
export interface ProductFormData {
  name: string;
  category: string;
  grade: string;
  unit: string;
  pack: number;
  price: number;
  stock: number;
  description?: string;
  photos: File[];
}

export interface StoreSearchFormData {
  query: string;
  distance: number;
  keywords: string[];
  ratingMin: number;
  hasContact: boolean;
  openNow: boolean;
}

export interface MarketingFormData {
  productId?: string;
  type: 'flyer' | 'shelf-card' | 'one-pager' | 'recipe-card';
  template: string;
  title: string;
  subtitle?: string;
  description: string;
  price?: string;
  contact: string;
  photo?: File;
}

// Navigation types
export interface NavItem {
  label: string;
  href: string;
  icon?: string;
  children?: NavItem[];
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

// Language types
export interface Language {
  code: 'en' | 'zh-TW';
  name: string;
  flag: string;
}

export interface Translation {
  [key: string]: string;
}

// Map types
export interface MapLocation {
  lat: number;
  lng: number;
  zoom?: number;
}

export interface MapMarker {
  id: string;
  position: MapLocation;
  title: string;
  description?: string;
  type: 'store' | 'farm' | 'delivery';
  data?: any;
}
