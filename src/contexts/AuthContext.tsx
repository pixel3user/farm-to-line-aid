import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signInWithCustomToken, signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { LineUser, DatabaseService } from '@/lib/database';
import { UserDataService } from '@/services/userDataService';
import { createSampleDataForUser } from '@/utils/sampleData';

// LINE LIFF types
interface LiffUser {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

interface AuthContextType {
  user: LineUser | null;
  firebaseUser: FirebaseUser | null;
  liffUser: LiffUser | null;
  isLoading: boolean;
  isLiffReady: boolean;
  isInLineApp: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUserData: () => Promise<void>;
  userStats: any;
  userProducts: any[];
  userStores: any[];
  userMarketingMaterials: any[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<LineUser | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [liffUser, setLiffUser] = useState<LiffUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLiffReady, setIsLiffReady] = useState(false);
  const [isInLineApp, setIsInLineApp] = useState(false);
  const [userStats, setUserStats] = useState<any>(null);
  const [userProducts, setUserProducts] = useState<any[]>([]);
  const [userStores, setUserStores] = useState<any[]>([]);
  const [userMarketingMaterials, setUserMarketingMaterials] = useState<any[]>([]);

  // Initialize LIFF
  useEffect(() => {
    const initializeLiff = async () => {
      try {
        console.log('Initializing LIFF...');
        
        // Check if we're in LINE app environment
        const userAgent = navigator.userAgent.toLowerCase();
        const isInLine = userAgent.includes('line');
        console.log('User agent:', userAgent, 'Is in LINE:', isInLine);
        setIsInLineApp(isInLine);

        // Check for LINE Bot redirect parameters
        const urlParams = new URLSearchParams(window.location.search);
        const lineUserId = urlParams.get('userId');
        const lineDisplayName = urlParams.get('displayName');
        const linePictureUrl = urlParams.get('pictureUrl');
        console.log('URL params:', { lineUserId, lineDisplayName, linePictureUrl });

        if (isInLine) {
          console.log('In LINE app, initializing LIFF...');
          // Dynamic import of LIFF SDK
          const liff = (await import('@line/liff')).default;
          
          await liff.init({
            liffId: import.meta.env.VITE_LIFF_ID || 'your-liff-id'
          });

          setIsLiffReady(true);
          console.log('LIFF initialized');

          if (liff.isLoggedIn()) {
            console.log('User is logged in to LIFF');
            const profile = await liff.getProfile();
            setLiffUser({
              userId: profile.userId,
              displayName: profile.displayName,
              pictureUrl: profile.pictureUrl,
              statusMessage: profile.statusMessage
            });
            
            // Get ID token for Firebase authentication
            const idToken = liff.getIDToken();
            if (idToken) {
              await authenticateWithFirebase(idToken, profile);
            }
          } else {
            console.log('User is not logged in to LIFF');
            // User is not logged in, show login button
            setIsLoading(false);
          }
        } else if (lineUserId && lineDisplayName) {
          console.log('Handling LINE Bot redirect...');
          // Handle LINE Bot redirect with user info
          const profile = {
            userId: lineUserId,
            displayName: decodeURIComponent(lineDisplayName),
            pictureUrl: linePictureUrl ? decodeURIComponent(linePictureUrl) : undefined,
            statusMessage: undefined
          };
          
          setLiffUser(profile);
          await authenticateWithFirebase('', profile);
          setIsLiffReady(true);
          
          // Clean up URL parameters
          window.history.replaceState({}, document.title, window.location.pathname);
        } else {
          console.log('Not in LINE app, setting up for web access...');
          // Not in LINE app, check for existing Firebase auth
          setIsLiffReady(true);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('LIFF initialization failed:', error);
        setIsLiffReady(true);
        setIsLoading(false);
      }
    };

    initializeLiff();
  }, []);

  // Listen to Firebase auth state changes
  useEffect(() => {
    if (!auth) {
      console.log('Firebase auth not available, skipping auth state listener');
      setIsLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('Firebase auth state changed:', firebaseUser);
      setFirebaseUser(firebaseUser);
      
      if (firebaseUser && liffUser) {
        // Load user data from Firestore
        await loadUserData(liffUser.userId);
      } else {
        setUser(null);
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [liffUser]);

  const authenticateWithFirebase = async (idToken: string, profile: any) => {
    try {
      if (!db) {
        console.log('Firebase database not available, creating mock user');
        // Create a mock user for development
        const mockUser: LineUser = {
          id: profile.userId,
          lineUserId: profile.userId,
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl,
          statusMessage: profile.statusMessage,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          isActive: true,
          subscriptionTier: 'free',
          preferences: {
            language: 'zh-TW',
            notifications: true,
            marketingOptIn: false
          },
          metadata: {
            totalMessages: 0,
            lastInteraction: Timestamp.now(),
            favoriteFeatures: []
          }
        };
        
        setUser(mockUser);
        setIsLoading(false);
        return;
      }

      // In a real implementation, you would send the ID token to your backend
      // to verify it and get a custom Firebase token
      // For now, we'll create a user document directly
      
      const userRef = doc(db, 'line_users', profile.userId);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        // Create new user
        const newUser: LineUser = {
          id: profile.userId,
          lineUserId: profile.userId,
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl,
          statusMessage: profile.statusMessage,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          isActive: true,
          subscriptionTier: 'free',
          preferences: {
            language: 'zh-TW',
            notifications: true,
            marketingOptIn: false
          },
          metadata: {
            totalMessages: 0,
            lastInteraction: Timestamp.now(),
            favoriteFeatures: []
          }
        };
        
        await setDoc(userRef, newUser);
        setUser(newUser);
        
        // Create sample data for new users
        await createSampleDataForUser(profile.userId);
      } else {
        // Update existing user
        const existingUser = userSnap.data() as LineUser;
        await updateDoc(userRef, {
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl,
          statusMessage: profile.statusMessage,
          updatedAt: Timestamp.now(),
          'metadata.lastInteraction': Timestamp.now()
        });
        
        setUser({
          ...existingUser,
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl,
          statusMessage: profile.statusMessage,
          updatedAt: Timestamp.now()
        });
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Firebase authentication failed:', error);
      setIsLoading(false);
    }
  };

  const loadUserData = async (userId: string) => {
    try {
      if (!db) {
        console.log('Firebase database not available, using mock data');
        // Set mock data for development
        setUserStats({
          totalProducts: 3,
          totalStores: 2,
          totalConversations: 5,
          totalMarketingMaterials: 2,
          lastActivity: Timestamp.now(),
          activeProducts: 3,
          lowStockProducts: 1,
          totalRevenue: 5000,
          monthlyGrowth: 15
        });
        setUserProducts([
          { id: '1', name: '農場新鮮 A 級雞蛋', price: 180, stock: 45, category: '雞蛋' },
          { id: '2', name: '有機放養雞蛋', price: 280, stock: 8, category: '雞蛋' },
          { id: '3', name: '優質鴨蛋', price: 320, stock: 22, category: '鴨蛋' }
        ]);
        setUserStores([
          { id: '1', name: '綠色有機超市', location: '新竹市中心', status: 'customer' },
          { id: '2', name: '新鮮便利超商', location: '竹北區', status: 'customer' }
        ]);
        setUserMarketingMaterials([
          { id: '1', title: '農場新鮮雞蛋傳單', type: 'flyer', usage: { timesUsed: 12 } },
          { id: '2', title: '有機雞蛋食譜卡', type: 'recipe_card', usage: { timesUsed: 8 } }
        ]);
        setIsLoading(false);
        return;
      }

      // Load user profile
      const userRef = doc(db, 'line_users', userId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        setUser(userSnap.data() as LineUser);
      }
      
      // Load user statistics and data
      const [stats, products, stores, marketingMaterials] = await Promise.all([
        UserDataService.getUserStats(userId),
        UserDataService.getUserProducts(userId, 10),
        UserDataService.getUserStores(userId, 10),
        UserDataService.getMarketingMaterials(userId, 10)
      ]);
      
      setUserStats(stats);
      setUserProducts(products);
      setUserStores(stores);
      setUserMarketingMaterials(marketingMaterials);
      
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to load user data:', error);
      setIsLoading(false);
    }
  };

  const login = async () => {
    if (isInLineApp && isLiffReady) {
      try {
        const liff = (await import('@line/liff')).default;
        liff.login();
      } catch (error) {
        console.error('LIFF login failed:', error);
      }
    }
  };

  const logout = async () => {
    try {
      if (isInLineApp && isLiffReady) {
        const liff = (await import('@line/liff')).default;
        liff.logout();
      }
      
      if (auth) {
        await signOut(auth);
      }
      setUser(null);
      setLiffUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const refreshUserData = async () => {
    if (liffUser) {
      await loadUserData(liffUser.userId);
    }
  };


  const value: AuthContextType = {
    user,
    firebaseUser,
    liffUser,
    isLoading,
    isLiffReady,
    isInLineApp,
    login,
    logout,
    refreshUserData,
    userStats,
    userProducts,
    userStores,
    userMarketingMaterials
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
