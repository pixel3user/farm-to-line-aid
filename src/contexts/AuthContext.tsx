import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signInWithCustomToken, signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { LineUser, DatabaseService } from '@/lib/database';
import { UserDataService } from '@/services/userDataService';

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
  isRefreshingData: boolean;
  isLiffReady: boolean;
  isInLineApp: boolean;
  login: (profileOverride?: LiffUser, idToken?: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName?: string, role?: 'farmer' | 'market') => Promise<void>;
  logout: () => Promise<void>;
  refreshUserData: () => Promise<void>;
  setLiffProfile: (profile: LiffUser) => void;
  updateUserProfile: (updates: Partial<LineUser>) => Promise<void>;
  updateUserPreferences: (preferences: Partial<LineUser['preferences']>) => Promise<void>;
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
  const [isRefreshingData, setIsRefreshingData] = useState(false);
  const [isLiffReady, setIsLiffReady] = useState(false);
  const [isInLineApp, setIsInLineApp] = useState(false);
  const [userStats, setUserStats] = useState<any>(null);
  const [userProducts, setUserProducts] = useState<any[]>([]);
  const [userStores, setUserStores] = useState<any[]>([]);
  const [userMarketingMaterials, setUserMarketingMaterials] = useState<any[]>([]);
  const loginInProgressRef = useRef(false);
  const dataLoadingRef = useRef(false);
  const lastLoadTimeRef = useRef(0);
  const liffUserRef = useRef<LiffUser | null>(liffUser);
  const userRef = useRef<LineUser | null>(user);

  useEffect(() => {
    liffUserRef.current = liffUser;
  }, [liffUser]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

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
      const currentLiffUser = liffUserRef.current;
      const currentUser = userRef.current;
      
      // Only handle Firebase auth changes if we don't already have a user from LIFF
      if (firebaseUser && currentLiffUser && !currentUser) {
        // Load user data from Firestore
        await loadUserData(currentLiffUser.userId);
      } else if (!firebaseUser && !currentLiffUser) {
        // Only clear user if we don't have LIFF user
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, []); // Removed dependencies to prevent infinite loops

  const authenticateWithFirebase = async (idToken: string, profile: any) => {
    try {
      console.log('Authenticating user:', profile.userId, profile.displayName);
      
      if (!db) {
        console.error('Firebase database not available, falling back to mock user');

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
        setLiffUser(prev => prev ?? profile);
        setIsLoading(false);
        return;
      }

      // Exchange LIFF ID token for Firebase custom token
      let firebaseUser = null;
      if (idToken) {
        try {
          console.log('Exchanging LIFF ID token for Firebase custom token...');
          const response = await fetch('/api/auth/line', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ idToken }),
          });

          if (response.ok) {
            const authResult = await response.json();
            console.log('Custom token received, signing in to Firebase...');
            
            // Sign in to Firebase with custom token
            const { signInWithCustomToken } = await import('firebase/auth');
            const userCredential = await signInWithCustomToken(auth, authResult.customToken);
            firebaseUser = userCredential.user;
            console.log('Firebase authentication successful:', firebaseUser.uid);
          } else {
            console.error('Failed to exchange LIFF token:', response.status);
            throw new Error('Token exchange failed');
          }
        } catch (authError) {
          console.error('Firebase authentication failed:', authError);
          throw authError;
        }
      }
      
      const userRef = doc(db, 'line_users', profile.userId);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        console.log('Creating new user profile...');
        // Create new user
        const newUser: LineUser = {
          id: profile.userId,
          lineUserId: profile.userId,
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl || null,
          statusMessage: profile.statusMessage || null,
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
        // Only add email if present
        if (profile.email) {
          (newUser as any).email = profile.email;
        }
        
        await setDoc(userRef, newUser);
        setUser(newUser);
        
        // Load user data
        try {
          await loadUserData(profile.userId);
        } catch (loadError) {
          console.error('Failed to load user data:', loadError);
        }
      } else {
        console.log('Updating existing user profile...');
        // Update existing user
        const existingUser = userSnap.data() as LineUser;
        const updates: any = {
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl,
          statusMessage: profile.statusMessage,
          updatedAt: Timestamp.now(),
          'metadata.lastInteraction': Timestamp.now()
        };
        if (profile.email) {
          updates.email = profile.email;
        }
        await updateDoc(userRef, updates);
        
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
      
      // Fallback: Create a LineUser from profile to allow app to proceed in demo mode
      console.log('Creating fallback user for demo mode...');
      const fallbackUser: LineUser = {
        id: profile.userId,
        lineUserId: profile.userId,
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl || null,
        statusMessage: profile.statusMessage || null,
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
      
      setUser(fallbackUser);
      setIsLoading(false);
      console.log('Fallback user created, app can proceed in demo mode');
    }
  };

  const loginWithEmail = async (email: string, password: string) => {
    if (!auth || !db) throw new Error('Firebase not initialized');
    try {
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;

      // Ensure unified profile exists keyed by LINE userId if present, else Firebase UID
      // We will use a mapping: line_users doc id == uid for email-only accounts
      const userRef = doc(db, 'line_users', uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        const now = Timestamp.now();
        const newUser: LineUser = {
          id: uid,
          lineUserId: uid,
          displayName: cred.user.displayName || email.split('@')[0],
          pictureUrl: cred.user.photoURL || null,
          statusMessage: null,
          email,
          createdAt: now,
          updatedAt: now,
          isActive: true,
          subscriptionTier: 'free',
          preferences: { language: 'zh-TW', notifications: true, marketingOptIn: false },
          metadata: { totalMessages: 0, lastInteraction: now, favoriteFeatures: [] }
        };
        await setDoc(userRef, newUser);
        setUser(newUser);
      } else {
        setUser(snap.data() as LineUser);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    displayName?: string,
    role?: 'farmer' | 'market'
  ) => {
    if (!auth || !db) throw new Error('Firebase not initialized');
    const { createUserWithEmailAndPassword, updateProfile } = await import('firebase/auth');
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      await updateProfile(cred.user, { displayName });
    }
    // Create unified profile
    const uid = cred.user.uid;
    const now = Timestamp.now();
    const userRef = doc(db, 'line_users', uid);
    const newUser: LineUser = {
      id: uid,
      lineUserId: uid,
      displayName: displayName || email.split('@')[0],
      pictureUrl: cred.user.photoURL || null,
      statusMessage: null,
      email,
      createdAt: now,
      updatedAt: now,
      isActive: true,
      subscriptionTier: 'free',
      preferences: { language: 'zh-TW', notifications: true, marketingOptIn: false },
      metadata: { totalMessages: 0, lastInteraction: now, favoriteFeatures: [] }
    };
    if (role) {
      newUser.role = role;
      newUser.roleSelectedAt = now;
    }
    await setDoc(userRef, newUser);
    setUser(newUser);
  };

  const loadUserData = async (userId: string) => {
    const now = Date.now();
    const timeSinceLastLoad = now - lastLoadTimeRef.current;
    
    if (dataLoadingRef.current) {
      console.log('Data loading already in progress, skipping...');
      return;
    }
    
    if (timeSinceLastLoad < 1000) { // Prevent loading more than once per second
      console.log('Data loaded recently, skipping to prevent rapid calls...');
      return;
    }
    
    try {
      dataLoadingRef.current = true;
      lastLoadTimeRef.current = now;
      setIsRefreshingData(true);
      console.log('Loading user data for:', userId);
      console.log('Database connection status:', db ? 'Connected' : 'Not connected');
      
      if (!db) {
        console.warn('Firebase database not available during load, using demo data');

        const defaultStats = {
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

        setUserStats(defaultStats);
        setUserProducts([]);
        setUserStores([]);
        setUserMarketingMaterials([]);
        setIsLoading(false);
        setIsRefreshingData(false);
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
      
      // Debug database first
      await UserDataService.debugDatabase(userId);
      
      // Load user statistics and data
      console.log('Loading user statistics and data...');
      const [stats, products, stores, marketingMaterials] = await Promise.all([
        UserDataService.getUserStats(userId),
        UserDataService.getUserProducts(userId), // Increased limit to get more products
        UserDataService.getUserStores(userId), // Increased limit to get more stores
        UserDataService.getMarketingMaterials(userId, 10)
      ]);
      
      console.log('Loaded data:', {
        stats: stats,
        productsCount: products.length,
        storesCount: stores.length,
        materialsCount: marketingMaterials.length,
        products: products,
        stores: stores
      });
      
      // Set the loaded data (empty arrays if no data exists)
      console.log('AuthContext: Setting state with loaded data');
      console.log('AuthContext: Setting userStats:', stats);
      console.log('AuthContext: Setting userProducts:', products);
      console.log('AuthContext: Setting userStores:', stores);
      console.log('AuthContext: Setting userMarketingMaterials:', marketingMaterials);
      
      setUserStats(stats);
      setUserProducts(products);
      setUserStores(stores);
      setUserMarketingMaterials(marketingMaterials);
      
      console.log('AuthContext: State set successfully');
      
      // Check if user has no data - don't create demo data for real users
      const hasData = stats.totalProducts > 0 || stats.totalStores > 0;
      if (!hasData) {
        console.log('No data found for user, leaving datasets empty.');
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to load user data:', error);
      setIsLoading(false);
    } finally {
      dataLoadingRef.current = false;
      setIsRefreshingData(false);
    }
  };

  const login = async (profileOverride?: LiffUser, lineIdToken?: string) => {
    // Prevent re-entrancy/infinite loops
    if (loginInProgressRef.current || isLoading) {
      console.log('Login already in progress, skipping...');
      return;
    }

    // If we already have a user session, do not re-login
    if (user) {
      console.log('User already authenticated, skipping login');
      return;
    }

    loginInProgressRef.current = true;
    setIsLoading(true);

    try {
      if (isInLineApp && isLiffReady) {
      try {
        const liff = (await import('@line/liff')).default;
        const liffId = import.meta.env.VITE_LIFF_ID;
        
        if (!liffId || liffId === 'your-liff-id') {
          console.error('LIFF ID not configured. Please configure VITE_LIFF_ID in your environment variables.');
          throw new Error('LINE Login not configured. Please contact administrator.');
        }
        
        liff.login();
      } catch (error) {
        console.error('LIFF login failed:', error);
        alert('LINE login failed. Please try again.');
      }
    } else {
      const profileToUse = profileOverride ?? liffUser;
      if (profileToUse) {
        console.log('Not in LINE app, using LINE profile from callback');
        try {
          await authenticateWithFirebase('', profileToUse);
          return;
        } catch (error) {
          console.error('Authentication with existing LINE profile failed:', error);
          throw new Error('Authentication failed. Please try again.');
        }
      }

      console.log('No LINE profile available. Please use LINE Login.');
      throw new Error('Please use LINE Login to access your account.');
    }
    } finally {
      loginInProgressRef.current = false;
      setIsLoading(false);
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

  const refreshUserData = React.useCallback(async () => {
    const targetUserId = liffUser?.userId || user?.id;
    if (targetUserId && !dataLoadingRef.current) {
      console.log('Refreshing user data for:', targetUserId);
      try {
        await loadUserData(targetUserId);
      } catch (error) {
        console.error('Error refreshing user data:', error);
      }
    } else if (dataLoadingRef.current) {
      console.log('Data loading already in progress, skipping refresh...');
    } else {
      console.warn('No user ID available for refresh');
    }
  }, [liffUser?.userId, user?.id]);

  const updateUserProfile = async (updates: Partial<LineUser>) => {
    if (!user || !db) throw new Error('User not authenticated or database not available');

    try {
      const userRef = doc(db, 'line_users', user.id);
      const updateData = {
        ...updates,
        updatedAt: Timestamp.now()
      };
      
      await updateDoc(userRef, updateData);
      
      // Update local user state
      setUser(prev => prev ? { ...prev, ...updateData } : null);
    } catch (error) {
      console.error('Failed to update user profile:', error);
      throw error;
    }
  };

  const updateUserPreferences = async (preferences: Partial<LineUser['preferences']>) => {
    if (!user || !db) throw new Error('User not authenticated or database not available');

    try {
      const userRef = doc(db, 'line_users', user.id);
      const updateData = {
        preferences: {
          ...user.preferences,
          ...preferences
        },
        updatedAt: Timestamp.now()
      };
      
      await updateDoc(userRef, updateData);
      
      // Update local user state
      setUser(prev => prev ? { 
        ...prev, 
        preferences: { ...prev.preferences, ...preferences },
        updatedAt: Timestamp.now()
      } : null);
    } catch (error) {
      console.error('Failed to update user preferences:', error);
      throw error;
    }
  };


  const value: AuthContextType = {
    user,
    firebaseUser,
    liffUser,
    isLoading,
    isRefreshingData,
    isLiffReady,
    isInLineApp,
    login,
    loginWithEmail,
    signUpWithEmail,
    logout,
    refreshUserData,
    setLiffProfile: (profile: LiffUser) => setLiffUser(profile),
    updateUserProfile,
    updateUserPreferences,
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

