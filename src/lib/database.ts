// Firestore Database Models and Services
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  DocumentReference,
  WriteResult,
  FirestoreError,
  QueryConstraint
} from 'firebase/firestore';
import { db } from './firebase';

// Database Types
export interface LineUser {
  id: string;
  lineUserId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
  email?: string;
  role?: 'farmer' | 'market';
  roleSelectedAt?: Timestamp | string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isActive: boolean;
  subscriptionTier: 'free' | 'premium' | 'pro';
  preferences: {
    language: 'zh-TW' | 'zh-CN' | 'en' | 'ja';
    notifications: boolean;
    marketingOptIn: boolean;
  };
  metadata: {
    totalMessages: number;
    lastInteraction: Timestamp;
    favoriteFeatures: string[];
  };
}

export interface Product {
  id: string;
  userId: string;
  name: string;
  description: string;
  category: string;
  price: number;
  unit: string;
  stock: number;
  images: string[];
  tags: string[];
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  geminiData?: {
    aiGeneratedDescription: string;
    marketingCopy: string;
    nutritionalInfo?: string;
  };
}

export interface Store {
  id: string;
  userId: string;
  name: string;
  type: 'restaurant' | 'supermarket' | 'farmers_market' | 'online_store' | 'other';
  location: string;
  contact: {
    name?: string;
    phone?: string;
    email?: string;
    website?: string;
  };
  status: 'potential' | 'contacted' | 'customer' | 'former_customer';
  metadata: {
    firstContact: Timestamp;
    lastOrder?: Timestamp;
    totalOrders: number;
    totalRevenue: number;
    notes: string[];
  };
  geminiData?: {
    aiSuggestedOutreach: string;
    relationshipStage: string;
    nextAction: string;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Conversation {
  id: string;
  userId: string;
  type: 'text' | 'image' | 'postback' | 'follow' | 'unfollow';
  content: string;
  geminiResponse?: string;
  metadata: {
    imageAnalysis?: any;
    sentiment?: 'positive' | 'neutral' | 'negative';
    intent?: string;
    entities?: any[];
  };
  timestamp: Timestamp;
}

export interface MarketingMaterial {
  id: string;
  userId: string;
  productId?: string;
  type: 'flyer' | 'shelf_card' | 'recipe_card' | 'social_media';
  title: string;
  content: string;
  imageUrl?: string;
  generatedBy: 'gemini' | 'user';
  isActive: boolean;
  createdAt: Timestamp;
  usage: {
    timesUsed: number;
    lastUsed?: Timestamp;
  };
}

// Database Service Class
export class DatabaseService {
  // Line User operations
  static async createLineUser(lineUserData: Partial<LineUser>): Promise<{ id: string }> {
    const now = Timestamp.now();
    const userRef = doc(db, 'line_users', lineUserData.lineUserId!);
    
    const userDoc = {
      id: lineUserData.lineUserId!,
      lineUserId: lineUserData.lineUserId!,
      displayName: lineUserData.displayName || 'Unknown',
      pictureUrl: lineUserData.pictureUrl,
      statusMessage: lineUserData.statusMessage,
      createdAt: now,
      updatedAt: now,
      isActive: true,
      subscriptionTier: 'free',
      preferences: {
        language: 'zh-TW',
        notifications: true,
        marketingOptIn: false,
        ...lineUserData.preferences
      },
      metadata: {
        totalMessages: 0,
        lastInteraction: now,
        favoriteFeatures: [],
        ...lineUserData.metadata
      }
    };

    await setDoc(userRef, userDoc);
    return { id: lineUserData.lineUserId! };
  }

  static async getLineUser(lineUserId: string): Promise<LineUser | null> {
    const userRef = doc(db, 'line_users', lineUserId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      return userSnap.data() as LineUser;
    }
    return null;
  }

  static async updateLineUser(lineUserId: string, updates: Partial<LineUser>): Promise<void> {
    const userRef = doc(db, 'line_users', lineUserId);
    const updateData = {
      ...updates,
      updatedAt: Timestamp.now()
    };
    
    await updateDoc(userRef, updateData);
  }

  static async incrementUserMessageCount(lineUserId: string): Promise<void> {
    const userRef = doc(db, 'line_users', lineUserId);
    await updateDoc(userRef, {
      'metadata.totalMessages': db.increment(1),
      'metadata.lastInteraction': Timestamp.now()
    });
  }

  // Product operations
  static async createProduct(userId: string, productData: Partial<Product>): Promise<{ id: string }> {
    console.log('DatabaseService: Creating product for user:', userId, 'with data:', productData);
    
    const productRef = doc(collection(db, 'products'));
    const now = Timestamp.now();
    
    const productDoc: any = {
      id: productRef.id,
      userId,
      name: productData.name || '',
      description: productData.description || '',
      category: productData.category || 'general',
      price: productData.price || 0,
      unit: productData.unit || '件',
      stock: productData.stock || 0,
      images: productData.images || [],
      tags: productData.tags || [],
      isActive: true,
      createdAt: now,
      updatedAt: now
    };

    // Only include geminiData if it's not undefined
    if (productData.geminiData !== undefined) {
      productDoc.geminiData = productData.geminiData;
    }

    console.log('DatabaseService: Product document to save:', productDoc);
    
    await setDoc(productRef, productDoc);
    
    console.log('DatabaseService: Product saved successfully with ID:', productRef.id);
    
    // Immediately try to fetch the created product to verify
    try {
      const createdProduct = await getDoc(productRef);
      console.log('DatabaseService: Verification - created product exists:', createdProduct.exists());
      if (createdProduct.exists()) {
        console.log('DatabaseService: Verification - product data:', createdProduct.data());
      }
    } catch (verifyError) {
      console.error('DatabaseService: Verification failed:', verifyError);
    }
    
    return { id: productRef.id };
  }

  static async getProductsByUser(userId: string): Promise<Product[]> {
    try {
      console.log('DatabaseService: Fetching products for user:', userId);
      
      // Use the most reliable approach: get all products and filter manually
      const allProductsSnapshot = await getDocs(collection(db, 'products'));
      console.log('DatabaseService: Total products in database:', allProductsSnapshot.size);
      
      const userProducts = allProductsSnapshot.docs
        .filter(doc => {
          const data = doc.data();
          const matches = data.userId === userId;
          if (matches) {
            console.log('DatabaseService: Found matching product:', { id: doc.id, userId: data.userId, name: data.name });
          }
          return matches;
        })
        .map(doc => {
          const data = doc.data();
          console.log('DatabaseService: Processing product:', { id: doc.id, ...data });
          return {
            ...data as Product,
            id: doc.id
          };
        })
        .sort((a, b) => {
          // Sort by createdAt descending
          const aTime = a.createdAt?.toMillis?.() || 0;
          const bTime = b.createdAt?.toMillis?.() || 0;
          return bTime - aTime;
        });
      
      console.log('DatabaseService: Final products array for user:', userProducts.length, userProducts);
      return userProducts;
    } catch (error) {
      console.error('DatabaseService: Error fetching user products:', error);
      return [];
    }
  }

  static async updateProduct(productId: string, updates: Partial<Product>): Promise<void> {
    const productRef = doc(db, 'products', productId);
    const updateData = {
      ...updates,
      updatedAt: Timestamp.now()
    };
    
    await updateDoc(productRef, updateData);
  }

  static async deleteProduct(productId: string): Promise<void> {
    const productRef = doc(db, 'products', productId);
    await deleteDoc(productRef);
  }

  // Store operations
  static async createStore(userId: string, storeData: Partial<Store>): Promise<{ id: string }> {
    const storeRef = doc(collection(db, 'stores'));
    const now = Timestamp.now();

    const storeDoc: any = {
      id: storeRef.id,
      userId,
      name: storeData.name || '',
      type: storeData.type || 'other',
      location: storeData.location || '',
      status: 'potential',
      metadata: {
        firstContact: storeData.metadata?.firstContact || now,
        totalOrders: 0,
        totalRevenue: 0,
        notes: [],
        ...storeData.metadata
      },
      createdAt: now,
      updatedAt: now
    };

    // Only include contact if it's not undefined
    if (storeData.contact !== undefined) {
      storeDoc.contact = storeData.contact;
    }

    // Only include lastOrder if it's not undefined
    if (storeData.metadata?.lastOrder !== undefined) {
      storeDoc.metadata.lastOrder = storeData.metadata.lastOrder;
    }

    // Only include geminiData if it's not undefined
    if (storeData.geminiData !== undefined) {
      storeDoc.geminiData = storeData.geminiData;
    }

    await setDoc(storeRef, storeDoc);
    return { id: storeRef.id };
  }

  static async updateStore(storeId: string, updates: Partial<Store>): Promise<void> {
    const storeRef = doc(db, 'stores', storeId);
    const updateData = {
      ...updates,
      updatedAt: Timestamp.now()
    };

    await updateDoc(storeRef, updateData);
  }

  static async getStoresByUser(userId: string): Promise<Store[]> {
    const q = query(
      collection(db, 'stores'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      ...doc.data() as Store,
      id: doc.id
    }));
  }

  static async getAllStores(limitCount: number = 20): Promise<Store[]> {
    const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
    if (limitCount > 0) {
      constraints.push(limit(limitCount));
    }

    const q = query(collection(db, 'stores'), ...constraints);
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as Store);
  }

