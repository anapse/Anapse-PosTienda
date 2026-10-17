import React, { useState } from 'react';
import { AuthProvider, useAuth } from './firebase/authContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './views/DashboardView';
import { PosView } from './views/PosView';
import { SalesHistoryView } from './views/SalesHistoryView';
import { ProductsView } from './views/ProductsView';
import { InventoryView } from './views/InventoryView';
import { PurchasesView } from './views/PurchasesView';
import { CustomersView } from './views/CustomersView';
import { SuppliersView } from './views/SuppliersView';
import { CashShiftView } from './views/CashShiftView';
import { ReportsView } from './views/ReportsView';
import { OnlineCatalogView } from './views/OnlineCatalogView';
import { SettingsView } from './views/SettingsView';
import { SuperAdminView } from './views/SuperAdminView';
import { PendingApprovalView } from './views/PendingApprovalView';
import { PlansServicesView } from './views/PlansServicesView';
import { SubscriptionBanner } from './components/SubscriptionBanner';
import { NewStoreRequestModal } from './components/NewStoreRequestModal';
import { isSubscriptionExpired, SERVICE_WHATSAPP_NUMBER, PLAN_MONTHLY_PRICE_COP, PLAN_MAX_PRODUCTS } from './utils/subscription';
import { formatCOP } from './utils/currency';
import { 
  Store, 
  Smartphone, 
  Receipt, 
  Users, 
  Boxes, 
  Globe, 
  ArrowRight, 
  ShieldCheck,
  Sparkles,
  CheckCircle,
  Clock
} from 'lucide-react';

