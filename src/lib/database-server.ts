// Firestore Database Models and Services for Server
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
  FirestoreError
} from 'firebase/firestore';
import { db } from './firebase-server';

// Database Types
export interface LineUser {
  id: string;
  lineUserId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
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

// Database Service Class for Server
export class DatabaseService {
  // Line User operations
  static async createLineUser(lineUserData: Partial<LineUser>): Promise<WriteResult> {
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

    return await setDoc(userRef, userDoc);
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
  static async createProduct(userId: string, productData: Partial<Product>): Promise<WriteResult> {
    const productRef = doc(collection(db, 'products'));
    const now = Timestamp.now();
    
    const productDoc = {
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
      updatedAt: now,
      geminiData: productData.geminiData
    };

    return await setDoc(productRef, productDoc);
  }

  static async getProductsByUser(userId: string): Promise<Product[]> {
    const q = query(
      collection(db, 'products'),
      where('userId', '==', userId),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as Product);
  }

  static async updateProduct(productId: string, updates: Partial<Product>): Promise<void> {
    const productRef = doc(db, 'products', productId);
    const updateData = {
      ...updates,
      updatedAt: Timestamp.now()
    };
    
    await updateDoc(productRef, updateData);
  }

  // Store operations
  static async createStore(userId: string, storeData: Partial<Store>): Promise<WriteResult> {
    const storeRef = doc(collection(db, 'stores'));
    const now = Timestamp.now();
    
    const storeDoc = {
      id: storeRef.id,
      userId,
      name: storeData.name || '',
      type: storeData.type || 'other',
      location: storeData.location || '',
      contact: storeData.contact || {},
      status: 'potential',
      metadata: {
        firstContact: storeData.metadata?.firstContact || now,
        lastOrder: storeData.metadata?.lastOrder,
        totalOrders: 0,
        totalRevenue: 0,
        notes: [],
        ...storeData.metadata
      },
      geminiData: storeData.geminiData,
      createdAt: now,
      updatedAt: now
    };

    return await setDoc(storeRef, storeDoc);
  }

  static async getStoresByUser(userId: string): Promise<Store[]> {
    const q = query(
      collection(db, 'stores'),
      where('userId', '==', userId),
      orderBy('status'),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as Store);
  }

  // Conversation operations
  static async createConversation(userId: string, conversationData: Partial<Conversation>): Promise<WriteResult> {
    const conversationRef = doc(collection(db, 'conversations'));
    
    const conversationDoc = {
      id: conversationRef.id,
      userId,
      type: conversationData.type || 'text',
      content: conversationData.content || '',
      geminiResponse: conversationData.geminiResponse,
      metadata: conversationData.metadata || {},
      timestamp: Timestamp.now()
    };

    return await setDoc(conversationRef, conversationDoc);
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
  static async createMarketingMaterial(userId: string, materialData: Partial<MarketingMaterial>): Promise<WriteResult> {
    const materialRef = doc(collection(db, 'marketing_materials'));
    
    const materialDoc = {
      id: materialRef.id,
      userId,
      productId: materialData.productId,
      type: materialData.type || 'flyer',
      title: materialData.title || '',
      content: materialData.content || '',
      imageUrl: materialData.imageUrl,
      generatedBy: materialData.generatedBy || 'gemini',
      isActive: true,
      createdAt: Timestamp.now(),
      usage: {
        timesUsed: 0,
        lastUsed: undefined
      }
    };

    return await setDoc(materialRef, materialDoc);
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
