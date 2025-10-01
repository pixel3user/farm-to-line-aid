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
  const [user, setUser] = useState<LineUser | null>(() => {
    // Try to restore user from localStorage
    try {
      const savedUser = localStorage.getItem('farm2market_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [liffUser, setLiffUser] = useState<LiffUser | null>(() => {
    // Try to restore liffUser from localStorage
    try {
      const savedLiffUser = localStorage.getItem('farm2market_liff_user');
      return savedLiffUser ? JSON.parse(savedLiffUser) : null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isLiffReady, setIsLiffReady] = useState(false);
  const [isInLineApp, setIsInLineApp] = useState(false);
  const [userStats, setUserStats] = useState<any>(null);
  const [userProducts, setUserProducts] = useState<any[]>([]);
  const [userStores, setUserStores] = useState<any[]>([]);
  const [userMarketingMaterials, setUserMarketingMaterials] = useState<any[]>([]);

  // Persist user state to localStorage
  useEffect(() => {
    if (user) {
      localStorage.setItem('farm2market_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('farm2market_user');
    }
  }, [user]);

  // Persist liffUser state to localStorage
  useEffect(() => {
    if (liffUser) {
      localStorage.setItem('farm2market_liff_user', JSON.stringify(liffUser));
    } else {
      localStorage.removeItem('farm2market_liff_user');
    }
  }, [liffUser]);

  // Initialize LIFF
  useEffect(() => {
    const initializeLiff = async () => {
      try {
        console.log('Initializing LIFF...');
        console.log('Firebase auth available:', !!auth);
        console.log('Firebase db available:', !!db);
        
        // Check if we're in LINE app environment
        const userAgent = navigator.userAgent.toLowerCase();
        const isInLine = userAgent.includes('line');
        console.log('User agent:', userAgent, 'Is in LINE:', isInLine);
        setIsInLineApp(isInLine);

        // If we have a saved user, check if we should restore it
        if (user && liffUser) {
          console.log('Found saved user, checking if still valid...');
          // Check if we have LINE redirect parameters that might override saved user
          const urlParams = new URLSearchParams(window.location.search);
          const lineUserId = urlParams.get('userId');
          
          if (lineUserId && lineUserId !== liffUser.userId) {
            console.log('Different user in URL params, will authenticate new user');
          } else {
            console.log('Using saved user, loading data...');
            setIsLiffReady(true);
            setIsLoading(false);
            try {
              await loadUserData(liffUser.userId);
            } catch (error) {
              console.error('Failed to load saved user data:', error);
              setIsLoading(false);
            }
            return; // Skip normal initialization
          }
        }

        // Check for LINE Bot redirect parameters
        const urlParams = new URLSearchParams(window.location.search);
        const lineUserId = urlParams.get('userId');
        const lineDisplayName = urlParams.get('displayName');
        const linePictureUrl = urlParams.get('pictureUrl');
        console.log('URL params:', { lineUserId, lineDisplayName, linePictureUrl });

        if (isInLine) {
          console.log('In LINE app, initializing LIFF...');
          try {
            // Dynamic import of LIFF SDK
            const liff = (await import('@line/liff')).default;
            
            const liffId = import.meta.env.VITE_LIFF_ID;
            if (!liffId || liffId === 'your-liff-id') {
              console.warn('LIFF ID not configured, using fallback authentication');
              setIsLiffReady(true);
              // Fallback: treat as web user with LINE redirect params
              if (lineUserId && lineDisplayName) {
                const profile = {
                  userId: lineUserId,
                  displayName: decodeURIComponent(lineDisplayName),
                  pictureUrl: linePictureUrl ? decodeURIComponent(linePictureUrl) : undefined,
                  statusMessage: undefined
                };
                
                setLiffUser(profile);
                await authenticateWithFirebase('', profile);
                
                // Clean up URL parameters
                window.history.replaceState({}, document.title, window.location.pathname);
                return;
              } else {
                setIsLoading(false);
                return;
              }
            }
            
            await liff.init({ liffId });
            console.log('LIFF initialized with ID:', liffId);
            setIsLiffReady(true);

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
              } else {
                console.log('No ID token available, using profile fallback authentication');
                await authenticateWithFirebase('', profile);
              }
            } else {
              console.log('User is not logged in to LIFF');
              // User is not logged in, show login button
              setIsLoading(false);
            }
          } catch (liffError) {
            console.error('LIFF initialization failed:', liffError);
            // Fallback to web authentication
            setIsLiffReady(true);
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
          
          if (db && auth) {
            try {
              await authenticateWithFirebase('', profile);
              console.log('LINE Bot redirect authentication successful');
            } catch (error) {
              console.error('LINE Bot redirect authentication failed:', error);
              // Create mock user for demo purposes
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
                preferences: { language: 'zh-TW', notifications: true, marketingOptIn: false },
                metadata: { totalMessages: 0, lastInteraction: Timestamp.now(), favoriteFeatures: [] }
              };
              setUser(mockUser);
              console.log('Created mock user for demo');
              setIsLoading(false);
            }
          } else {
            console.log('Firebase not available, creating mock user');
            // Create mock user for demo purposes
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
              preferences: { language: 'zh-TW', notifications: true, marketingOptIn: false },
              metadata: { totalMessages: 0, lastInteraction: Timestamp.now(), favoriteFeatures: [] }
            };
            setUser(mockUser);
            console.log('Created mock user for demo');
            setIsLoading(false);
          }
          
          // Clean up URL parameters
          window.history.replaceState({}, document.title, window.location.pathname);
          setIsLiffReady(true);
          setIsLoading(false);
        } else {
          console.log('Not in LINE app, setting up for web access...');
          // Not in LINE app, check for existing Firebase auth
          
          // Check if we have LINE redirect parameters even outside LINE app
          if (lineUserId && lineDisplayName) {
            console.log('Found LINE redirect parameters in web environment');
            const profile = {
              userId: lineUserId,
              displayName: decodeURIComponent(lineDisplayName),
              pictureUrl: linePictureUrl ? decodeURIComponent(linePictureUrl) : undefined,
              statusMessage: undefined
            };
            
            setLiffUser(profile);
            
            if (db && auth) {
              try {
                await authenticateWithFirebase('', profile);
                console.log('Web environment LINE redirect authentication successful');
              } catch (error) {
                console.error('Web environment LINE redirect authentication failed:', error);
                // Create mock user for demo purposes
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
                  preferences: { language: 'zh-TW', notifications: true, marketingOptIn: false },
                  metadata: { totalMessages: 0, lastInteraction: Timestamp.now(), favoriteFeatures: [] }
                };
                setUser(mockUser);
                console.log('Created mock user for demo');
                setIsLoading(false);
              }
            } else {
              console.log('Firebase not available, creating mock user');
              // Create mock user for demo purposes
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
                preferences: { language: 'zh-TW', notifications: true, marketingOptIn: false },
                metadata: { totalMessages: 0, lastInteraction: Timestamp.now(), favoriteFeatures: [] }
              };
              setUser(mockUser);
              console.log('Created mock user for demo');
              setIsLoading(false);
            }
            
            // Clean up URL parameters
            window.history.replaceState({}, document.title, window.location.pathname);
            setIsLiffReady(true);
            setIsLoading(false);
          } else {
            console.log('No LINE redirect parameters found, setting up for regular web access');
            setIsLiffReady(true);
            setIsLoading(false);
          }
        }
      } catch (error) {
        console.error('LIFF initialization failed:', error);
        setIsLiffReady(true);
        setIsLoading(false);
      }
    };

    initializeLiff();
    
    // Fallback timeout to ensure loading state is always set
    const timeout = setTimeout(() => {
      console.log('Authentication timeout - setting loading to false');
      setIsLiffReady(true);
      setIsLoading(false);
    }, 5000); // 5 second timeout
    
    return () => clearTimeout(timeout);
  }, []);

  // Listen to Firebase auth state changes
  useEffect(() => {
    if (!auth) {
      console.log('Firebase auth not available, skipping auth state listener');
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('Firebase auth state changed:', firebaseUser);
      setFirebaseUser(firebaseUser);
      
      // Only handle Firebase auth changes if we don't already have a user from LIFF
      if (firebaseUser && liffUser && !user) {
        // Load user data from Firestore
        await loadUserData(liffUser.userId);
      } else if (!firebaseUser && !liffUser) {
        // Only clear user if we don't have LIFF user
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, [liffUser, user]);

  const authenticateWithFirebase = async (idToken: string, profile: any) => {
    try {
      console.log('Authenticating user:', profile.userId, profile.displayName);
      
      if (!db) {
        console.error('Firebase database not available');
        setIsLoading(false);
        return;
      }

      // In a real implementation, you would send the ID token to your backend
      // to verify it and get a custom Firebase token
      // For now, we'll create a user document directly
      
      const userRef = doc(db, 'line_users', profile.userId);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        console.log('Creating new user profile...');
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
        console.log('Creating sample data for new user...');
        try {
          await createSampleDataForUser(profile.userId);
        } catch (sampleError) {
          console.error('Failed to create sample data:', sampleError);
        }
        
        // Load user data (now includes sample data)
        try {
          await loadUserData(profile.userId);
        } catch (loadError) {
          console.error('Failed to load user data:', loadError);
        }
      } else {
        console.log('Updating existing user profile...');
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
        
        // Load existing user data
        try {
          await loadUserData(profile.userId);
        } catch (loadError) {
          console.error('Failed to load user data:', loadError);
        }
      }
      
      console.log('Firebase authentication completed successfully');
      setIsLoading(false);
    } catch (error) {
      console.error('Firebase authentication failed:', error);
      setIsLoading(false);
      // Don't re-throw error to prevent breaking the flow
      console.log('Continuing with authentication flow despite error');
    }
  };

  const loadUserData = async (userId: string) => {
    try {
      console.log('Loading user data for:', userId);
      
      if (!db) {
        console.error('Firebase database not available');
        setIsLoading(false);
        return;
      }

      // Load user profile
      const userRef = doc(db, 'line_users', userId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data() as LineUser;
        console.log('Loaded user profile:', userData.displayName);
        setUser(userData);
      } else {
        console.log('User profile not found, will be created during authentication');
      }
      
      // Load user statistics and data
      console.log('Loading user statistics and data...');
      const [stats, products, stores, marketingMaterials] = await Promise.all([
        UserDataService.getUserStats(userId),
        UserDataService.getUserProducts(userId, 10),
        UserDataService.getUserStores(userId, 10),
        UserDataService.getMarketingMaterials(userId, 10)
      ]);
      
      console.log('Loaded data:', {
        stats: stats,
        productsCount: products.length,
        storesCount: stores.length,
        materialsCount: marketingMaterials.length
      });
      
      // Set the loaded data (empty arrays if no data exists)
      setUserStats(stats);
      setUserProducts(products);
      setUserStores(stores);
      setUserMarketingMaterials(marketingMaterials);
      
      // Check if user has no data and create sample data
      const hasData = stats.totalProducts > 0 || stats.totalStores > 0;
      if (!hasData && user) {
        console.log('User has no data, creating sample data...');
        await createSampleDataForUser(userId);
        // Reload data after creating sample data
        const [newStats, newProducts, newStores, newMaterials] = await Promise.all([
          UserDataService.getUserStats(userId),
          UserDataService.getUserProducts(userId, 10),
          UserDataService.getUserStores(userId, 10),
          UserDataService.getMarketingMaterials(userId, 10)
        ]);
        
        setUserStats(newStats);
        setUserProducts(newProducts);
        setUserStores(newStores);
        setUserMarketingMaterials(newMaterials);
      }
      
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
        const liffId = import.meta.env.VITE_LIFF_ID;
        
        if (!liffId || liffId === 'your-liff-id') {
          console.warn('LIFF ID not configured, using demo mode');
          // Demo mode: create a fake user for testing
          const demoProfile = {
            userId: 'demo-user-' + Date.now(),
            displayName: 'Demo User',
            pictureUrl: undefined,
            statusMessage: 'Demo Account'
          };
          
          setLiffUser(demoProfile);
          try {
            await authenticateWithFirebase('', demoProfile);
          } catch (error) {
            console.error('Demo authentication failed:', error);
            // Create mock user for demo purposes
            const mockUser: LineUser = {
              id: demoProfile.userId,
              lineUserId: demoProfile.userId,
              displayName: demoProfile.displayName,
              pictureUrl: demoProfile.pictureUrl,
              statusMessage: demoProfile.statusMessage,
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now(),
              isActive: true,
              subscriptionTier: 'free',
              preferences: { language: 'zh-TW', notifications: true, marketingOptIn: false },
              metadata: { totalMessages: 0, lastInteraction: Timestamp.now(), favoriteFeatures: [] }
            };
            setUser(mockUser);
            console.log('Created demo mock user');
            setIsLoading(false);
          }
          return;
        }
        
        liff.login();
      } catch (error) {
        console.error('LIFF login failed:', error);
        alert('LINE login failed. Please try again.');
      }
    } else {
      console.log('Not in LINE app, using demo mode');
      // Demo mode: create a fake user for testing
      const demoProfile = {
        userId: 'demo-user-' + Date.now(),
        displayName: 'Demo User',
        pictureUrl: undefined,
        statusMessage: 'Demo Account'
      };
      
      setLiffUser(demoProfile);
      try {
        await authenticateWithFirebase('', demoProfile);
      } catch (error) {
        console.error('Demo authentication failed:', error);
        // Create mock user for demo purposes
        const mockUser: LineUser = {
          id: demoProfile.userId,
          lineUserId: demoProfile.userId,
          displayName: demoProfile.displayName,
          pictureUrl: demoProfile.pictureUrl,
          statusMessage: demoProfile.statusMessage,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          isActive: true,
          subscriptionTier: 'free',
          preferences: { language: 'zh-TW', notifications: true, marketingOptIn: false },
          metadata: { totalMessages: 0, lastInteraction: Timestamp.now(), favoriteFeatures: [] }
        };
        setUser(mockUser);
        console.log('Created demo mock user');
        setIsLoading(false);
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
      
      // Clear all state and localStorage
      setUser(null);
      setLiffUser(null);
      setUserStats(null);
      setUserProducts([]);
      setUserStores([]);
      setUserMarketingMaterials([]);
      localStorage.removeItem('farm2market_user');
      localStorage.removeItem('farm2market_liff_user');
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
