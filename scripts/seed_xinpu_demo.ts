import fs from 'node:fs';
import path from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

type BusinessType =
  | 'retailer'
  | 'restaurant'
  | 'wholesaler'
  | 'distributor'
  | 'hotel'
  | 'ecommerce'
  | 'processor'
  | 'other';

type FarmSeed = {
  name: string;
  productsFocus: string[];
  phone: string;
  address: string;
  postNumber: string;
  lat: number;
  lng: number;
  notes?: string;
};

type BuyerSeed = {
  businessName: string;
  businessType: BusinessType;
  contactName: string;
  phone: string;
  address: string;
  postNumber: string;
  lat: number;
  lng: number;
  notes?: string;
};

const farms: FarmSeed[] = [
  {
    name: '旺來有機農場 (Wanglai Organic Farm)',
    productsFocus: ['有機蔬菜', '葉菜', '當季水果'],
    phone: '03-589-9941',
    address: '新竹縣新埔鎮鹿鳴里黃梨園42號之1',
    postNumber: '305',
    lat: 24.8421,
    lng: 121.0705,
    notes: '有機蔬菜與農場體驗'
  },
  {
    name: '厚德自然農場 & 小農聯萌',
    productsFocus: ['放山雞蛋', '雞肉', '在地農產'],
    phone: '03-589-9390',
    address: '新竹縣新埔鎮北打鐵坑36號',
    postNumber: '305',
    lat: 24.8364,
    lng: 121.0607,
    notes: '放牧蛋與在地農產'
  },
  {
    name: '巨埔農場',
    productsFocus: ['有機蔬菜', '哈客風味餐', '農場體驗'],
    phone: '03-589-9612',
    address: '新竹縣新埔鎮巨埔里12鄰63號',
    postNumber: '305',
    lat: 24.8246,
    lng: 121.0854,
    notes: '有機蔬菜與餐飲體驗'
  },
  {
    name: '巨埔休閒生態農場',
    productsFocus: ['有機蔬果', '生態體驗'],
    phone: '03-589-0004',
    address: '新竹縣新埔鎮新龍路752巷2號',
    postNumber: '305',
    lat: 24.8288,
    lng: 121.082,
    notes: '生態休閒農場'
  },
  {
    name: '新埔鹿鳴坑綜合觀光果園',
    productsFocus: ['柑橘', '季節水果', '採果體驗'],
    phone: '0939-309-065',
    address: '新竹縣新埔鎮鹿鳴里9鄰1號',
    postNumber: '305',
    lat: 24.8472,
    lng: 121.0769,
    notes: '柑橘果園與採果'
  },
  {
    name: '新寶觀光果園',
    productsFocus: ['觀光果園', '季節水果', '採果體驗'],
    phone: '0921-697-832',
    address: '新竹縣新埔鎮寶石里文德路一段212-1號',
    postNumber: '305',
    lat: 24.8353,
    lng: 121.0634,
    notes: '觀光果園'
  },
  {
    name: '周家庄觀光農場 (九芎湖)',
    productsFocus: ['季節水果', '農場餐飲', '採果體驗'],
    phone: '03-589-0771',
    address: '新竹縣新埔鎮照門里六鄰九芎湖18號',
    postNumber: '305',
    lat: 24.8428,
    lng: 121.0897,
    notes: '九芎湖觀光農場'
  },
  {
    name: '新埔鎮農會「新農民市場」',
    productsFocus: ['在地蔬果', '米糧', '加工品'],
    phone: '03-588-4351',
    address: '新竹縣新埔鎮楊新路一段322號',
    postNumber: '305',
    lat: 24.8265,
    lng: 121.0732,
    notes: '農民直銷站'
  },
  {
    name: '新竹新埔新鮮田野有機農場',
    productsFocus: ['有機葉菜', '友善耕作蔬菜', '季節蔬果'],
    phone: '03-588-9123',
    address: '新竹縣新埔鎮中正路360號',
    postNumber: '305',
    lat: 24.8284,
    lng: 121.0718,
    notes: '有機葉菜小農'
  },
  {
    name: '新埔鎮連錢畜牧場',
    productsFocus: ['蛋品', '家禽', '放牧雞蛋'],
    phone: '0932-298-887',
    address: '新竹縣新埔鎮文山里15號',
    postNumber: '305',
    lat: 24.8337,
    lng: 121.0624,
    notes: '蛋品與家禽'
  }
];

