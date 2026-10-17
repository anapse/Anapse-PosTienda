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
  updateDoc,
  deleteDoc,
  onSnapshot 
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType, testConnection } from './config';
import { Business, BusinessMember, CashShift, UserRole, BusinessStatus } from '../types';
import { SUPER_ADMIN_EMAIL, PLAN_MONTHLY_PRICE_COP, PLAN_MAX_PRODUCTS, getDaysRemaining } from '../utils/subscription';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isSuperAdmin: boolean;
  currentBusiness: Business | null;
  businesses: Business[];
  allBusinesses: Business[]; // Only populated for super admin
  currentRole: UserRole;
  activeShift: CashShift | null;
  signInWithGoogle: () => Promise<void>;
  signInQuickDemo: () => Promise<void>;
  signOutUser: () => Promise<void>;
  createBusinessRequest: (params: {
    name: string;
    businessType: string;
    contactName: string;
    phone: string;
    nit: string;
    address: string;
    city: string;
  }) => Promise<Business>;
  selectBusiness: (business: Business) => void;
  refreshBusiness: () => Promise<void>;
  setActiveShift: (shift: CashShift | null) => void;
  canAccess: (requiredRole: UserRole) => boolean;
  // Super Admin actions
  approveBusiness: (businessId: string, days?: number) => Promise<void>;
  suspendBusiness: (businessId: string) => Promise<void>;
  reactivateBusiness: (businessId: string) => Promise<void>;
  extendSubscription: (businessId: string, additionalDays?: number) => Promise<void>;
  deleteBusiness: (businessId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [allBusinesses, setAllBusinesses] = useState<Business[]>([]);
  const [currentBusiness, setCurrentBusiness] = useState<Business | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRole>('owner');
  const [activeShift, setActiveShift] = useState<CashShift | null>(null);

  const isSuperAdmin = user?.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

  useEffect(() => {
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await loadUserBusinesses(currentUser);
      } else {
        setBusinesses([]);
        setAllBusinesses([]);
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

  const loadUserBusinesses = async (currentUser: User) => {
    setLoading(true);
    const isSuper = currentUser.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

    try {
      if (isSuper) {
        // Super Admin can listen to ALL businesses in real time
        const allRef = collection(db, 'businesses');
        onSnapshot(allRef, (snapshot) => {
          const allList: Business[] = [];
          snapshot.forEach(docSnap => {
            allList.push({ id: docSnap.id, ...docSnap.data() } as Business);
          });
          setAllBusinesses(allList);
        });
      }

      // Query user's businesses
      const q = query(collection(db, 'businesses'), where('ownerId', '==', currentUser.uid));
      const querySnapshot = await getDocs(q);
      const userBusinesses: Business[] = [];
      querySnapshot.forEach((d) => {
        userBusinesses.push({ id: d.id, ...d.data() } as Business);
      });

      setBusinesses(userBusinesses);

      if (userBusinesses.length > 0) {
        const storedId = localStorage.getItem('active_business_id');
        const found = userBusinesses.find((b) => b.id === storedId) || userBusinesses[0];
        setCurrentBusiness(found);
        setCurrentRole('owner');
      } else if (isSuper) {
        // Create initial active store for Super Admin
        const adminStore = await createSuperAdminStore(currentUser);
        setBusinesses([adminStore]);
        setCurrentBusiness(adminStore);
        setCurrentRole('owner');
      } else {
        // Regular user with no stores yet
        setCurrentBusiness(null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'businesses');
    } finally {
      setLoading(false);
    }
  };

  const createSuperAdminStore = async (currentUser: User): Promise<Business> => {
    const bizId = `biz_${Date.now()}`;
    const slug = `anapse-oficial`;
    const now = new Date();
    const expires = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year for super admin

    const adminStore: Business = {
      id: bizId,
      name: 'Tienda Modelo Anapse',
      ownerId: currentUser.uid,
      nit: '900.123.456-7',
      phone: '51912391502',
      address: 'Sede Principal Anapse',
      city: 'Bogotá',
      currency: 'COP',
      slug,
      whatsapp: '51912391502',
      catalogActive: true,
      receiptFooter: '¡Gracias por su compra en Anapse PosTienda!',
      status: 'ACTIVE',
      businessType: 'Tienda de barrio / Abarrotes',
      planName: 'Plan Super Administrador',
      planPrice: PLAN_MONTHLY_PRICE_COP,
      maxProducts: PLAN_MAX_PRODUCTS,
      activatedAt: now.toISOString(),
      subscriptionExpiresAt: expires.toISOString(),
      createdAt: now.toISOString(),
    };

    const bizDocRef = doc(db, 'businesses', bizId);
    await setDoc(bizDocRef, adminStore);

    const memberDocRef = doc(db, `businesses/${bizId}/members`, currentUser.uid);
    await setDoc(memberDocRef, {
      id: currentUser.uid,
      userId: currentUser.uid,
      email: currentUser.email || SUPER_ADMIN_EMAIL,
      displayName: currentUser.displayName || 'Super Administrador',
      role: 'owner',
      active: true,
      createdAt: now.toISOString(),
    });

    localStorage.setItem('active_business_id', bizId);
    return adminStore;
  };

  const createBusinessRequest = async (params: {
    name: string;
    businessType: string;
    contactName: string;
    phone: string;
    nit: string;
    address: string;
    city: string;
  }): Promise<Business> => {
    if (!user) throw new Error('Debe iniciar sesión para solicitar su tienda.');

    const bizId = `biz_${Date.now()}`;
    const slug = params.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 30);

    const now = new Date().toISOString();
    const isSuper = user.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

    // Regular accounts start in PENDING approval; Super Admin starts ACTIVE
    const initialStatus: BusinessStatus = isSuper ? 'ACTIVE' : 'PENDING';
    const expiresAt = isSuper 
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      : undefined;

    const newStore: Business = {
      id: bizId,
      name: params.name,
      ownerId: user.uid,
      nit: params.nit || 'Sin NIT',
      phone: params.phone,
      address: params.address,
      city: params.city || 'Colombia',
      currency: 'COP',
      slug: slug || `tienda-${bizId.substring(4, 9)}`,
      whatsapp: params.phone ? (params.phone.startsWith('57') || params.phone.startsWith('51') ? params.phone : `57${params.phone}`) : '573000000000',
      catalogActive: true,
      receiptFooter: '¡Gracias por su compra en Anapse PosTienda!',
      status: initialStatus,
      businessType: params.businessType,
      merchantContactName: params.contactName || user.displayName || 'Comerciante',
      planName: 'Plan Mensual Anapse ($40.000 COP)',
      planPrice: PLAN_MONTHLY_PRICE_COP,
      maxProducts: PLAN_MAX_PRODUCTS,
      requestedAt: now,
      activatedAt: isSuper ? now : undefined,
      subscriptionExpiresAt: expiresAt,
      createdAt: now,
    };

    try {
      const bizDocRef = doc(db, 'businesses', bizId);
      await setDoc(bizDocRef, newStore);

      const memberDocRef = doc(db, `businesses/${bizId}/members`, user.uid);
      await setDoc(memberDocRef, {
        id: user.uid,
        userId: user.uid,
        email: user.email || 'comercio@anapse.co',
        displayName: params.contactName || user.displayName || 'Propietario',
        role: 'owner',
        active: true,
        createdAt: now,
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

  // Super Admin: Approve store and activate 30 days of service
  const approveBusiness = async (businessId: string, days: number = 30) => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

    try {
      await updateDoc(doc(db, 'businesses', businessId), {
        status: 'ACTIVE',
        activatedAt: now.toISOString(),
        subscriptionExpiresAt: expiresAt,
        updatedAt: now.toISOString(),
      });
      if (currentBusiness?.id === businessId) {
        await refreshBusiness();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `businesses/${businessId}`);
    }
  };

  // Super Admin: Extend subscription by 30 days
  const extendSubscription = async (businessId: string, additionalDays: number = 30) => {
    try {
      const bizDoc = await getDoc(doc(db, 'businesses', businessId));
      if (!bizDoc.exists()) return;
      const bData = bizDoc.data() as Business;

      let baseTime = new Date().getTime();
      if (bData.subscriptionExpiresAt) {
        const expTime = new Date(bData.subscriptionExpiresAt).getTime();
        if (expTime > baseTime) {
          baseTime = expTime; // Add to existing days if not yet expired
        }
      }

      const newExpires = new Date(baseTime + additionalDays * 24 * 60 * 60 * 1000).toISOString();
      await updateDoc(doc(db, 'businesses', businessId), {
        status: 'ACTIVE',
        subscriptionExpiresAt: newExpires,
        updatedAt: new Date().toISOString(),
      });
      if (currentBusiness?.id === businessId) {
        await refreshBusiness();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `businesses/${businessId}`);
    }
  };

  // Super Admin: Suspend store
  const suspendBusiness = async (businessId: string) => {
    try {
      await updateDoc(doc(db, 'businesses', businessId), {
        status: 'SUSPENDED',
        updatedAt: new Date().toISOString(),
      });
      if (currentBusiness?.id === businessId) {
        await refreshBusiness();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `businesses/${businessId}`);
    }
  };

  // Super Admin: Reactivate store
  const reactivateBusiness = async (businessId: string) => {
    try {
      await updateDoc(doc(db, 'businesses', businessId), {
        status: 'ACTIVE',
        updatedAt: new Date().toISOString(),
      });
      if (currentBusiness?.id === businessId) {
        await refreshBusiness();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `businesses/${businessId}`);
    }
  };

  // Super Admin: Delete store request
  const deleteBusiness = async (businessId: string) => {
    try {
      await deleteDoc(doc(db, 'businesses', businessId));
      setBusinesses(prev => prev.filter(b => b.id !== businessId));
      if (currentBusiness?.id === businessId) {
        setCurrentBusiness(null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `businesses/${businessId}`);
    }
  };

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error('Google Sign-In Error:', error);
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

  const canAccess = (requiredRole: UserRole): boolean => {
    if (isSuperAdmin) return true;
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
        isSuperAdmin,
        currentBusiness,
        businesses,
        allBusinesses,
        currentRole,
        activeShift,
        signInWithGoogle,
        signInQuickDemo,
        signOutUser,
        createBusinessRequest,
        selectBusiness,
        refreshBusiness,
        setActiveShift,
        canAccess,
        approveBusiness,
        suspendBusiness,
        reactivateBusiness,
        extendSubscription,
        deleteBusiness,
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
