import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs,
  doc,
  getDoc,
  Timestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Product, Store, Conversation, MarketingMaterial, LineUser } from '@/lib/database';

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
  // Get user statistics
  static async getUserStats(userId: string): Promise<UserStats> {
    try {
      const [productsSnap, storesSnap, conversationsSnap, materialsSnap] = await Promise.all([
        getDocs(query(collection(db, 'products'), where('userId', '==', userId))),
        getDocs(query(collection(db, 'stores'), where('userId', '==', userId))),
        getDocs(query(collection(db, 'conversations'), where('userId', '==', userId))),
        getDocs(query(collection(db, 'marketing_materials'), where('userId', '==', userId)))
      ]);

      const products = productsSnap.docs.map(doc => doc.data() as Product);
      const activeProducts = products.filter(p => p.isActive).length;
      const lowStockProducts = products.filter(p => p.stock <= 10).length; // Assuming 10 is low stock threshold
      
      // Calculate total revenue (simplified)
      const totalRevenue = products.reduce((sum, p) => sum + (p.price * p.stock), 0);
      
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
        monthlyGrowth: 15 // This would be calculated from historical data
      };
    } catch (error) {
      console.error('Error fetching user stats:', error);
      throw error;
    }
  }

  // Get user products
  static async getUserProducts(userId: string, limitCount: number = 10): Promise<Product[]> {
    try {
      const q = query(
        collection(db, 'products'),
        where('userId', '==', userId),
        where('isActive', '==', true),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data() as Product);
    } catch (error) {
      console.error('Error fetching user products:', error);
      return [];
    }
  }

  // Get user stores
  static async getUserStores(userId: string, limitCount: number = 10): Promise<Store[]> {
    try {
      const q = query(
        collection(db, 'stores'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data() as Store);
    } catch (error) {
      console.error('Error fetching user stores:', error);
      return [];
    }
  }

  // Get recent conversations
  static async getRecentConversations(userId: string, limitCount: number = 10): Promise<Conversation[]> {
    try {
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
      await updateDoc(userRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  }
}

export default UserDataService;