const buyers: BuyerSeed[] = [
  {
    businessName: '新竹農產運銷股份有限公司（新竹果菜批發市場）',
    businessType: 'wholesaler',
    contactName: '採購部',
    phone: '03-526-2000',
    address: '新竹市東區經國路一段300號',
    postNumber: '300',
    lat: 24.8085,
    lng: 120.9697,
    notes: '批發市場採購'
  },
  {
    businessName: '峰豪國際事業有限公司',
    businessType: 'distributor',
    contactName: '林采購',
    phone: '03-550-2188',
    address: '新竹縣竹北市縣政二路180號',
    postNumber: '302',
    lat: 24.8264,
    lng: 121.0109,
    notes: '餐廳/飯店食材批發'
  },
  {
    businessName: '友利食品',
    businessType: 'distributor',
    contactName: '王經理',
    phone: '03-533-7788',
    address: '新竹市北區中正路420號',
    postNumber: '300',
    lat: 24.811,
    lng: 120.9659,
    notes: '在地肉品與食材供應'
  },
  {
    businessName: '偉珍有限公司（WeiZhen Central Kitchen）',
    businessType: 'processor',
    contactName: '陳採購',
    phone: '03-532-9912',
    address: '新竹市東區食品路210號',
    postNumber: '300',
    lat: 24.7957,
    lng: 120.9892,
    notes: '團膳中央廚房'
  },
  {
    businessName: '尚青餐飲中央廚房',
    businessType: 'processor',
    contactName: '吳小姐',
    phone: '03-531-6622',
    address: '新竹市香山區中華路五段160號',
    postNumber: '300',
    lat: 24.7729,
    lng: 120.9152,
    notes: '團膳採購'
  },
  {
    businessName: '豐揚團膳/食品供應',
    businessType: 'processor',
    contactName: '周採購',
    phone: '03-555-8844',
    address: '新竹縣竹北市成功五街88號',
    postNumber: '302',
    lat: 24.8335,
    lng: 121.0187,
    notes: '團膳供應'
  },
  {
    businessName: '有一家 SomeFresh',
    businessType: 'processor',
    contactName: '郭採購',
    phone: '03-535-4421',
    address: '新竹市東區光復路二段178號',
    postNumber: '300',
    lat: 24.8034,
    lng: 120.9812,
    notes: '團膳與團購供應'
  },
  {
    businessName: '新竹國賓大飯店',
    businessType: 'hotel',
    contactName: '採購部',
    phone: '03-515-1111',
    address: '新竹市中華路二段188號',
    postNumber: '300',
    lat: 24.803,
    lng: 120.9728,
    notes: '飯店餐飲採購'
  },
  {
    businessName: '新竹豐邑喜來登大飯店',
    businessType: 'hotel',
    contactName: '採購部',
    phone: '03-620-6000',
    address: '新竹縣竹北市光明六路東一段265號',
    postNumber: '302',
    lat: 24.8295,
    lng: 121.017,
    notes: '飯店餐飲採購'
  },
  {
    businessName: '煙波大飯店 新竹湖濱館',
    businessType: 'hotel',
    contactName: '採購部',
    phone: '03-520-3181',
    address: '新竹市明湖路773號',
    postNumber: '300',
    lat: 24.7679,
    lng: 120.9967,
    notes: '飯店餐飲採購'
  },
  {
    businessName: '新竹老爺酒店',
    businessType: 'hotel',
    contactName: '採購部',
    phone: '03-563-1122',
    address: '新竹市東區光復路一段227號',
    postNumber: '300',
    lat: 24.8039,
    lng: 120.9751,
    notes: '飯店餐飲採購'
  },
  {
    businessName: '柑仔店有機健康超市－帝國店',
    businessType: 'retailer',
    contactName: '門市採購',
    phone: '03-571-5566',
    address: '新竹市東區光復路二段295號B1',
    postNumber: '300',
    lat: 24.8017,
    lng: 120.9865,
    notes: '有機/健康超市'
  },
  {
    businessName: '里仁（Leezen）新竹門市',
    businessType: 'retailer',
    contactName: '門市採購',
    phone: '03-523-6899',
    address: '新竹市東區中央路120號',
    postNumber: '300',
    lat: 24.8041,
    lng: 120.9691,
    notes: '有機友善通路'
  },
  {
    businessName: '森林食堂 & 野餐市集',
    businessType: 'restaurant',
    contactName: '王主廚',
    phone: '03-561-9350',
    address: '新竹市東區食品路62號',
    postNumber: '300',
    lat: 24.7974,
    lng: 120.989,
    notes: '餐廳直採'
  },
  {
    businessName: '穀倉咖啡廳（新埔鎮農會園區內）',
    businessType: 'restaurant',
    contactName: '吳店長',
    phone: '03-588-4320',
    address: '新竹縣新埔鎮楊新路一段322號',
    postNumber: '305',
    lat: 24.8265,
    lng: 121.0732,
    notes: '農會園區內餐飲'
  }
];

