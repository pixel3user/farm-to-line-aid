import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';
import type { LinePayConfirmResponse, LinePayReserveResponse } from './linePay';
import admin from './firebaseAdmin';

const firestore = admin.firestore();

const nowTimestamp = () => admin.firestore.FieldValue.serverTimestamp();

type Timestamp = admin.firestore.Timestamp;

type FirestoreDocumentData = FirebaseFirestore.DocumentData;

export interface LineUserRecord {
  lineUserId: string;
  lineId?: string;
  displayName?: string;
  pictureUrl?: string;
  statusMessage?: string;
  email?: string;
  role?: 'farmer' | 'market';
  createdAt?: Timestamp | FirebaseFirestore.FieldValue;
  updatedAt?: Timestamp | FirebaseFirestore.FieldValue;
  isAdmin?: boolean;
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

export interface OrderItemRecord {
  productId?: string;
  ownerId?: string;
  name: string;
  price: number;
  quantity: number;
  unit?: string;
  imageUrl?: string;
}

export interface OrderRecord {
  orderId: string;
  status: 'pending' | 'reserved' | 'authorized' | 'confirmed' | 'paid' | 'cancelled' | 'failed';
  paymentMethod?: 'line_pay' | 'cod' | 'other';
  amount: number;
  currency: string;
  items: OrderItemRecord[];
  sellerIds?: string[];
  buyer?: {
    userId?: string;
    displayName?: string;
    email?: string;
  };
  shipping?: {
    fullName?: string;
    phone?: string;
    email?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    postalCode?: string;
    instructions?: string;
  };
  redirectUrls?: {
    successUrl?: string;
    cancelUrl?: string;
  };
  metadata?: Record<string, unknown>;
  deliveryStatus?: 'awaiting_pickup' | 'enroute' | 'delivered' | 'cancelled';
  linePay?: {
    transactionId?: string;
    paymentUrl?: {
      web?: string;
      app?: string;
    };
    reservedAt?: Timestamp | FirebaseFirestore.FieldValue;
    confirmedAt?: Timestamp | FirebaseFirestore.FieldValue;
    rawReserveResponse?: LinePayReserveResponse | Record<string, unknown>;
    rawConfirmResponse?: LinePayConfirmResponse | Record<string, unknown>;
  };
  createdAt?: Timestamp | FirebaseFirestore.FieldValue;
  updatedAt?: Timestamp | FirebaseFirestore.FieldValue;
}

export interface SavedAddressRecord {
  id?: string;
  label: string;
  fullName: string;
  phone: string;
  email?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postalCode: string;
  instructions?: string;
  createdAt?: Timestamp | FirebaseFirestore.FieldValue;
  updatedAt?: Timestamp | FirebaseFirestore.FieldValue;
}

export class DatabaseService {
  static async getLineUser(userId: string): Promise<LineUserRecord | null> {
    const doc = await firestore.collection('line_users').doc(userId).get();
    if (!doc.exists) {
      return null;
    }
    const data = doc.data() as LineUserRecord;
    const { lineUserId: _ignored, ...rest } = data || {} as any;
    return { ...(rest as Omit<LineUserRecord, 'lineUserId'>), lineUserId: userId };
  }

  static async updateLineUserRole(userId: string, role: 'farmer' | 'market'): Promise<void> {
    if (!userId) throw new Error('userId is required');
    if (role !== 'farmer' && role !== 'market') throw new Error('Invalid role');
    await firestore.collection('line_users').doc(userId).set(
      { role, updatedAt: nowTimestamp() },
      { merge: true }
    );
  }

  static async getAllProducts(limit: number = 10): Promise<Array<Pick<ProductRecord, 'id' | 'name' | 'price' | 'unit' | 'stock' | 'images'>>> {
    const snapshot = await firestore
      .collection('products')
      .orderBy('createdAt', 'desc')
      .limit(Math.min(Math.max(limit, 1), 20))
      .get();
    return snapshot.docs.map((doc: QueryDocumentSnapshot) => {
      const data = doc.data() as ProductRecord;
      return {
        id: doc.id,
        name: data.name,
        price: data.price,
        unit: data.unit,
        stock: data.stock,
        images: data.images ?? [],
      };
    });
  }

