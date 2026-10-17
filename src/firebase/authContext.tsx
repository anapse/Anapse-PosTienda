import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut as firebaseSignOut,
  signInAnonymously
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  setDoc, 
  onSnapshot 
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType, testConnection } from './config';
import { Business, BusinessMember, CashShift, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  currentBusiness: Business | null;
  businesses: Business[];
  currentRole: UserRole;
  activeShift: CashShift | null;
  signInWithGoogle: () => Promise<void>;
  signInQuickDemo: () => Promise<void>;
  signOutUser: () => Promise<void>;
  createBusiness: (name: string, nit: string, phone: string, address: string, city: string) => Promise<Business>;
  selectBusiness: (business: Business) => void;
  refreshBusiness: () => Promise<void>;
  setActiveShift: (shift: CashShift | null) => void;
  canAccess: (requiredRole: UserRole) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [currentBusiness, setCurrentBusiness] = useState<Business | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRole>('owner');
  const [activeShift, setActiveShift] = useState<CashShift | null>(null);

  useEffect(() => {
    // Run connection test as required by Firestore integration skill
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await loadUserBusinesses(currentUser.uid);
      } else {
        setBusinesses([]);
        setCurrentBusiness(null);
        setActiveShift(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Listen to active cash shifts when currentBusiness and user change
  useEffect(() => {
    if (!currentBusiness || !user) {
      setActiveShift(null);
      return;
    }

    const shiftsRef = collection(db, `businesses/${currentBusiness.id}/cashShifts`);
    const q = query(
      shiftsRef,
      where('status', '==', 'OPEN'),
      where('cashierId', '==', user.uid)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const shiftDoc = snapshot.docs[0];
          setActiveShift({ id: shiftDoc.id, ...shiftDoc.data() } as CashShift);
        } else {
          setActiveShift(null);
        }
      },
      (error) => {
        console.warn('Error fetching cash shifts: ', error);
      }
    );

    return () => unsub();
  }, [currentBusiness, user]);

  const loadUserBusinesses = async (userId: string) => {
    setLoading(true);
    try {
      const q = query(collection(db, 'businesses'), where('ownerId', '==', userId));
      const querySnapshot = await getDocs(q);
      const userBusinesses: Business[] = [];
      querySnapshot.forEach((d) => {
        userBusinesses.push({ id: d.id, ...d.data() } as Business);
      });

      setBusinesses(userBusinesses);

      // If user has existing businesses, select the first or retain current
      if (userBusinesses.length > 0) {
        const storedId = localStorage.getItem('active_business_id');
        const found = userBusinesses.find((b) => b.id === storedId) || userBusinesses[0];
        setCurrentBusiness(found);
        setCurrentRole('owner');
      } else {
        // Auto-provision a default Colombian store on first login to provide zero-friction experience
        const defaultStore = await createInitialStoreForUser(userId);
        setBusinesses([defaultStore]);
        setCurrentBusiness(defaultStore);
        setCurrentRole('owner');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'businesses');
    } finally {
      setLoading(false);
    }
  };

  const createInitialStoreForUser = async (userId: string): Promise<Business> => {
    const bizId = `biz_${Date.now()}`;
    const slug = `minimarket-${Math.random().toString(36).substring(2, 7)}`;
    const newStore: Business = {
      id: bizId,
      name: 'Minimarket Los Andes',
      ownerId: userId,
      nit: '900.852.147-3',
      phone: '3124567890',
      address: 'Calle 10 # 4-25, Centro',
      city: 'Bogotá',
      currency: 'COP',
      slug,
      whatsapp: '573124567890',
      catalogActive: true,
      receiptFooter: '¡Gracias por apoyar el comercio local de tu barrio!',
      createdAt: new Date().toISOString(),
    };

    const bizDocRef = doc(db, 'businesses', bizId);
    await setDoc(bizDocRef, newStore);

    // Create owner member record
    const memberDocRef = doc(db, `businesses/${bizId}/members`, userId);
    const memberData: BusinessMember = {
      id: userId,
      userId,
      email: auth.currentUser?.email || 'propietario@anapse.co',
      displayName: auth.currentUser?.displayName || 'Tendero Principal',
      role: 'owner',
      active: true,
      createdAt: new Date().toISOString(),
    };
    await setDoc(memberDocRef, memberData);

    localStorage.setItem('active_business_id', bizId);
    return newStore;
  };

  const createBusiness = async (
    name: string,
    nit: string,
    phone: string,
    address: string,
    city: string
  ): Promise<Business> => {
    if (!user) throw new Error('Debe iniciar sesión para crear un comercio.');

    const bizId = `biz_${Date.now()}`;
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 30);

    const newStore: Business = {
      id: bizId,
      name,
      ownerId: user.uid,
      nit: nit || '900.000.000-1',
      phone,
      address,
      city: city || 'Bogotá',
      currency: 'COP',
      slug: slug || `tienda-${bizId.substring(4, 9)}`,
      whatsapp: phone ? (phone.startsWith('57') ? phone : `57${phone}`) : '573000000000',
      catalogActive: true,
      receiptFooter: '¡Gracias por su compra!',
      createdAt: new Date().toISOString(),
    };

    try {
      const bizDocRef = doc(db, 'businesses', bizId);
      await setDoc(bizDocRef, newStore);

      const memberDocRef = doc(db, `businesses/${bizId}/members`, user.uid);
      await setDoc(memberDocRef, {
        id: user.uid,
        userId: user.uid,
        email: user.email || 'comercio@anapse.co',
        displayName: user.displayName || 'Propietario',
        role: 'owner',
        active: true,
        createdAt: new Date().toISOString(),
      });

      const updated = [...businesses, newStore];
      setBusinesses(updated);
      setCurrentBusiness(newStore);
      setCurrentRole('owner');
      localStorage.setItem('active_business_id', bizId);
      return newStore;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `businesses/${bizId}`);
    }
  };

  const selectBusiness = (business: Business) => {
    setCurrentBusiness(business);
    localStorage.setItem('active_business_id', business.id);
  };

  const refreshBusiness = async () => {
    if (!currentBusiness) return;
    try {
      const bizDoc = await getDoc(doc(db, 'businesses', currentBusiness.id));
      if (bizDoc.exists()) {
        const updated = { id: bizDoc.id, ...bizDoc.data() } as Business;
        setCurrentBusiness(updated);
        setBusinesses(prev => prev.map(b => (b.id === updated.id ? updated : b)));
      }
    } catch (err) {
      console.warn('Error refreshing business: ', err);
    }
  };

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error('Google Sign-In Error:', error);
      // If popup was blocked by iframe browser policy, offer anonymous demo sign in seamlessly
      if (error?.code === 'auth/popup-blocked' || error?.code === 'auth/cancelled-popup-request') {
        await signInAnonymously(auth);
      } else {
        throw error;
      }
    }
  };

  const signInQuickDemo = async () => {
    try {
      await signInAnonymously(auth);
    } catch (error) {
      console.error('Demo Sign-In Error:', error);
      throw error;
    }
  };

  const signOutUser = async () => {
    await firebaseSignOut(auth);
  };

  // Role hierarchy check
  const canAccess = (requiredRole: UserRole): boolean => {
    if (currentRole === 'owner') return true;
    if (currentRole === 'admin') {
      return requiredRole === 'admin' || requiredRole === 'cashier';
    }
    return requiredRole === 'cashier';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        currentBusiness,
        businesses,
        currentRole,
        activeShift,
        signInWithGoogle,
        signInQuickDemo,
        signOutUser,
        createBusiness,
        selectBusiness,
        refreshBusiness,
        setActiveShift,
        canAccess,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
