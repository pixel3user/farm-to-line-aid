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

type AddressSeed = {
  area: string;
  address: string;
  postNumber: string;
  lat: number;
  lng: number;
};

const addressSeeds: AddressSeed[] = [
  { area: '新竹市東區', address: '新竹市東區光復路二段 101 號', postNumber: '300', lat: 24.8047, lng: 120.9786 },
  { area: '新竹市東區', address: '新竹市東區公道五路二段 120 號', postNumber: '300', lat: 24.8084, lng: 120.987 },
  { area: '新竹市東區', address: '新竹市東區食品路 120 號', postNumber: '300', lat: 24.7963, lng: 120.9883 },
  { area: '新竹市東區', address: '新竹市東區建功一路 66 號', postNumber: '300', lat: 24.8021, lng: 120.9945 },
  { area: '新竹市北區', address: '新竹市北區北大路 88 號', postNumber: '300', lat: 24.8119, lng: 120.9662 },
  { area: '新竹市北區', address: '新竹市北區中正路 200 號', postNumber: '300', lat: 24.8092, lng: 120.9687 },
  { area: '新竹市北區', address: '新竹市北區經國路二段 110 號', postNumber: '300', lat: 24.8215, lng: 120.9671 },
  { area: '新竹市香山區', address: '新竹市香山區中華路五段 120 號', postNumber: '300', lat: 24.7726, lng: 120.9135 },
  { area: '新竹市香山區', address: '新竹市香山區牛埔路 300 號', postNumber: '300', lat: 24.7804, lng: 120.9208 },
  { area: '新竹市香山區', address: '新竹市香山區牛埔東路 35 號', postNumber: '300', lat: 24.784, lng: 120.9256 },
  { area: '新竹縣竹北市', address: '新竹縣竹北市光明六路東一段 10 號', postNumber: '302', lat: 24.8286, lng: 121.0123 },
  { area: '新竹縣竹北市', address: '新竹縣竹北市縣政二路 35 號', postNumber: '302', lat: 24.8267, lng: 121.0101 },
  { area: '新竹縣竹北市', address: '新竹縣竹北市成功八路 66 號', postNumber: '302', lat: 24.8341, lng: 121.0208 },
  { area: '新竹縣竹北市', address: '新竹縣竹北市文興路 98 號', postNumber: '302', lat: 24.8423, lng: 121.0247 },
  { area: '新竹縣竹北市', address: '新竹縣竹北市博愛街 200 號', postNumber: '302', lat: 24.8362, lng: 121.0049 },
  { area: '新竹縣竹東鎮', address: '新竹縣竹東鎮長安路 12 號', postNumber: '310', lat: 24.7362, lng: 121.0914 },
  { area: '新竹縣竹東鎮', address: '新竹縣竹東鎮中興路四段 50 號', postNumber: '310', lat: 24.7449, lng: 121.0882 },
  { area: '新竹縣新埔鎮', address: '新竹縣新埔鎮中正路 300 號', postNumber: '305', lat: 24.8274, lng: 121.0728 },
  { area: '新竹縣湖口鄉', address: '新竹縣湖口鄉中正路一段 55 號', postNumber: '303', lat: 24.9032, lng: 121.0449 },
  { area: '新竹縣湖口鄉', address: '新竹縣湖口鄉達生路 58 號', postNumber: '303', lat: 24.9059, lng: 121.0467 },
  { area: '新竹縣新豐鄉', address: '新竹縣新豐鄉新興路 101 號', postNumber: '304', lat: 24.9001, lng: 120.9864 },
  { area: '新竹縣關西鎮', address: '新竹縣關西鎮中正路 77 號', postNumber: '306', lat: 24.7863, lng: 121.1756 },
  { area: '新竹縣芎林鄉', address: '新竹縣芎林鄉文德路 8 號', postNumber: '307', lat: 24.7752, lng: 121.0811 },
  { area: '新竹縣寶山鄉', address: '新竹縣寶山鄉大崎路 20 號', postNumber: '308', lat: 24.7394, lng: 121.0026 },
  { area: '新竹縣北埔鄉', address: '新竹縣北埔鄉中山路 5 號', postNumber: '314', lat: 24.6999, lng: 121.0572 },
  { area: '新竹縣峨眉鄉', address: '新竹縣峨眉鄉富興村 18 號', postNumber: '315', lat: 24.7091, lng: 121.0157 },
  { area: '新竹縣尖石鄉', address: '新竹縣尖石鄉義興村 10 號', postNumber: '313', lat: 24.6962, lng: 121.2035 },
  { area: '新竹縣五峰鄉', address: '新竹縣五峰鄉大隘村 3 號', postNumber: '311', lat: 24.6015, lng: 121.1244 },
  { area: '新竹市東區', address: '新竹市東區中央路 80 號', postNumber: '300', lat: 24.804, lng: 120.9689 },
  { area: '新竹市北區', address: '新竹市北區延平路一段 180 號', postNumber: '300', lat: 24.823, lng: 120.9543 }
];