function MainApp() {
  const { user, loading, signInWithGoogle, signInQuickDemo, signOutUser, currentRole, currentBusiness, isSuperAdmin } = useAuth();
  const [currentView, setCurrentView] = useState(isSuperAdmin ? 'superadmin' : 'dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [showDemoRegisterModal, setShowDemoRegisterModal] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('anapse_theme') as 'light' | 'dark') || 'light';
  });

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('anapse_theme', next);
  };

  // Check if visitor entered via public catalog link in URL
  const urlParams = new URLSearchParams(window.location.search);
  const isPublicCatalogParam = urlParams.has('catalogo');

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-100 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-emerald-700 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="font-extrabold text-stone-800 text-lg">Anapse PosTienda</p>
        <p className="text-xs text-stone-500 mt-1">Conectando a base de datos persistente...</p>
      </div>
    );
  }

  // Standalone public catalog view for customers arriving via link
  if (!user && isPublicCatalogParam) {
    return (
      <div className="min-h-screen bg-stone-100 flex flex-col font-sans text-stone-900">
        <header className="bg-emerald-800 text-white shadow-md p-4 flex items-center justify-between max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-400 text-emerald-950 flex items-center justify-center font-black text-lg">
              A
            </div>
            <span className="font-bold text-base">Anapse PosTienda • Catálogo Online</span>
          </div>
          <a
            href="/"
            className="text-xs bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-xl font-bold"
          >
            Acceso Tendero
          </a>
        </header>
        <main className="max-w-7xl mx-auto w-full p-4 sm:p-6">
          <OnlineCatalogView />
        </main>
      </div>
    );
  }

  // Not logged in view
  if (!user) {
    return (
      <div className="min-h-screen bg-stone-900 text-stone-100 flex flex-col justify-between selection:bg-emerald-600 selection:text-white">
        
        {/* Top bar */}
        <header className="p-4 sm:p-6 max-w-7xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-400 text-emerald-950 flex items-center justify-center font-black text-2xl shadow-md">
              A
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-xl text-white tracking-tight">Anapse PosTienda</span>
                <span className="text-[10px] bg-amber-400 text-emerald-950 font-black px-2 py-0.5 rounded uppercase">
                  Colombia
                </span>
              </div>
              <p className="text-xs text-emerald-400">Punto de Venta, Caja e Inventario para Tiendas y Minimarkets</p>
            </div>
          </div>
        </header>

        {/* Hero Body */}
        <main className="max-w-4xl mx-auto px-4 py-6 sm:py-10 text-center space-y-6">
          
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-900/60 border border-emerald-700 text-emerald-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Sistema Profesional con Pre-Aprobación y Contador de 30 Días</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Administra tu tienda fácil y rápido en <span className="text-amber-400">Pesos Colombianos (COP)</span>
          </h1>

          <p className="text-sm sm:text-base text-stone-300 max-w-2xl mx-auto leading-relaxed">
            Diseñado 100% para el comercio colombiano: caja rápida para celular y computador, cobros con Nequi y Daviplata, el cuaderno de fiados digital con cobro por WhatsApp, control de inventario y catálogo online propio.
          </p>

          {/* Commercial Plans Summary Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl mx-auto text-left">
            <div className="bg-stone-800/90 border border-emerald-500/60 rounded-2xl p-4 shadow-md relative">
              <span className="text-[10px] bg-emerald-700 text-white font-black px-2 py-0.5 rounded-full uppercase">
                Plan Tienda
              </span>
              <p className="text-xl font-black text-white mt-1.5">{formatCOP(40000)} <span className="text-[11px] font-normal text-stone-400">/ mes</span></p>
              <p className="text-xs font-bold text-amber-300 mt-0.5">Hasta 500 productos</p>
              <p className="text-[11px] text-stone-300 mt-1">Ventas, inventario, caja, clientes, fiado y reportes.</p>
            </div>

            <div className="bg-stone-800/90 border border-stone-700 rounded-2xl p-4 shadow-md">
              <span className="text-[10px] bg-stone-700 text-stone-200 font-black px-2 py-0.5 rounded-full uppercase">
                Plan Almacén
              </span>
              <p className="text-xl font-black text-white mt-1.5">{formatCOP(60000)} <span className="text-[11px] font-normal text-stone-400">/ mes</span></p>
              <p className="text-xs font-bold text-amber-300 mt-0.5">501 – 2.000 productos</p>
              <p className="text-[11px] text-stone-300 mt-1">Más capacidad de catálogo y herramientas adicionales de inventario.</p>
            </div>

            <div className="bg-stone-800/90 border border-purple-500/50 rounded-2xl p-4 shadow-md">
              <span className="text-[10px] bg-purple-900 text-purple-200 font-black px-2 py-0.5 rounded-full uppercase">
                Plan Comercial
              </span>
              <p className="text-xl font-black text-white mt-1.5">{formatCOP(90000)} <span className="text-[11px] font-normal text-stone-400">/ mes</span></p>
              <p className="text-xs font-bold text-amber-300 mt-0.5">Más de 2.000 productos</p>
              <p className="text-[11px] text-stone-300 mt-1">Para catálogos grandes y administración más avanzada.</p>
            </div>
          </div>

          <div className="text-xs text-stone-400 max-w-lg mx-auto flex items-center justify-center gap-2">
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <span>Soporte oficial y activaciones: <strong>{SERVICE_WHATSAPP_NUMBER}</strong> (Solo WhatsApp)</span>
          </div>

          {/* Action Login Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
            <button
              onClick={async () => {
                setIsAuthLoading(true);
                try {
                  await signInWithGoogle();
                } catch (e) {
                  console.error(e);
                } finally {
                  setIsAuthLoading(false);
                }
              }}
              disabled={isAuthLoading}
              className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 bg-white hover:bg-stone-100 text-stone-900 font-bold px-6 py-3.5 rounded-2xl shadow-lg transition active:scale-98"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
              <span>Iniciar con Google</span>
            </button>

            <button
              onClick={async () => {
                setIsAuthLoading(true);
                try {
                  await signInQuickDemo();
                } catch (e) {
                  console.error(e);
                } finally {
                  setIsAuthLoading(false);
                }
              }}
              disabled={isAuthLoading}
              className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-6 py-3.5 rounded-2xl shadow-lg transition active:scale-98"
            >
              <span>Entrar en Modo Prueba</span>
              <ArrowRight className="w-4 h-4 text-emerald-300" />
            </button>
          </div>

          {/* Feature highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 text-left">
            <div className="p-4 rounded-2xl bg-stone-800/80 border border-stone-700">
              <Receipt className="w-5 h-5 text-amber-400 mb-2" />
              <h2 className="font-bold text-sm text-white">Caja Rápida POS</h2>
              <p className="text-xs text-stone-400 mt-1">Cobros en efectivo, Nequi, Daviplata y ticket térmico.</p>
            </div>

            <div className="p-4 rounded-2xl bg-stone-800/80 border border-stone-700">
              <Users className="w-5 h-5 text-emerald-400 mb-2" />
              <h2 className="font-bold text-sm text-white">Cuaderno de Fiados</h2>
              <p className="text-xs text-stone-400 mt-1">Saldos pendientes, abonos y extractos a WhatsApp.</p>
            </div>

            <div className="p-4 rounded-2xl bg-stone-800/80 border border-stone-700">
              <Boxes className="w-5 h-5 text-teal-400 mb-2" />
              <h2 className="font-bold text-sm text-white">Stock y Balanza</h2>
              <p className="text-xs text-stone-400 mt-1">Kardex, alertas de agotados y venta por peso en balanza.</p>
            </div>

            <div className="p-4 rounded-2xl bg-stone-800/80 border border-stone-700">
              <Globe className="w-5 h-5 text-blue-400 mb-2" />
              <h2 className="font-bold text-sm text-white">Catálogo Online</h2>
              <p className="text-xs text-stone-400 mt-1">Pedidos directos a tu WhatsApp sin pagar comisiones.</p>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="p-4 border-t border-stone-800 text-center text-xs text-stone-500">
          Anapse PosTienda Colombia • Moneda: Pesos Colombianos (COP) • Soporte WhatsApp: {SERVICE_WHATSAPP_NUMBER}
        </footer>
      </div>
    );
  }

  // If user has no store registered yet, ask them to submit store request
  if (!currentBusiness && !isSuperAdmin) {
    return (
      <div className="min-h-screen bg-stone-900 flex items-center justify-center p-4">
        <NewStoreRequestModal isInitialSetup={true} onClose={signOutUser} />
      </div>
    );
  }

  // If store is PENDING or SUSPENDED or EXPIRED, and user is not superadmin
  if (
    currentBusiness && 
    !isSuperAdmin && 
    (currentBusiness.status === 'PENDING' || currentBusiness.status === 'SUSPENDED' || isSubscriptionExpired(currentBusiness.subscriptionExpiresAt))
  ) {
    return <PendingApprovalView />;
  }

  // Render authorized views
  const renderView = () => {
    switch (currentView) {
      case 'superadmin':
        return <SuperAdminView />;
      case 'dashboard':
        return <DashboardView onNavigate={setCurrentView} />;
      case 'pos':
        return <PosView onNavigate={setCurrentView} />;
      case 'sales':
        return <SalesHistoryView />;
      case 'products':
        return <ProductsView />;
      case 'inventory':
        return <InventoryView />;
      case 'purchases':
        return <PurchasesView />;
      case 'customers':
        return <CustomersView />;
      case 'suppliers':
        return <SuppliersView />;
      case 'cash':
        return <CashShiftView />;
      case 'reports':
        return <ReportsView />;
      case 'catalog':
        return <OnlineCatalogView />;
      case 'plans':
        return <PlansServicesView onNavigate={setCurrentView} />;
      case 'settings':
        return <SettingsView />;
      default:
        return isSuperAdmin ? <SuperAdminView /> : <DashboardView onNavigate={setCurrentView} />;
    }
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans selection:bg-emerald-600 selection:text-white ${theme === 'dark' ? 'bg-stone-950 text-stone-100' : 'bg-stone-100 text-stone-900'}`}>
      {/* Demo Mode Top Banner */}
      {user?.isAnonymous && (
        <div className="bg-gradient-to-r from-amber-500 to-emerald-700 text-emerald-950 px-4 py-2 font-bold text-xs sm:text-sm flex flex-col sm:flex-row items-center justify-between gap-2 shadow-md z-50">
          <div className="flex items-center gap-2 text-white">
            <Sparkles className="w-4 h-4 text-amber-200 animate-pulse" />
            <span>Estás viendo el Modo de Prueba / Demo en Vivo de Anapse PosTienda. ¡Explora todas las funciones!</span>
          </div>
          <button
            onClick={() => setShowDemoRegisterModal(true)}
            className="bg-white hover:bg-stone-100 text-emerald-950 px-3.5 py-1.5 rounded-xl text-xs font-black shadow-sm transition active:scale-95"
          >
            ¡Registra tu Negocio y Obtén 30 Días!
          </button>
        </div>
      )}

      {showDemoRegisterModal && (
        <NewStoreRequestModal onClose={() => setShowDemoRegisterModal(false)} isInitialSetup={false} />
      )}

      {/* Top Navbar */}
      <Navbar 
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} 
        onNavigate={setCurrentView} 
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Sidebar */}
        <Sidebar 
          currentView={currentView}
          onNavigate={setCurrentView}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        {/* Main Content Area */}
        <main className="flex-1 p-3 sm:p-6 lg:p-8 min-w-0 overflow-y-auto">
          {/* Subscription 30-Day Notice */}
          <SubscriptionBanner />
          {renderView()}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
