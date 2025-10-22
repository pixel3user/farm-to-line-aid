// Lightweight e-commerce helper utilities for demo flows

export type EcomCategory = 'shoes' | 't-shirts' | 'accessories';

export interface EcomProduct {
  id: string;
  name: string;
  category: EcomCategory;
  price: number;
  currency: string; // e.g., USD
  imageUrl: string;
  description?: string;
  tags?: string[];
}

export interface OrderStatusInfo {
  orderId: string;
  status: 'processing' | 'packed' | 'shipped' | 'out_for_delivery' | 'delivered' | 'cancelled';
  eta?: string; // ISO or short text
  lastUpdate?: string;
}

const CATALOG: EcomProduct[] = [
  {
    id: 'sku-shoe-001',
    name: 'NexRunner Pro',
    category: 'shoes',
    price: 129.99,
    currency: 'USD',
    imageUrl: 'https://picsum.photos/seed/shoes1/800/600',
    description: 'Breathable mesh upper with responsive cushioning.',
    tags: ['sneakers', 'running', 'sport']
  },
  {
    id: 'sku-shoe-002',
    name: 'Urban Glide',
    category: 'shoes',
    price: 99.0,
    currency: 'USD',
    imageUrl: 'https://picsum.photos/seed/shoes2/800/600',
    description: 'Everyday comfort with minimalist design.',
    tags: ['sneakers', 'casual']
  },
  {
    id: 'sku-tee-001',
    name: 'Classic Tee – Black',
    category: 't-shirts',
    price: 24.5,
    currency: 'USD',
    imageUrl: 'https://picsum.photos/seed/tee1/800/600',
    description: 'Soft cotton, regular fit.',
    tags: ['black', 'cotton', 'basic']
  },
  {
    id: 'sku-tee-002',
    name: 'Graphic Tee – Wave',
    category: 't-shirts',
    price: 29.0,
    currency: 'USD',
    imageUrl: 'https://picsum.photos/seed/tee2/800/600',
    description: 'Limited print, relaxed fit.',
    tags: ['graphic', 'limited']
  },
  {
    id: 'sku-acc-001',
    name: 'Pulse Earbuds',
    category: 'accessories',
    price: 59.99,
    currency: 'USD',
    imageUrl: 'https://picsum.photos/seed/earbuds/800/600',
    description: 'Wireless earbuds with deep bass.',
    tags: ['audio', 'wireless', 'bluetooth']
  },
  {
    id: 'sku-acc-002',
    name: 'City Pack Backpack',
    category: 'accessories',
    price: 74.0,
    currency: 'USD',
    imageUrl: 'https://picsum.photos/seed/backpack/800/600',
    description: 'Water-resistant with laptop sleeve.',
    tags: ['bag', 'backpack']
  }
];

export const EcomData = {
  getCategories(): EcomCategory[] {
    return ['shoes', 't-shirts', 'accessories'];
  },
  listByCategory(category: EcomCategory, limit: number = 5): EcomProduct[] {
    return CATALOG.filter(p => p.category === category).slice(0, limit);
  },
  search(keyword: string, limit: number = 5): EcomProduct[] {
    const q = keyword.trim().toLowerCase();
    if (!q) return [];
    return CATALOG.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.description?.toLowerCase().includes(q) ?? false) ||
      (p.tags ?? []).some(t => t.toLowerCase().includes(q))
    ).slice(0, limit);
  },
  getById(id: string): EcomProduct | undefined {
    return CATALOG.find(p => p.id === id);
  }
};

// Simple stubbed order status lookup
export const Orders = {
  getStatus(orderId: string): OrderStatusInfo | null {
    const digits = orderId.replace(/[^0-9]/g, '');
    if (!digits) return null;
    const last = parseInt(digits.slice(-1), 10);
    const states: OrderStatusInfo['status'][] = [
      'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered'
    ];
    const status = states[last % states.length];
    return {
      orderId,
      status,
      eta: status === 'delivered' ? undefined : '2-4 days',
      lastUpdate: new Date().toISOString()
    };
  }
};

export const Support = {
  faqs(): { q: string; a: string }[] {
    return [
      { q: 'What is your return policy?', a: '30-day returns on unworn items. Start in LIFF Orders.' },
      { q: 'How long is shipping?', a: 'Most orders ship within 24h and arrive in 2–5 days.' },
      { q: 'Do you ship internationally?', a: 'Yes, rates shown at checkout.' }
    ];
  }
};