const contactNames = [
  '陳怡君', '林志豪', '黃詩涵', '張家維', '許雅雯', '郭柏廷',
  '蔡佩珊', '王冠宇', '李欣儀', '楊博翔', '吳雅婷', '鄭凱翔',
  '周宜庭', '何俊傑', '劉筱涵', '彭子芸', '鍾浩然', '江怡蓉',
  '洪冠廷', '曾雅雯', '莊子涵', '邱家豪', '賴怡君', '傅浩宇',
  '蘇靖雯', '潘郁婷', '羅廷宇', '葉芝羽', '柯柏宇', '謝韻庭'
];

const contactEmailHandles = [
  'yijun.chen',
  'zhihao.lin',
  'shihan.huang',
  'jiawei.chang',
  'yawen.hsu',
  'boting.kuo',
  'peishan.tsai',
  'guanyu.wang',
  'xinyi.li',
  'boxiang.yang',
  'yating.wu',
  'kaixiang.cheng',
  'yiting.chou',
  'junjie.ho',
  'xiaohan.liu',
  'ziyun.peng',
  'haoran.chung',
  'yirong.chiang',
  'guanting.hung',
  'yawen.tseng',
  'zihan.chuang',
  'jiahao.chiu',
  'yijun.lai',
  'haoyu.fu',
  'jingwen.su',
  'yuting.pan',
  'tingyu.lo',
  'zhiyu.yeh',
  'boyu.ko',
  'yunting.hsieh'
];

const brandPrefixes = [
  '竹風', '晨曦', '禾豐', '青禾', '好田', '山嵐',
  '澄蔬', '順昌', '展裕', '安禾', '玉山', '瑞田',
  '聚合', '京禾', '裕佳', '新竹', '竹青', '松禾',
  '福田', '宏豐', '鼎盛', '光華', '東光', '南光',
  '北城', '瑞興', '豐饌', '雅集', '佳鮮', '益成'
];

const businessTypes: BusinessType[] = [
  'retailer', 'restaurant', 'wholesaler', 'distributor', 'hotel', 'ecommerce',
  'processor', 'retailer', 'restaurant', 'wholesaler', 'distributor', 'hotel',
  'ecommerce', 'processor', 'retailer', 'restaurant', 'wholesaler', 'distributor',
  'hotel', 'ecommerce', 'processor', 'retailer', 'restaurant', 'wholesaler',
  'distributor', 'hotel', 'ecommerce', 'processor', 'retailer', 'other'
];

const businessSuffixes: Record<BusinessType, string[]> = {
  retailer: ['生鮮超市', '量販中心', '蔬果市集', '生活超市'],
  restaurant: ['家常食堂', '旬味小館', '料理坊', '季節餐館'],
  wholesaler: ['蔬果批發', '果菜行', '生鮮批發中心'],
  distributor: ['冷鏈物流', '配送中心', '冷藏配送'],
  hotel: ['飯店廚務', '宴會餐飲', '會館廚房'],
  ecommerce: ['嚴選電商', '線上市集', '電商採購'],
  processor: ['食品加工廠', '農產加工', '食材工廠'],
  other: ['食材合作社', '食材供應站']
};