  static async getAllStores(limit: number = 10): Promise<Array<Pick<StoreRecord, 'id' | 'name' | 'type' | 'location'>>> {
    const snapshot = await firestore
      .collection('stores')
      .orderBy('createdAt', 'desc')
      .limit(Math.min(Math.max(limit, 1), 20))
      .get();
    return snapshot.docs.map((doc: QueryDocumentSnapshot) => {
      const data = doc.data() as StoreRecord;
      return {
        id: doc.id,
        name: data.name,
        type: data.type ?? 'other',
        location: data.location ?? '',
      };
    });
  }

  static async getMarketplaceStats(): Promise<{ sellers: number; buyers: number; products: number; stores: number; }>
  {
    const [sellers, buyers, products, stores] = await Promise.all([
      firestore.collection('line_users').where('role', '==', 'farmer').count().get(),
      firestore.collection('line_users').where('role', '==', 'market').count().get(),
      firestore.collection('products').count().get(),
      firestore.collection('stores').count().get(),
    ]);

    return {
      sellers: sellers.data().count,
      buyers: buyers.data().count,
      products: products.data().count,
      stores: stores.data().count,
    };
  }

  static async searchProductsPublic(filters: { nameContains?: string; categoryEquals?: string; tagsAny?: string[]; minPrice?: number; maxPrice?: number; limit?: number } = {}): Promise<Array<Pick<ProductRecord, 'id' | 'name' | 'price' | 'unit' | 'stock' | 'images'>>> {
    let baseQuery: FirebaseFirestore.Query = firestore.collection('products');
    if (filters.categoryEquals) baseQuery = baseQuery.where('category', '==', filters.categoryEquals);
    if (Array.isArray(filters.tagsAny) && filters.tagsAny.length) baseQuery = baseQuery.where('tags', 'array-contains-any', filters.tagsAny.slice(0, 10));
    const hasPriceFilter = typeof filters.minPrice === 'number' || typeof filters.maxPrice === 'number';
    if (typeof filters.minPrice === 'number') baseQuery = baseQuery.where('price', '>=', filters.minPrice);
    if (typeof filters.maxPrice === 'number') baseQuery = baseQuery.where('price', '<=', filters.maxPrice);
    // Avoid composite index requirement: when filtering by price, order by price instead of createdAt
    baseQuery = hasPriceFilter ? baseQuery.orderBy('price', 'asc') : baseQuery.orderBy('createdAt', 'desc');

    const requestedLimit = Math.min(Math.max(filters.limit ?? 10, 1), 20);
    const hasName = typeof filters.nameContains === 'string' && !!filters.nameContains.trim();

    // If no name filter, just fetch a single page sized to the requested limit
    if (!hasName) {
      const snapshot = await baseQuery.limit(requestedLimit).get();
      const rows = snapshot.docs.map((doc: QueryDocumentSnapshot) => ({ id: doc.id, ...(doc.data() as ProductRecord) }));
      return rows.map(r => ({ id: r.id, name: r.name, price: r.price, unit: r.unit, stock: r.stock, images: r.images ?? [] }));
    }

    // With a name filter, paginate through the entire queryable dataset, filter client-side by name, then return up to requestedLimit
    const nameKw = filters.nameContains!.trim().toLowerCase();
    const pageSize = 200; // per-page fetch size for efficiency
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | undefined;
    const matched: Array<Pick<ProductRecord, 'id' | 'name' | 'price' | 'unit' | 'stock' | 'images'>> = [];

    // Safety cap to prevent runaway scans in extremely large datasets
    const SCAN_CAP = 50000; // total docs to scan at most in one request
    let scanned = 0;

    while (true) {
      let q = baseQuery.limit(pageSize);
      if (lastDoc) q = q.startAfter(lastDoc);
      const snapshot = await q.get();
      if (snapshot.empty) break;

      for (const doc of snapshot.docs) {
        scanned++;
        const data = doc.data() as ProductRecord;
        if ((data.name || '').toLowerCase().includes(nameKw)) {
          matched.push({ id: doc.id, name: data.name, price: data.price, unit: data.unit, stock: data.stock, images: data.images ?? [] });
        }
      }

      lastDoc = snapshot.docs[snapshot.docs.length - 1];
      if (scanned >= SCAN_CAP) break;
    }

    return matched.slice(0, requestedLimit);
  }

