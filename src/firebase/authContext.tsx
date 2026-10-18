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
  onSnapshot,
  limit
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType, testConnection } from './config';
import { Business, BusinessMember, CashShift, UserRole, BusinessStatus } from '../types';
import { 
  SUPER_ADMIN_EMAIL, 
  PLAN_MONTHLY_PRICE_COP, 
  PLAN_MAX_PRODUCTS, 
  COMMERCIAL_PLANS, 
  CommercialPlan, 
  getPlanById,
  getDaysRemaining 
} from '../utils/subscription';
import { seedBusinessSampleData } from '../utils/sampleData';

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
    planId?: string;
  }) => Promise<Business>;
  selectBusiness: (business: Business) => void;
  refreshBusiness: () => Promise<void>;
  setActiveShift: (shift: CashShift | null) => void;
  canAccess: (requiredRole: UserRole) => boolean;
  // Super Admin & Account actions
  approveBusiness: (businessId: string, days?: number, planId?: string) => Promise<void>;
  changeBusinessPlan: (businessId: string, planId: string) => Promise<void>;
  suspendBusiness: (businessId: string, reason?: string) => Promise<void>;
  reactivateBusiness: (businessId: string) => Promise<void>;
  extendSubscription: (businessId: string, additionalDays?: number) => Promise<void>;
  setCustomSubscriptionExpiration: (businessId: string, expiresAtIso: string) => Promise<void>;
  updateBusinessByAdmin: (businessId: string, data: Partial<Business>) => Promise<void>;
  createBusinessByAdmin: (data: Partial<Business>) => Promise<Business>;
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
    const isDemo = currentUser.isAnonymous;

    if (isDemo) {
      const now = new Date();
      const demoStore: Business = {
        id: 'demo_store_123',
        name: 'Supermercado de Prueba Anapse',
        ownerId: currentUser.uid,
        nit: '900.999.888-1',
        phone: '51912391502',
        address: 'Calle Principal #45-20, Bogotá',
        city: 'Bogotá',
        currency: 'COP',
        slug: 'supermercado-demo',
        whatsapp: '51912391502',
        catalogActive: true,
        receiptFooter: '¡Gracias por su compra en Modo Prueba!',
        status: 'ACTIVE',
        businessType: 'Minimarket / Supermercado',
        merchantContactName: 'Comerciante de Prueba',
        planId: 'tienda',
        planName: 'Plan Tienda',
        planPrice: 40000,
        maxProducts: 500,
        createdAt: new Date(now.getTime() - 10 * 86400000).toISOString(),
        activatedAt: new Date(now.getTime() - 10 * 86400000).toISOString(),
        subscriptionExpiresAt: new Date(now.getTime() + 20 * 86400000).toISOString(),
      };

      const sampleStores: Business[] = [
        demoStore,
        {
          id: 'biz_demo_2',
          name: 'Minimarket El Ahorro Familiar',
          ownerId: 'user_medellin_1',
          nit: '901.442.119-4',
          phone: '3104567890',
          whatsapp: '573104567890',
          address: 'Cra 70 #32-15, Laureles',
          city: 'Medellín',
          currency: 'COP',
          slug: 'el-ahorro-familiar',
          catalogActive: true,
          receiptFooter: '¡Gracias por apoyar el comercio local!',
          status: 'ACTIVE',
          businessType: 'Minimarket / Supermercado',
          merchantContactName: 'Carlos Mario Restrepo',
          planId: 'almacen',
          planName: 'Plan Almacén',
          planPrice: 60000,
          maxProducts: 2000,
          createdAt: new Date(now.getTime() - 15 * 86400000).toISOString(),
          activatedAt: new Date(now.getTime() - 15 * 86400000).toISOString(),
          subscriptionExpiresAt: new Date(now.getTime() + 15 * 86400000).toISOString(),
        },
        {
          id: 'biz_demo_3',
          name: 'Fruver San Antonio Campestre',
          ownerId: 'user_cali_2',
          nit: '900.887.321-0',
          phone: '3157891234',
          whatsapp: '573157891234',
          address: 'Calle 5 #23-40, San Antonio',
          city: 'Cali',
          currency: 'COP',
          slug: 'fruver-san-antonio',
          catalogActive: false,
          receiptFooter: 'Frutas y verduras frescas del campo.',
          status: 'PENDING',
          businessType: 'Fruver (Frutas y Verduras)',
          merchantContactName: 'Luz Marina Gómez',
          planId: 'tienda',
          planName: 'Plan Tienda',
          planPrice: 40000,
          maxProducts: 500,
          requestedAt: new Date(now.getTime() - 1 * 86400000).toISOString(),
          createdAt: new Date(now.getTime() - 1 * 86400000).toISOString(),
        },
        {
          id: 'biz_demo_4',
          name: 'Droguería y Farmacia La Rebaja 24H',
          ownerId: 'user_bquilla_3',
          nit: '901.332.109-8',
          phone: '3009876543',
          whatsapp: '573009876543',
          address: 'Calle 72 #46-18, El Prado',
          city: 'Barranquilla',
          currency: 'COP',
          slug: 'farmacia-la-rebaja-24h',
          catalogActive: true,
          receiptFooter: 'Salud y bienestar a tu alcance.',
          status: 'SUSPENDED',
          suspensionReason: 'Mensualidad vencida hace 5 días. Pendiente comprobante Nequi.',
          adminNotes: 'Contacto el 15-Oct: Prometió transferir antes del viernes.',
          businessType: 'Droguería / Farmacia',
          merchantContactName: 'Javier Enrique Blanco',
          planId: 'comercial',
          planName: 'Plan Comercial',
          planPrice: 90000,
          maxProducts: 999999,
          createdAt: new Date(now.getTime() - 45 * 86400000).toISOString(),
          activatedAt: new Date(now.getTime() - 45 * 86400000).toISOString(),
          subscriptionExpiresAt: new Date(now.getTime() - 5 * 86400000).toISOString(),
        },
        {
          id: 'biz_demo_5',
          name: 'Panadería y Pastelería Dulce Trigo',
          ownerId: 'user_bucaramanga_4',
          nit: '900.654.321-2',
          phone: '3187654321',
          whatsapp: '573187654321',
          address: 'Carrera 27 #34-12, Cabecera',
          city: 'Bucaramanga',
          currency: 'COP',
          slug: 'dulce-trigo-bga',
          catalogActive: true,
          receiptFooter: 'El mejor pan recién horneado.',
          status: 'ACTIVE',
          businessType: 'Panadería / Pastelería',
          merchantContactName: 'Marta Cecilia Ortiz',
          planId: 'tienda',
          planName: 'Plan Tienda',
          planPrice: 40000,
          maxProducts: 500,
          createdAt: new Date(now.getTime() - 27 * 86400000).toISOString(),
          activatedAt: new Date(now.getTime() - 27 * 86400000).toISOString(),
          subscriptionExpiresAt: new Date(now.getTime() + 3 * 86400000).toISOString(), // Vence en 3 días
        }
      ];

      setBusinesses([demoStore]);
      setAllBusinesses(sampleStores);
      setCurrentBusiness(demoStore);
      setCurrentRole('owner');
      setLoading(false);

      // Persist demo_store_123 in Firestore and seed sample products if not already seeded
      (async () => {
        try {
          const demoRef = doc(db, 'businesses', 'demo_store_123');
          await setDoc(demoRef, demoStore, { merge: true });

          const prodsSnap = await getDocs(query(collection(db, 'businesses/demo_store_123/products'), limit(1)));
          if (prodsSnap.empty) {
            await seedBusinessSampleData('demo_store_123');
          }
        } catch (err) {
          console.warn('Demo store auto-seed background notice:', err);
        }
      })();

      return;
    }

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

    try {
      await seedBusinessSampleData(bizId);
    } catch (err) {
      console.warn('Could not auto-seed sample products:', err);
    }

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
    planId?: string;
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

    const chosenPlan = getPlanById(params.planId || 'tienda');

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
      planId: chosenPlan.id,
      planName: chosenPlan.name,
      planPrice: chosenPlan.priceCOP,
      maxProducts: chosenPlan.maxProducts,
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
  const approveBusiness = async (businessId: string, days: number = 30, planId?: string) => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

    const updatePayload: any = {
      status: 'ACTIVE',
      activatedAt: now.toISOString(),
      subscriptionExpiresAt: expiresAt,
      updatedAt: now.toISOString(),
      suspensionReason: '',
    };

    if (planId) {
      const plan = getPlanById(planId);
      updatePayload.planId = plan.id;
      updatePayload.planName = plan.name;
      updatePayload.planPrice = plan.priceCOP;
      updatePayload.maxProducts = plan.maxProducts;
    }

    setAllBusinesses(prev => prev.map(b => b.id === businessId ? { ...b, ...updatePayload } : b));
    if (currentBusiness?.id === businessId) {
      setCurrentBusiness(prev => prev ? { ...prev, ...updatePayload } : null);
    }

    if (!user?.isAnonymous) {
      try {
        await updateDoc(doc(db, 'businesses', businessId), updatePayload);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `businesses/${businessId}`);
      }
    }
  };

  // Change business plan (Admin or Self-Upgrade)
  const changeBusinessPlan = async (businessId: string, planId: string) => {
    const plan = getPlanById(planId);
    const updatePayload = {
      planId: plan.id,
      planName: plan.name,
      planPrice: plan.priceCOP,
      maxProducts: plan.maxProducts,
      updatedAt: new Date().toISOString(),
    };

    setAllBusinesses(prev => prev.map(b => b.id === businessId ? { ...b, ...updatePayload } : b));
    if (currentBusiness?.id === businessId) {
      setCurrentBusiness(prev => prev ? { ...prev, ...updatePayload } : null);
    }

    if (!user?.isAnonymous) {
      try {
        await updateDoc(doc(db, 'businesses', businessId), updatePayload);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `businesses/${businessId}`);
      }
    }
  };

  // Super Admin: Extend subscription by N days
  const extendSubscription = async (businessId: string, additionalDays: number = 30) => {
    const target = allBusinesses.find(b => b.id === businessId) || currentBusiness;
    let baseTime = new Date().getTime();
    if (target?.subscriptionExpiresAt) {
      const expTime = new Date(target.subscriptionExpiresAt).getTime();
      if (expTime > baseTime) {
        baseTime = expTime; // Add to existing days if not yet expired
      }
    }

    const newExpires = new Date(baseTime + additionalDays * 24 * 60 * 60 * 1000).toISOString();
    const updatePayload = {
      status: 'ACTIVE' as BusinessStatus,
      subscriptionExpiresAt: newExpires,
      updatedAt: new Date().toISOString(),
      suspensionReason: '',
    };

    setAllBusinesses(prev => prev.map(b => b.id === businessId ? { ...b, ...updatePayload } : b));
    if (currentBusiness?.id === businessId) {
      setCurrentBusiness(prev => prev ? { ...prev, ...updatePayload } : null);
    }

    if (!user?.isAnonymous) {
      try {
        await updateDoc(doc(db, 'businesses', businessId), updatePayload);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `businesses/${businessId}`);
      }
    }
  };

  // Super Admin: Set custom exact expiration date
  const setCustomSubscriptionExpiration = async (businessId: string, expiresAtIso: string) => {
    const updatePayload = {
      status: 'ACTIVE' as BusinessStatus,
      subscriptionExpiresAt: expiresAtIso,
      updatedAt: new Date().toISOString(),
      suspensionReason: '',
    };

    setAllBusinesses(prev => prev.map(b => b.id === businessId ? { ...b, ...updatePayload } : b));
    if (currentBusiness?.id === businessId) {
      setCurrentBusiness(prev => prev ? { ...prev, ...updatePayload } : null);
    }

    if (!user?.isAnonymous) {
      try {
        await updateDoc(doc(db, 'businesses', businessId), updatePayload);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `businesses/${businessId}`);
      }
    }
  };

  // Super Admin: Suspend store with reason
  const suspendBusiness = async (businessId: string, reason?: string) => {
    const updatePayload = {
      status: 'SUSPENDED' as BusinessStatus,
      suspensionReason: reason || 'Suspendido por falta de pago o revisión administrativa',
      updatedAt: new Date().toISOString(),
    };

    setAllBusinesses(prev => prev.map(b => b.id === businessId ? { ...b, ...updatePayload } : b));
    if (currentBusiness?.id === businessId) {
      setCurrentBusiness(prev => prev ? { ...prev, ...updatePayload } : null);
    }

    if (!user?.isAnonymous) {
      try {
        await updateDoc(doc(db, 'businesses', businessId), updatePayload);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `businesses/${businessId}`);
      }
    }
  };

  // Super Admin: Reactivate store
  const reactivateBusiness = async (businessId: string) => {
    const now = new Date();
    // If expired, grant at least 30 days on reactivation
    const target = allBusinesses.find(b => b.id === businessId);
    let expiresAt = target?.subscriptionExpiresAt;
    if (!expiresAt || new Date(expiresAt).getTime() <= now.getTime()) {
      expiresAt = new Date(now.getTime() + 30 * 86400000).toISOString();
    }

    const updatePayload = {
      status: 'ACTIVE' as BusinessStatus,
      subscriptionExpiresAt: expiresAt,
      suspensionReason: '',
      updatedAt: now.toISOString(),
    };

    setAllBusinesses(prev => prev.map(b => b.id === businessId ? { ...b, ...updatePayload } : b));
    if (currentBusiness?.id === businessId) {
      setCurrentBusiness(prev => prev ? { ...prev, ...updatePayload } : null);
    }

    if (!user?.isAnonymous) {
      try {
        await updateDoc(doc(db, 'businesses', businessId), updatePayload);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `businesses/${businessId}`);
      }
    }
  };

  // Super Admin: Update full business account details
  const updateBusinessByAdmin = async (businessId: string, data: Partial<Business>) => {
    // Sanitize data: remove any undefined keys and ensure valid status
    const cleanPayload: Record<string, any> = {};
    for (const [key, val] of Object.entries(data)) {
      if (val !== undefined) {
        cleanPayload[key] = val;
      }
    }

    if (!cleanPayload.status) {
      const existing = allBusinesses.find(b => b.id === businessId) || currentBusiness;
      cleanPayload.status = existing?.status || 'ACTIVE';
    }

    cleanPayload.updatedAt = new Date().toISOString();

    setAllBusinesses(prev => prev.map(b => b.id === businessId ? { ...b, ...cleanPayload } : b));
    if (currentBusiness?.id === businessId) {
      setCurrentBusiness(prev => prev ? { ...prev, ...cleanPayload } : null);
    }

    if (!user?.isAnonymous) {
      try {
        await updateDoc(doc(db, 'businesses', businessId), cleanPayload);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `businesses/${businessId}`);
      }
    }
  };

  // Super Admin: Create a new business account directly
  const createBusinessByAdmin = async (data: Partial<Business>): Promise<Business> => {
    const bizId = data.id || `biz_${Date.now()}`;
    const now = new Date().toISOString();
    const chosenPlan = getPlanById(data.planId || 'tienda');
    const expiresAt = data.subscriptionExpiresAt || new Date(Date.now() + 30 * 86400000).toISOString();

    const newBiz: Business = {
      id: bizId,
      name: data.name || 'Nueva Tienda',
      ownerId: data.ownerId || (user ? user.uid : 'admin_created'),
      nit: data.nit || 'Sin NIT',
      phone: data.phone || '',
      whatsapp: data.whatsapp || data.phone || '573000000000',
      address: data.address || '',
      city: data.city || 'Bogotá',
      currency: 'COP',
      slug: data.slug || (data.name ? data.name.toLowerCase().replace(/[^a-z0-9]/g, '-') : `tienda-${bizId.substring(4, 9)}`),
      catalogActive: data.catalogActive !== undefined ? data.catalogActive : true,
      receiptFooter: data.receiptFooter || '¡Gracias por su compra!',
      status: (data.status as BusinessStatus) || 'ACTIVE',
      businessType: data.businessType || 'Tienda de barrio / Abarrotes',
      merchantContactName: data.merchantContactName || 'Propietario',
      planId: chosenPlan.id,
      planName: chosenPlan.name,
      planPrice: data.planPrice || chosenPlan.priceCOP,
      maxProducts: data.maxProducts || chosenPlan.maxProducts,
      activatedAt: now,
      subscriptionExpiresAt: expiresAt,
      adminNotes: data.adminNotes || 'Creado directamente por Super Admin.',
      createdAt: now,
      updatedAt: now,
    };

    setAllBusinesses(prev => [newBiz, ...prev]);

    if (!user?.isAnonymous) {
      try {
        await setDoc(doc(db, 'businesses', bizId), newBiz);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `businesses/${bizId}`);
      }
    }

    return newBiz;
  };

  // Super Admin: Delete store request
  const deleteBusiness = async (businessId: string) => {
    setAllBusinesses(prev => prev.filter(b => b.id !== businessId));
    setBusinesses(prev => prev.filter(b => b.id !== businessId));
    if (currentBusiness?.id === businessId) {
      setCurrentBusiness(null);
    }

    if (!user?.isAnonymous) {
      try {
        await deleteDoc(doc(db, 'businesses', businessId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `businesses/${businessId}`);
      }
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
        changeBusinessPlan,
        suspendBusiness,
        reactivateBusiness,
        extendSubscription,
        setCustomSubscriptionExpiration,
        updateBusinessByAdmin,
        createBusinessByAdmin,
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