  static async getFarmers(limitCount: number = 20): Promise<LineUser[]> {
    const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
    if (limitCount > 0) {
      constraints.push(limit(limitCount));
    }

    const q = query(collection(db, 'line_users'), ...constraints);
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as LineUser);
  }

  static async getAllProducts(limitCount: number = 20): Promise<Product[]> {
    const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
    if (limitCount > 0) {
      constraints.push(limit(limitCount));
    }

    const q = query(collection(db, 'products'), ...constraints);
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      ...(doc.data() as Product),
      id: doc.id,
    }));
  }

  // Conversation operations
  static async createConversation(userId: string, conversationData: Partial<Conversation>): Promise<{ id: string }> {
    const conversationRef = doc(collection(db, 'conversations'));
    
    const conversationDoc: any = {
      id: conversationRef.id,
      userId,
      type: conversationData.type || 'text',
      content: conversationData.content || '',
      metadata: conversationData.metadata || {},
      timestamp: Timestamp.now()
    };

    // Only include geminiResponse if it's not undefined
    if (conversationData.geminiResponse !== undefined) {
      conversationDoc.geminiResponse = conversationData.geminiResponse;
    }

    await setDoc(conversationRef, conversationDoc);
    return { id: conversationRef.id };
  }

  static async getRecentConversations(userId: string, limitCount: number = 10): Promise<Conversation[]> {
    const q = query(
      collection(db, 'conversations'),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as Conversation);
  }

  // Marketing Material operations
  static async createMarketingMaterial(userId: string, materialData: Partial<MarketingMaterial>): Promise<{ id: string }> {
    const materialRef = doc(collection(db, 'marketing_materials'));
    
    const materialDoc: any = {
      id: materialRef.id,
      userId,
      type: materialData.type || 'flyer',
      title: materialData.title || '',
      content: materialData.content || '',
      generatedBy: materialData.generatedBy || 'gemini',
      isActive: true,
      createdAt: Timestamp.now(),
      usage: {
        timesUsed: 0
      }
    };

    // Only include optional fields if they're not undefined
    if (materialData.productId !== undefined) {
      materialDoc.productId = materialData.productId;
    }
    if (materialData.imageUrl !== undefined) {
      materialDoc.imageUrl = materialData.imageUrl;
    }
    if (materialData.usage?.lastUsed !== undefined) {
      materialDoc.usage.lastUsed = materialData.usage.lastUsed;
    }

    await setDoc(materialRef, materialDoc);
    return { id: materialRef.id };
  }

  static async getMarketingMaterialsByUser(userId: string): Promise<MarketingMaterial[]> {
    const q = query(
      collection(db, 'marketing_materials'),
      where('userId', '==', userId),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as MarketingMaterial);
  }

  // Analytics helpers
  static async getUserStats(userId: string): Promise<{
    totalProducts: number;
    totalStores: number;
    totalConversations: number;
    totalMarketingMaterials: number;
    lastActivity: Timestamp;
  }> {
    const [productsSnap, storesSnap, conversationsSnap, materialsSnap] = await Promise.all([
      getDocs(query(collection(db, 'products'), where('userId', '==', userId))),
      getDocs(query(collection(db, 'stores'), where('userId', '==', userId))),
      getDocs(query(collection(db, 'conversations'), where('userId', '==', userId))),
      getDocs(query(collection(db, 'marketing_materials'), where('userId', '==', userId)))
    ]);

    const lastActivity = await this.getUserLastActivity(userId);

    return {
      totalProducts: productsSnap.size,
      totalStores: storesSnap.size,
      totalConversations: conversationsSnap.size,
      totalMarketingMaterials: materialsSnap.size,
      lastActivity
    };
  }

  static async getUserLastActivity(userId: string): Promise<Timestamp> {
    const q = query(
      collection(db, 'conversations'),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(1)
    );
    
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return Timestamp.now();
    }
    
    return snapshot.docs[0].data().timestamp as Timestamp;
  }
}

export default DatabaseService;
