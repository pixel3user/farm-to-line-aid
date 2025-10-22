import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';
import admin from './firebaseAdmin';

const firestore = admin.firestore();

const nowTimestamp = () => admin.firestore.FieldValue.serverTimestamp();

type Timestamp = admin.firestore.Timestamp;

type FirestoreDocumentData = FirebaseFirestore.DocumentData;

export interface LineUserRecord {
  lineUserId: string;
  displayName?: string;
  pictureUrl?: string;
  statusMessage?: string;
  email?: string;
  role?: 'farmer' | 'market';
  createdAt?: Timestamp | FirebaseFirestore.FieldValue;
  updatedAt?: Timestamp | FirebaseFirestore.FieldValue;
}

export interface ProductRecord {
  id?: string;
  userId: string;
  name: string;
  description?: string;
  category?: string;
  price?: number;
  unit?: string;
  stock?: number;
  images?: string[];
  tags?: string[];
  isActive?: boolean;
  createdAt?: Timestamp | FirebaseFirestore.FieldValue;
  updatedAt?: Timestamp | FirebaseFirestore.FieldValue;
  geminiData?: Record<string, unknown>;
}

export interface StoreRecord {
  id?: string;
  userId: string;
  name: string;
  type?: string;
  location?: string;
  contact?: Record<string, unknown>;
  status?: string;
  metadata?: Record<string, unknown>;
  geminiData?: Record<string, unknown>;
  createdAt?: Timestamp | FirebaseFirestore.FieldValue;
  updatedAt?: Timestamp | FirebaseFirestore.FieldValue;
}

export interface MarketingMaterialRecord {
  id?: string;
  userId: string;
  productId?: string;
  type: string;
  title: string;
  content: string;
  imageUrl?: string;
  generatedBy?: string;
  isActive?: boolean;
  createdAt?: Timestamp | FirebaseFirestore.FieldValue;
  usage?: Record<string, unknown>;
}

export class DatabaseService {
  static async upsertLineUser(user: LineUserRecord): Promise<void> {
    if (!user.lineUserId) {
      throw new Error('lineUserId is required for upsertLineUser');
    }

    const userDoc = firestore.collection('line_users').doc(user.lineUserId);
    const payload: FirestoreDocumentData = {
      displayName: user.displayName ?? null,
      pictureUrl: user.pictureUrl ?? null,
      statusMessage: user.statusMessage ?? null,
      email: user.email ?? null,
      role: user.role ?? null,
      updatedAt: nowTimestamp(),
    };

    const snapshot = await userDoc.get();
    if (snapshot.exists) {
      await userDoc.set(payload, { merge: true });
    } else {
      await userDoc.set({
        lineUserId: user.lineUserId,
        createdAt: nowTimestamp(),
        isActive: true,
        preferences: {
          language: 'zh-TW',
          notifications: true,
          marketingOptIn: false,
        },
        metadata: {
          totalMessages: 0,
          lastInteraction: nowTimestamp(),
          favoriteFeatures: [],
        },
        ...payload,
      });
    }
  }

  static async getUserStats(userId: string): Promise<Record<string, number>> {
    const [products, stores, conversations] = await Promise.all([
      firestore.collection('products').where('userId', '==', userId).count().get(),
      firestore.collection('stores').where('userId', '==', userId).count().get(),
      firestore
        .collection('line_users')
        .doc(userId)
        .collection('conversation_history')
        .count()
        .get(),
    ]);

    return {
      products: products.data().count,
      stores: stores.data().count,
      conversations: conversations.data().count,
    };
  }

  static async getProductsByUser(userId: string): Promise<ProductRecord[]> {
    const snapshot = await firestore
      .collection('products')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map((doc: QueryDocumentSnapshot) => ({
      id: doc.id,
      ...(doc.data() as ProductRecord),
    }));
  }

  static async createProduct(userId: string, productData: Partial<ProductRecord>): Promise<{ id: string }> {
    if (!userId) {
      throw new Error('userId is required to create a product');
    }

    const docRef = firestore.collection('products').doc();
    await docRef.set({
      userId,
      name: productData.name ?? '未命名商品',
      description: productData.description ?? '',
      category: productData.category ?? 'general',
      price: productData.price ?? 0,
      unit: productData.unit ?? 'unit',
      stock: productData.stock ?? 0,
      images: productData.images ?? [],
      tags: productData.tags ?? [],
      isActive: productData.isActive ?? true,
      geminiData: productData.geminiData ?? {},
      createdAt: nowTimestamp(),
      updatedAt: nowTimestamp(),
    });

    return { id: docRef.id };
  }

  static async getStoresByUser(userId: string): Promise<StoreRecord[]> {
    const snapshot = await firestore
      .collection('stores')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map((doc: QueryDocumentSnapshot) => ({
      id: doc.id,
      ...(doc.data() as StoreRecord),
    }));
  }

  static async createStore(userId: string, storeData: Partial<StoreRecord>): Promise<{ id: string }> {
    if (!userId) {
      throw new Error('userId is required to create a store');
    }

    const docRef = firestore.collection('stores').doc();
    await docRef.set({
      userId,
      name: storeData.name ?? '未命名店家',
      type: storeData.type ?? 'other',
      location: storeData.location ?? '',
      contact: storeData.contact ?? {},
      status: storeData.status ?? 'potential',
      metadata: storeData.metadata ?? {
        firstContact: nowTimestamp(),
        totalOrders: 0,
        totalRevenue: 0,
        notes: [],
      },
      geminiData: storeData.geminiData ?? {},
      createdAt: nowTimestamp(),
      updatedAt: nowTimestamp(),
    });

    return { id: docRef.id };
  }

  static async getRecentConversations(userId: string, limit: number = 10): Promise<any[]> {
    const snapshot = await firestore
      .collection('line_users')
      .doc(userId)
      .collection('conversation_history')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map((doc: QueryDocumentSnapshot) => ({ id: doc.id, ...doc.data() }));
  }

  static async getMarketingMaterialsByUser(userId: string): Promise<MarketingMaterialRecord[]> {
    const snapshot = await firestore
      .collection('marketing_materials')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map((doc: QueryDocumentSnapshot) => ({
      id: doc.id,
      ...(doc.data() as MarketingMaterialRecord),
    }));
  }

  static async healthCheck(): Promise<void> {
    await firestore.doc('_system/health-check').set({ checkedAt: nowTimestamp() }, { merge: true });
  }
}

export default DatabaseService;
