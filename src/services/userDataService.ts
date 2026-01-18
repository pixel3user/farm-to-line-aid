import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs,
  doc,
  getDoc,
  updateDoc,
  Timestamp,
  FirestoreError,
  QueryConstraint
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Product, Store, Conversation, MarketingMaterial, LineUser, Order } from '@/lib/database';

export interface UserStats {
  totalProducts: number;
  totalStores: number;
  totalConversations: number;
  totalMarketingMaterials: number;
  lastActivity: Timestamp;
  activeProducts: number;
  lowStockProducts: number;
  totalRevenue: number;
  monthlyGrowth: number;
}

export interface DashboardData {
  stats: UserStats;
  recentProducts: Product[];
  recentStores: Store[];
  recentActivity: Conversation[];
  marketingMaterials: MarketingMaterial[];
  lowStockAlerts: Product[];
}

export class UserDataService {
  // Debug function to check what's in the database
  static async debugDatabase(userId: string): Promise<void> {
    try {
      if (!db) {
        console.warn('Firestore unavailable for debug');
        return;
      }

      console.log('=== DATABASE DEBUG ===');
      console.log('User ID:', userId);
      
      // Check all collections
      const collections = ['line_users', 'products', 'stores', 'conversations', 'marketing_materials'];
      
      for (const collectionName of collections) {
        try {
          const snapshot = await getDocs(collection(db, collectionName));
          console.log(`${collectionName}: ${snapshot.size} documents`);
          
          if (collectionName === 'products' || collectionName === 'stores') {
            const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log(`${collectionName} data:`, docs);
            
            // Check for documents with this userId
            const userDocs = docs.filter(doc => doc.userId === userId);
            console.log(`${collectionName} for user ${userId}:`, userDocs.length, 'documents');
          }
        } catch (error) {
          console.error(`Error checking ${collectionName}:`, error);
        }
      }
      
      console.log('=== END DEBUG ===');
    } catch (error) {
      console.error('Debug function error:', error);
    }
  }

  // Get user statistics
  static async getUserStats(userId: string): Promise<UserStats> {
    try {
      if (!db) {
        console.warn('Firestore unavailable, returning mock stats');
        return {
          totalProducts: 0,
          totalStores: 0,
          totalConversations: 0,
          totalMarketingMaterials: 0,
          lastActivity: Timestamp.now(),
          activeProducts: 0,
          lowStockProducts: 0,
          totalRevenue: 0,
          monthlyGrowth: 0
        };
      }

      const [productsSnap, storesSnap, conversationsSnap, materialsSnap, ordersSnap] = await Promise.all([
        getDocs(query(collection(db, 'products'), where('userId', '==', userId))),
        getDocs(query(collection(db, 'stores'), where('userId', '==', userId))),
        getDocs(query(collection(db, 'conversations'), where('userId', '==', userId))),
        getDocs(query(collection(db, 'marketing_materials'), where('userId', '==', userId))),
        getDocs(query(collection(db, 'orders'), where('sellerIds', 'array-contains', userId)))
      ]);

      const products = productsSnap.docs.map(doc => doc.data() as Product);
      const activeProducts = products.filter(p => p.isActive).length;
      const lowStockProducts = products.filter(p => p.stock <= 10).length; // Assuming 10 is low stock threshold

      const revenueStatuses = new Set(['confirmed', 'paid']);
      const orders = ordersSnap.docs.map(doc => doc.data() as Order);
      const totalRevenue = orders.reduce((sum, order) => {
        if (!revenueStatuses.has(order.status)) return sum;
        const items = Array.isArray(order.items) ? order.items : [];
        const sellerItems = items.filter((item) => item.ownerId === userId);
        if (sellerItems.length > 0) {
          return sum + sellerItems.reduce((itemSum, item) => itemSum + item.price * item.quantity, 0);
        }
        if (order.sellerIds?.length === 1 && order.sellerIds[0] === userId) {
          return sum + (order.amount || 0);
        }
        return sum;
      }, 0);
      
      // Get last activity
      const lastConversation = conversationsSnap.docs[0];
      const lastActivity = lastConversation ? lastConversation.data().timestamp : Timestamp.now();

      return {
        totalProducts: productsSnap.size,
        totalStores: storesSnap.size,
        totalConversations: conversationsSnap.size,
        totalMarketingMaterials: materialsSnap.size,
        lastActivity,
        activeProducts,
        lowStockProducts,
        totalRevenue,
        monthlyGrowth: 0 // Start with 0 for new users
      };
    } catch (error) {
      console.error('Error fetching user stats:', error);
      throw error;
    }
  }