  static async searchStoresPublic(filters: { nameContains?: string; typeEquals?: string; locationContains?: string; limit?: number } = {}): Promise<Array<Pick<StoreRecord, 'id' | 'name' | 'type' | 'location'>>> {
    let q: FirebaseFirestore.Query = firestore.collection('stores');
    if (filters.typeEquals) q = q.where('type', '==', filters.typeEquals);
    q = q.orderBy('createdAt', 'desc');
    const snapshot = await q.limit(Math.min(Math.max(filters.limit ?? 10, 1), 20)).get();
    let rows = snapshot.docs.map((doc: QueryDocumentSnapshot) => ({ id: doc.id, ...(doc.data() as StoreRecord) }));
    if (filters.nameContains && filters.nameContains.trim()) {
      const kw = filters.nameContains.trim().toLowerCase();
      rows = rows.filter(r => (r.name || '').toLowerCase().includes(kw));
    }
    if (filters.locationContains && filters.locationContains.trim()) {
      const kw = filters.locationContains.trim().toLowerCase();
      rows = rows.filter(r => (r.location || '').toLowerCase().includes(kw));
    }
    return rows.map(r => ({ id: r.id, name: r.name, type: r.type ?? 'other', location: r.location ?? '' }));
  }

  static async upsertLineUser(user: LineUserRecord): Promise<void> {
    if (!user.lineUserId) {
      throw new Error('lineUserId is required for upsertLineUser');
    }

    const userDoc = firestore.collection('line_users').doc(user.lineUserId);
    const payload: FirestoreDocumentData = {
      displayName: user.displayName ?? null,
      lineId: user.lineId ?? user.lineUserId ?? null,
      pictureUrl: user.pictureUrl ?? null,
      statusMessage: user.statusMessage ?? null,
      email: user.email ?? null,
      role: user.role ?? null,
      updatedAt: nowTimestamp(),
      ...(user.isAdmin !== undefined ? { isAdmin: user.isAdmin } : {}),
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
        isAdmin: user.isAdmin ?? false,
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
    try {
      const snapshot = await firestore
        .collection('products')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();

      return snapshot.docs.map((doc: QueryDocumentSnapshot) => ({
        id: doc.id,
        ...(doc.data() as ProductRecord),
      }));
    } catch (err: any) {
      // If index is missing, fall back to no orderBy to avoid hard failure
      const message = String(err?.message || '');
      if (message.includes('The query requires an index')) {
        const snapshot = await firestore
          .collection('products')
          .where('userId', '==', userId)
          .get();
        return snapshot.docs
          .map((doc: QueryDocumentSnapshot) => ({ id: doc.id, ...(doc.data() as ProductRecord) }))
          .sort((a: any, b: any) => ((b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)));
      }
      throw err;
    }
  }

  static async createProduct(userId: string, productData: Partial<ProductRecord>): Promise<{ id: string }> {
    if (!userId) {
      throw new Error('userId is required to create a product');
    }

    // Enforce required fields at server-side too
    const name = String(productData.name || '').trim();
    const price = typeof productData.price === 'number' ? productData.price : NaN;
    const unit = String(productData.unit || '').trim();
    const stock = typeof productData.stock === 'number' ? productData.stock : NaN;

    if (!name || !(price > 0) || !unit || !(stock >= 0)) {
      throw new Error('Invalid product payload. Required: name (non-empty), price (>0), unit (non-empty), stock (>=0).');
    }

    const docRef = firestore.collection('products').doc();
    await docRef.set({
      userId,
      name,
      description: productData.description ?? '',
      category: productData.category ?? 'general',
      price,
      unit,
      stock,
      images: productData.images ?? [],
      tags: productData.tags ?? [],
      isActive: productData.isActive ?? true,
      geminiData: productData.geminiData ?? {},
      createdAt: nowTimestamp(),
      updatedAt: nowTimestamp(),
    });

    return { id: docRef.id };
  }

  static async updateProductImages(userId: string, productId: string, images: string[]): Promise<void> {
    if (!userId || !productId) {
      throw new Error('userId and productId are required to update product images');
    }
    const ref = firestore.collection('products').doc(productId);
    const snap = await ref.get();
    if (!snap.exists) return;
    const data = snap.data() as ProductRecord;
    if (data.userId !== userId) {
      throw new Error('Permission denied to update this product');
    }
    await ref.update({ images, updatedAt: nowTimestamp() });
  }

  static async getLatestProductByUser(userId: string): Promise<ProductRecord | null> {
    const snapshot = await firestore
      .collection('products')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...(doc.data() as ProductRecord) };
  }