const needsByType: Record<BusinessType, string[]> = {
  retailer: ['青江菜', '小白菜', '地瓜', '洋蔥', '放牧雞蛋', '當季水果'],
  restaurant: ['番茄', '甜椒', '香菇', '雞腿', '鴨蛋', '香草'],
  wholesaler: ['高麗菜', '空心菜', '胡蘿蔔', '香蕉', '鳳梨', '芋頭'],
  distributor: ['冷鏈蔬果', '雞蛋', '水果', '奶製品', '蔥蒜', '根莖類'],
  hotel: ['精選蔬果', '蛋品', '有機米', '乳製品', '香草', '高級水果'],
  ecommerce: ['小包裝蔬果', '禮盒水果', '放牧蛋', '加工品', '友善畜產'],
  processor: ['原料蔬菜', '蛋液', '馬鈴薯', '洋蔥', '紅蘿蔔', '玉米'],
  other: ['在地蔬果', '季節水果', '友善畜產', '雜糧', '乾貨']
};

const deliveryNotesOptions = [
  '上午 8-11 收貨，需冷鏈配送',
  '下午 1-4 可收貨，需提供批號',
  '周一至周五收貨，假日不收',
  '需冷藏車配送，並附產地證明',
  '早上收貨優先，請提前一天確認'
];

const budgetNotesOptions = [
  '以穩定長約為主，品質優先',
  '可配合季節浮動，需提前通知',
  '希望有月結條件，價格合理即可',
  '重視穩定供應與準時到貨',
  '可提供試單，再評估擴量'
];

const specialNotesOptions = [
  '希望提供產地證明與批號',
  '可接受產履歷標章',
  '需冷鏈/保冰配送',
  '包裝需標示採收日期',
  '可配合小批量多頻次配送'
];

const deliveryRegionOptions = [
  '新竹市區、竹北、湖口',
  '新竹市區、香山、竹南',
  '竹北、竹東、新埔',
  '新竹市區、竹北、芎林',
  '湖口、新豐、竹北'
];

const sourcingRegionOptions = [
  '新竹、苗栗',
  '新竹、桃園',
  '新竹、中部產區',
  '北部農場',
  '新竹、彰化、雲林'
];

const storeNoteOptions = [
  '需求穩定，偏好早上收貨',
  '注重品項穩定與規格一致',
  '可接受季節替換品項',
  '需冷鏈配送與完整標示',
  '重視交期與品管'
];

const deliveryDays = [
  ['Mon', 'Wed', 'Fri'],
  ['Tue', 'Thu', 'Sat'],
  ['Daily'],
  ['Mon', 'Tue', 'Thu'],
  ['Wed', 'Fri'],
  ['Mon', 'Thu'],
  ['Tue', 'Fri']
];

const paymentTerms = ['net15', 'net30', 'net7', 'cod'];

const buildBusinessName = (area: string, type: BusinessType, index: number) => {
  const shortArea = area.replace('新竹市', '新竹').replace('新竹縣', '新竹');
  const brand = brandPrefixes[index % brandPrefixes.length];
  const suffixes = businessSuffixes[type] || businessSuffixes.other;
  const suffix = suffixes[index % suffixes.length];
  return `${shortArea}${brand}${suffix}`;
};