  // Get user products
  static async getUserProducts(userId: string, limitCount?: number): Promise<Product[]> {
    try {
      if (!db) {
        console.warn('Firestore unavailable, returning empty product list');
        return [];
      }

      console.log('UserDataService: Fetching products for user:', userId);

      const constraints: QueryConstraint[] = [
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
      ];

      if (limitCount && Number.isFinite(limitCount)) {
        constraints.push(limit(limitCount));
      }

      const q = query(collection(db, 'products'), ...constraints);
      const snapshot = await getDocs(q);

      const products = snapshot.docs.map((doc) => ({
        ...(doc.data() as Product),
        id: doc.id,
      }));

      console.log('UserDataService: Final products array for user:', products.length, products);
      return limitCount && Number.isFinite(limitCount) ? products.slice(0, limitCount) : products;
    } catch (error) {
      const firestoreError = error as FirestoreError;
      if (firestoreError?.code === 'failed-precondition') {
        console.warn('UserDataService: Query requires index, falling back to client-side filtering');
        try {
          if (!db) {
            return [];
          }
          const snapshot = await getDocs(collection(db, 'products'));
          const filtered = snapshot.docs
            .filter((doc) => doc.data()?.userId === userId)
            .map((doc) => ({
              ...(doc.data() as Product),
              id: doc.id,
            }))
            .sort((a, b) => {
              const aTime = a.createdAt?.toMillis?.() || 0;
              const bTime = b.createdAt?.toMillis?.() || 0;
              return bTime - aTime;
            });
          return limitCount && Number.isFinite(limitCount) ? filtered.slice(0, limitCount) : filtered;
        } catch (fallbackError) {
          console.error('UserDataService: Fallback product fetch failed:', fallbackError);
          return [];
        }
      }

      console.error('UserDataService: Error fetching user products:', error);
      return [];
    }
  }

  // Get user stores
  static async getUserStores(userId: string, limitCount?: number): Promise<Store[]> {
    try {
      if (!db) {
        console.warn('Firestore unavailable, returning empty store list');
        return [];
      }

      let baseQuery = query(
        collection(db, 'stores'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );

      if (limitCount && Number.isFinite(limitCount)) {
        baseQuery = query(baseQuery, limit(limitCount));
      }

      const querySnapshot = await getDocs(baseQuery);
      return querySnapshot.docs.map(doc => ({
        ...doc.data() as Store,
        id: doc.id
      }));
    } catch (error) {
      const firestoreError = error as FirestoreError;
      if (firestoreError?.code === 'failed-precondition') {
        console.warn('UserDataService: Query requires index, falling back to client-side filtering');
        try {
          if (!db) {
            return [];
          }
          const snapshot = await getDocs(collection(db, 'stores'));
          const filtered = snapshot.docs
            .filter((doc) => doc.data()?.userId === userId)
            .map((doc) => ({
              ...(doc.data() as Store),
              id: doc.id
            }))
            .sort((a, b) => {
              const aTime = a.createdAt?.toMillis?.() || 0;
              const bTime = b.createdAt?.toMillis?.() || 0;
              return bTime - aTime;
            });
          return limitCount && Number.isFinite(limitCount) ? filtered.slice(0, limitCount) : filtered;
        } catch (fallbackError) {
          console.error('UserDataService: Fallback store fetch failed:', fallbackError);
          return [];
        }
      }
      console.error('Error fetching user stores:', error);
      return [];
    }
  }

  static async getUserVerifiedStores(userId: string, limitCount?: number): Promise<Store[]> {
    const stores = await this.getUserStores(userId, limitCount);
    return stores.filter((store) => Boolean(store?.pickup?.yamatoZipCode && store?.pickup?.address));
  }

  static async getBuyerStores(limitCount?: number): Promise<Store[]> {
    try {
      if (!db) {
        console.warn('Firestore unavailable, returning empty buyer store list');
        return [];
      }

      const marketUsersSnap = await getDocs(
        query(collection(db, 'line_users'), where('role', '==', 'market'))
      );

      const buyerIds = new Set<string>();
      for (const docSnap of marketUsersSnap.docs) {
        const data = docSnap.data() as LineUser;
        if (data?.id) buyerIds.add(data.id);
        if (data?.lineUserId) buyerIds.add(data.lineUserId);
        buyerIds.add(docSnap.id);
      }

      if (buyerIds.size === 0) {
        return [];
      }

      const ids = Array.from(buyerIds);
      const chunkSize = 10;
      const storesById = new Map<string, Store>();

      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const q = query(collection(db, 'stores'), where('userId', 'in', chunk));
        const snapshot = await getDocs(q);
        snapshot.docs.forEach((doc) => {
          storesById.set(doc.id, {
            ...(doc.data() as Store),
            id: doc.id
          });
        });
      }

      let stores = Array.from(storesById.values());
      stores.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });

      if (limitCount && Number.isFinite(limitCount)) {
        stores = stores.slice(0, limitCount);
      }