const farmEmailHandles = [
  'wanglai.organic',
  'houde.nature',
  'jupu.farm',
  'jupu.eco',
  'luming.orchard',
  'xinbao.orchard',
  'zhoujia.farm',
  'xinpu.market',
  'xinpu.organic',
  'lianqian.eggs'
];

const buyerEmailHandles = [
  'hc.wholesale',
  'fenghao.supply',
  'youli.foods',
  'weizhen.kitchen',
  'shangqing.kitchen',
  'fengyang.catering',
  'somefresh.hsinchu',
  'ambassador.hsinchu',
  'sheraton.zhubei',
  'lakeshore.hsinchu',
  'royal.hsinchu',
  'ganzidian.organic',
  'leezen.hsinchu',
  'forest.kitchen',
  'grain.cafe'
];

const procurementNeedsByType: Record<BusinessType, string[]> = {
  retailer: ['在地蔬菜', '葉菜', '當季水果', '雞蛋'],
  restaurant: ['葉菜', '根莖類', '雞蛋', '季節水果'],
  wholesaler: ['蔬果量販', '蛋品', '當季水果'],
  distributor: ['冷鏈蔬果', '蛋品', '加工品'],
  hotel: ['精選蔬果', '蛋品', '高級水果'],
  ecommerce: ['小包裝蔬果', '禮盒水果', '放牧蛋'],
  processor: ['穩定蔬果', '蛋品', '加工原料'],
  other: ['在地蔬果', '季節水果', '友善畜產']
};

const farmProductTemplates = [
  {
    category: '雞蛋',
    unit: '每30顆裝',
    price: 220,
    stock: 36,
    tags: ['新鮮', '蛋品', '放牧']
  },
  {
    category: '葉菜',
    unit: '每公斤',
    price: 120,
    stock: 55,
    tags: ['葉菜', '當季', '有機']
  },
  {
    category: '水果',
    unit: '每公斤',
    price: 180,
    stock: 28,
    tags: ['水果', '季節', '產地直送']
  }
];

const buildProductName = (farmName: string, category: string) => {
  if (category === '雞蛋') return `${farmName} 放牧雞蛋`;
  if (category === '葉菜') return `${farmName} 有機綜合葉菜`;
  return `${farmName} 當季水果`;
};