  static async getProductById(productId: string): Promise<ProductRecord | null> {
    if (!productId) return null;
    const doc = await firestore.collection('products').doc(productId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...(doc.data() as ProductRecord) };
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

    const name = String(storeData.name || '').trim();
    if (!name) {
      throw new Error('Invalid store payload. Required: name (non-empty).');
    }

    const docRef = firestore.collection('stores').doc();
    await docRef.set({
      userId,
      name,
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

  static async createOrder(order: OrderRecord): Promise<{ id: string }> {
    if (!order?.orderId) {
      throw new Error('orderId is required to create an order');
    }
    if (!Array.isArray(order.items) || order.items.length === 0) {
      throw new Error('Order must include at least one item');
    }

    const orderRef = firestore.collection('orders').doc(order.orderId);
    await orderRef.set({
      ...order,
      status: order.status ?? 'pending',
      createdAt: order.createdAt ?? nowTimestamp(),
      updatedAt: order.updatedAt ?? nowTimestamp(),
    });
    return { id: orderRef.id };
  }

  static async updateOrder(orderId: string, updates: Partial<OrderRecord>): Promise<void> {
    if (!orderId) throw new Error('orderId is required to update an order');
    const orderRef = firestore.collection('orders').doc(orderId);
    await orderRef.set(
      {
        ...updates,
        updatedAt: nowTimestamp(),
      },
      { merge: true }
    );
  }

  static async getOrderByOrderId(orderId: string): Promise<OrderRecord | null> {
    if (!orderId) return null;
    const snapshot = await firestore.collection('orders').doc(orderId).get();
    if (!snapshot.exists) {
      return null;
    }
    return snapshot.data() as OrderRecord;
  }

  // Saved addresses
  static async getSavedAddresses(userId: string): Promise<SavedAddressRecord[]> {
    if (!userId) return [];
    const snapshot = await firestore
      .collection('line_users')
      .doc(userId)
      .collection('addresses')
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map((doc: QueryDocumentSnapshot) => ({ id: doc.id, ...(doc.data() as SavedAddressRecord) }));
  }

  static async upsertSavedAddress(userId: string, address: SavedAddressRecord): Promise<{ id: string }> {
    if (!userId) throw new Error('userId is required');
    const collectionRef = firestore.collection('line_users').doc(userId).collection('addresses');
    const docRef = address.id ? collectionRef.doc(address.id) : collectionRef.doc();
    await docRef.set(
      {
        label: address.label || 'Saved address',
        fullName: address.fullName,
        phone: address.phone,
        email: address.email || null,
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2 || '',
        city: address.city,
        postalCode: address.postalCode,
        instructions: address.instructions || '',
        createdAt: address.createdAt || nowTimestamp(),
        updatedAt: nowTimestamp(),
      },
      { merge: true }
    );
    return { id: docRef.id };
  }

  static async deleteSavedAddress(userId: string, addressId: string): Promise<void> {
    if (!userId || !addressId) return;
    await firestore.collection('line_users').doc(userId).collection('addresses').doc(addressId).delete();
  }

  static async confirmOrder(orderId: string): Promise<void> {
    if (!orderId) throw new Error('orderId is required');
    await firestore.collection('orders').doc(orderId).set(
      {
        status: 'confirmed',
        deliveryStatus: 'awaiting_pickup',
        updatedAt: nowTimestamp(),
      },
      { merge: true }
    );
  }
}

export default DatabaseService;