      return stores;
    } catch (error) {
      console.error('Error fetching buyer stores:', error);
      return [];
    }
  }

  // Get all stores owned by market users (no sorting/limit filtering beyond the market-user lookup).
  static async getMarketStores(): Promise<Store[]> {
    try {
      if (!db) {
        console.warn('Firestore unavailable, returning empty market store list');
        return [];
      }

      const marketUsersSnap = await getDocs(
        query(collection(db, 'line_users'), where('role', '==', 'market'))
      );

      const buyerIds = new Set<string>();
      for (const docSnap of marketUsersSnap.docs) {
        const data = docSnap.data() as LineUser;
        if (data?.id) buyerIds.add(data.id);
        if (data?.lineUserId) buyerIds.add(data.lineUserId);
        buyerIds.add(docSnap.id);
      }

      if (buyerIds.size === 0) {
        return [];
      }

      const ids = Array.from(buyerIds);
      const chunkSize = 10;
      const stores: Store[] = [];
      const seen = new Set<string>();

      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const q = query(collection(db, 'stores'), where('userId', 'in', chunk));
        const snapshot = await getDocs(q);
        snapshot.docs.forEach((doc) => {
          if (seen.has(doc.id)) return;
          seen.add(doc.id);
          stores.push({
            ...(doc.data() as Store),
            id: doc.id
          });
        });
      }

      return stores;
    } catch (error) {
      console.error('Error fetching market store list:', error);
      return [];
    }
  }

  static async getStoresForFarmer(userId: string, limitCount?: number): Promise<Store[]> {
    try {
      let stores = await this.getBuyerStores();

      if (limitCount && Number.isFinite(limitCount)) {
        stores = stores.slice(0, limitCount);
      }

      return stores;
    } catch (error) {
      console.error('Error fetching farmer store list:', error);
      return [];
    }
  }

  // Get recent conversations
  static async getRecentConversations(userId: string, limitCount: number = 10): Promise<Conversation[]> {
    try {
      if (!db) {
        console.warn('Firestore unavailable, returning empty conversation list');
        return [];
      }

      const q = query(
        collection(db, 'conversations'),
        where('userId', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data() as Conversation);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      return [];
    }
  }

  // Get marketing materials
  static async getMarketingMaterials(userId: string, limitCount: number = 10): Promise<MarketingMaterial[]> {
    try {
      if (!db) {
        console.warn('Firestore unavailable, returning empty marketing materials list');
        return [];
      }

      const q = query(
        collection(db, 'marketing_materials'),
        where('userId', '==', userId),
        where('isActive', '==', true),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data() as MarketingMaterial);
    } catch (error) {
      console.error('Error fetching marketing materials:', error);
      return [];
    }
  }

  // Get low stock products
  static async getLowStockProducts(userId: string, threshold: number = 10): Promise<Product[]> {
    try {
      if (!db) {
        console.warn('Firestore unavailable, returning empty low stock list');
        return [];
      }

      const q = query(
        collection(db, 'products'),
        where('userId', '==', userId),
        where('isActive', '==', true),
        where('stock', '<=', threshold),
        orderBy('stock', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data() as Product);
    } catch (error) {
      console.error('Error fetching low stock products:', error);
      return [];
    }
  }

  // Get complete dashboard data
  static async getDashboardData(userId: string): Promise<DashboardData> {
    try {
      if (!db) {
        console.warn('Firestore unavailable, returning empty dashboard data');
        return {
          stats: {
            totalProducts: 0,
            totalStores: 0,
            totalConversations: 0,
            totalMarketingMaterials: 0,
            lastActivity: Timestamp.now(),
            activeProducts: 0,
            lowStockProducts: 0,
            totalRevenue: 0,
            monthlyGrowth: 0
          },
          recentProducts: [],
          recentStores: [],
          recentActivity: [],
          marketingMaterials: [],
          lowStockAlerts: []
        };
      }

      const [stats, recentProducts, recentStores, recentActivity, marketingMaterials, lowStockAlerts] = await Promise.all([
        this.getUserStats(userId),
        this.getUserProducts(userId, 5),
        this.getUserStores(userId, 5),
        this.getRecentConversations(userId, 10),
        this.getMarketingMaterials(userId, 5),
        this.getLowStockProducts(userId, 10)
      ]);

      return {
        stats,
        recentProducts,
        recentStores,
        recentActivity,
        marketingMaterials,
        lowStockAlerts
      };
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      throw error;
    }
  }

  // Get user profile
  static async getUserProfile(userId: string): Promise<LineUser | null> {
    try {
      if (!db) {
        console.warn('Firestore unavailable, cannot load user profile');
        return null;
      }

      const userRef = doc(db, 'line_users', userId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        return userSnap.data() as LineUser;
      }
      return null;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  }

  // Update user profile
  static async updateUserProfile(userId: string, updates: Partial<LineUser>): Promise<void> {
    try {
      const userRef = doc(db, 'line_users', userId);
      // sanitize undefined fields (Firestore rejects undefined)
      const sanitized: Record<string, any> = {};
      Object.entries(updates).forEach(([k, v]) => {
        if (v !== undefined) sanitized[k] = v;
      });
      sanitized.updatedAt = Timestamp.now();

      // Use setDoc with merge to upsert the document when it doesn't exist
      const { setDoc } = await import('firebase/firestore');
      await setDoc(userRef, sanitized, { merge: true });
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  }
}

export default UserDataService;