const randomPick = <T,>(items: T[], index: number) => items[index % items.length];

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

  addressSeeds.forEach((seed, index) => {
    const userIdPrefix = isProductionTarget ? 'seed_market_hc_' : 'market_hc_';
    const storeIdPrefix = isProductionTarget ? 'seed_store_hc_' : 'store_hc_';
    const userId = `${userIdPrefix}${String(index + 1).padStart(3, '0')}`;
    const storeId = `${storeIdPrefix}${String(index + 1).padStart(3, '0')}`;
    const type = businessTypes[index] ?? 'retailer';
    const businessName = buildBusinessName(seed.area, type, index);
    const contactName = contactNames[index] ?? `採購${String(index + 1).padStart(2, '0')}`;
    const emailHandle =
      contactEmailHandles[index] ?? `buyer${String(index + 1).padStart(2, '0')}`;
    const email = `${emailHandle}@gmail.com`;
    const contactPhone = `03-${String(5200 + (index % 4000)).padStart(4, '0')}-${String(1000 + (index * 37) % 9000).padStart(4, '0')}`;
    const needsBase = needsByType[type] || needsByType.retailer;
    const needs = [...needsBase.slice(index % needsBase.length), ...needsBase].slice(0, 4);
    const preferredDays = randomPick(deliveryDays, index);
    const payment = randomPick(paymentTerms, index);
    const volumeRange =
      type === 'hotel'
        ? `${120 + (index % 4) * 30}-${200 + (index % 4) * 30} 公斤/週`
        : type === 'wholesaler' || type === 'distributor'
        ? `${200 + (index % 5) * 40}-${360 + (index % 5) * 40} 公斤/週`
        : type === 'restaurant'
        ? `${60 + (index % 4) * 15}-${120 + (index % 4) * 15} 公斤/週`
        : `${80 + (index % 4) * 20}-${160 + (index % 4) * 20} 公斤/週`;
    const deliveryNotes = randomPick(deliveryNotesOptions, index);
    const budgetNotes = randomPick(budgetNotesOptions, index);
    const specialNotes = randomPick(specialNotesOptions, index);
    const deliveryRegions = randomPick(deliveryRegionOptions, index);
    const sourcingRegions = randomPick(sourcingRegionOptions, index);
    const storeNote = randomPick(storeNoteOptions, index);
    const statusOptions = ['potential', 'contacted', 'customer', 'former_customer'] as const;
    const status = statusOptions[index % statusOptions.length];
    const baseOrders =
      status === 'customer' ? 24
      : status === 'contacted' ? 8
      : status === 'former_customer' ? 16
      : 4;
    const totalOrders = baseOrders + (index % 9);
    const averageOrderValue =
      type === 'hotel'
        ? 4800
        : type === 'wholesaler' || type === 'distributor'
        ? 5200
        : type === 'restaurant'
        ? 2600
        : 3000;
    const totalRevenue =
      Math.round((totalOrders * averageOrderValue * (0.9 + ((index % 5) * 0.03))) / 10) * 10;

    const userDoc = {
      id: userId,
      lineUserId: userId,
      displayName: contactName,
      email,
      role: 'market',
      roleSelectedAt: now,
      location: {
        lat: seed.lat,
        lng: seed.lng,
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
        businessName,
        businessType: type,
        procurementNeeds: needs,
        deliveryRegions,
        deliveryNotes,
        budgetNotes,
        contactPhone,
        preferredDeliveryDays: preferredDays,
        paymentTerms: payment,
        volumeRange,
        sourcingRegions,
        specialNotes
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
      name: businessName,
      type:
        type === 'restaurant'
          ? 'restaurant'
          : type === 'retailer'
          ? 'supermarket'
          : type === 'ecommerce'
          ? 'online_store'
          : 'other',
      location: seed.address,
      contact: {
        name: contactName,
        phone: contactPhone,
        email
      },
      pickup: {
        address: seed.address,
        yamatoZipCode: seed.postNumber,
        postNumber: seed.postNumber,
        lat: seed.lat,
        lng: seed.lng,
        contactName,
        contactTel: contactPhone,
        verifiedAt: now
      },
      status,
      metadata: {
        firstContact: now,
        totalOrders,
        totalRevenue,
        notes: [storeNote]
      },
      createdAt: now,
      updatedAt: now
    };

    batch.set(db.collection('line_users').doc(userId), userDoc, { merge: true });
    batch.set(db.collection('stores').doc(storeId), storeDoc, { merge: true });
  });

  await batch.commit();
  console.log(
    `Seeded ${addressSeeds.length} market users + stores into Firestore (${isProductionTarget ? 'production' : 'emulator'}).`
  );
};

main().catch((error) => {
  console.error('Failed to seed market users:', error);
  process.exitCode = 1;
});