const main = async () => {
  const seedTargetRaw = (process.env.SEED_TARGET || 'emulator').toLowerCase();
  const isProductionTarget = seedTargetRaw === 'prod' || seedTargetRaw === 'production';

  const projectId = process.env.GCLOUD_PROJECT || 'farm2market-99';
  process.env.GCLOUD_PROJECT = projectId;

  if (isProductionTarget) {
    const confirmProject = process.env.CONFIRM_PROD_SEED;
    if (process.env.ALLOW_PROD_SEED !== 'true' || confirmProject !== projectId) {
      throw new Error(
        `Refusing to run: to seed production, set ALLOW_PROD_SEED=true and CONFIRM_PROD_SEED=${projectId}.`
      );
    }
    delete process.env.FIRESTORE_EMULATOR_HOST;
  } else {
    const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8081';
    if (!/localhost|127\.0\.0\.1/.test(emulatorHost)) {
      throw new Error(`Refusing to run: FIRESTORE_EMULATOR_HOST is not local (${emulatorHost}).`);
    }
    process.env.FIRESTORE_EMULATOR_HOST = emulatorHost;
  }

  const defaultServiceAccountPath = path.resolve(
    process.cwd(),
    'farm2market-99-firebase-adminsdk-fbsvc-c333b4e691.json'
  );
  const serviceAccountPath = path.resolve(
    process.cwd(),
    process.env.GOOGLE_APPLICATION_CREDENTIALS || defaultServiceAccountPath
  );
  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(
      `Missing service account JSON at ${serviceAccountPath}. Set GOOGLE_APPLICATION_CREDENTIALS to point to your key file.`
    );
  }
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && serviceAccountPath === defaultServiceAccountPath) {
    console.warn(
      `Warning: using service account key from repo path (${defaultServiceAccountPath}). Prefer setting GOOGLE_APPLICATION_CREDENTIALS to a local, untracked file.`
    );
  }
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

  initializeApp({
    credential: cert(serviceAccount),
    projectId
  });

  const db = getFirestore();
  db.settings({ ignoreUndefinedProperties: true });

  const batch = db.batch();
  const now = Timestamp.now();

  farms.forEach((farm, index) => {
    const userIdPrefix = isProductionTarget ? 'seed_farmer_xinpu_' : 'farmer_xinpu_';
    const userId = `${userIdPrefix}${String(index + 1).padStart(3, '0')}`;
    const emailHandle = farmEmailHandles[index] || `xinpu.farm${String(index + 1).padStart(2, '0')}`;
    const email = `${emailHandle}@gmail.com`;

    const userDoc = {
      id: userId,
      lineUserId: userId,
      displayName: farm.name,
      email,
      role: 'farmer',
      roleSelectedAt: now,
      statusMessage: farm.notes ?? 'Xinpu demo farm profile',
      location: {
        lat: farm.lat,
        lng: farm.lng,
        source: 'manual',
        updatedAt: now
      },
      createdAt: now,
      updatedAt: now,
      isActive: true,
      subscriptionTier: 'free',
      preferences: {
        language: 'zh-TW',
        notifications: true,
        marketingOptIn: true
      },
      marketProfile: {
        businessName: farm.name,
        businessType: 'other',
        contactPhone: farm.phone,
        deliveryRegions: '新埔、竹北、新竹市區',
        procurementNeeds: farm.productsFocus
      },
      metadata: {
        totalMessages: 0,
        lastInteraction: now,
        favoriteFeatures: []
      }
    };

    batch.set(db.collection('line_users').doc(userId), userDoc, { merge: true });

    farmProductTemplates.forEach((template, pIndex) => {
      const productIdPrefix = isProductionTarget ? 'seed_prod_xinpu_' : 'prod_xinpu_';
      const productId = `${productIdPrefix}${String(index + 1).padStart(3, '0')}_${String(pIndex + 1)}`;
      const productDoc = {
        id: productId,
        userId,
        name: buildProductName(farm.name, template.category),
        description: `來自${farm.name}，強調${farm.productsFocus.join(' / ')}。`,
        category: template.category,
        price: template.price + pIndex * 20,
        unit: template.unit,
        stock: template.stock + index * 2,
        images: [],
        tags: [...template.tags, '新埔', '小農'],
        isActive: true,
        createdAt: now,
        updatedAt: now
      };
      batch.set(db.collection('products').doc(productId), productDoc, { merge: true });
    });
  });

  buyers.forEach((buyer, index) => {
    const userIdPrefix = isProductionTarget ? 'seed_market_xinpu_' : 'market_xinpu_';
    const storeIdPrefix = isProductionTarget ? 'seed_store_xinpu_' : 'store_xinpu_';
    const userId = `${userIdPrefix}${String(index + 1).padStart(3, '0')}`;
    const storeId = `${storeIdPrefix}${String(index + 1).padStart(3, '0')}`;
    const emailHandle = buyerEmailHandles[index] || `xinpu.buyer${String(index + 1).padStart(2, '0')}`;
    const email = `${emailHandle}@gmail.com`;
    const procurementNeeds = procurementNeedsByType[buyer.businessType] ?? procurementNeedsByType.other;

    const userDoc = {
      id: userId,
      lineUserId: userId,
      displayName: buyer.contactName,
      email,
      role: 'market',
      roleSelectedAt: now,
      location: {
        lat: buyer.lat,
        lng: buyer.lng,
        source: 'manual',
        updatedAt: now
      },
      createdAt: now,
      updatedAt: now,
      isActive: true,
      subscriptionTier: 'free',
      preferences: {
        language: 'zh-TW',
        notifications: true,
        marketingOptIn: true
      },
      marketProfile: {
        businessName: buyer.businessName,
        businessType: buyer.businessType,
        procurementNeeds,
        deliveryRegions: '新竹市區、竹北、新埔',
        deliveryNotes: '平日收貨，可配合冷鏈',
        budgetNotes: '視品項與品質報價',
        contactPhone: buyer.phone,
        preferredDeliveryDays: ['Mon', 'Wed', 'Fri'],
        paymentTerms: 'net30',
        volumeRange: buyer.businessType === 'hotel' ? '120-200 公斤/週' : '80-150 公斤/週',
        sourcingRegions: '新竹、苗栗',
        specialNotes: '需標示產地與採收日期'
      },
      metadata: {
        totalMessages: 0,
        lastInteraction: now,
        favoriteFeatures: []
      }
    };

    const storeDoc = {
      id: storeId,
      userId,
      name: buyer.businessName,
      type:
        buyer.businessType === 'restaurant'
          ? 'restaurant'
          : buyer.businessType === 'retailer'
          ? 'supermarket'
          : buyer.businessType === 'hotel'
          ? 'restaurant'
          : 'other',
      location: buyer.address,
      contact: {
        name: buyer.contactName,
        phone: buyer.phone,
        email
      },
      pickup: {
        address: buyer.address,
        yamatoZipCode: buyer.postNumber,
        postNumber: buyer.postNumber,
        lat: buyer.lat,
        lng: buyer.lng,
        contactName: buyer.contactName,
        contactTel: buyer.phone,
        verifiedAt: now
      },
      status: 'potential',
      metadata: {
        firstContact: now,
        totalOrders: 0,
        totalRevenue: 0,
        notes: [buyer.notes ?? 'Demo buyer record']
      },
      createdAt: now,
      updatedAt: now
    };

    batch.set(db.collection('line_users').doc(userId), userDoc, { merge: true });
    batch.set(db.collection('stores').doc(storeId), storeDoc, { merge: true });
  });

  await batch.commit();
  console.log(
    `Seeded ${farms.length} farmers + ${farms.length * farmProductTemplates.length} products + ${buyers.length} market users/stores (${isProductionTarget ? 'production' : 'emulator'}).`
  );
};

main().catch((error) => {
  console.error('Failed to seed Xinpu demo data:', error);
  process.exitCode = 1;
});
