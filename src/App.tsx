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
  Clock,
  Sun,
  Moon
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
  const [publicTab, setPublicTab] = useState<'inicio' | 'planes' | 'servicios'>('inicio');
  const [showPublicRegisterModal, setShowPublicRegisterModal] = useState(false);

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
    const isDark = theme === 'dark';
    return (
      <div className={`min-h-screen ${isDark ? 'bg-stone-950 text-stone-100' : 'bg-stone-50 text-stone-900'} flex flex-col justify-between selection:bg-emerald-600 selection:text-white`}>
        
        {/* Top bar & Navbar */}
        <header className={`p-4 sm:px-8 sm:py-5 border-b ${isDark ? 'border-stone-800 bg-stone-900/80' : 'border-stone-200 bg-white/80'} backdrop-blur sticky top-0 z-30 shadow-xs`}>
          <div className="max-w-7xl mx-auto w-full flex flex-col sm:flex-row items-center justify-between gap-4">
            
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setPublicTab('inicio')}>
              <div className="w-10 h-10 rounded-2xl bg-amber-400 text-emerald-950 flex items-center justify-center font-black text-2xl shadow-md">
                A
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className={`font-extrabold text-xl ${isDark ? 'text-white' : 'text-stone-900'} tracking-tight`}>Anapse PosTienda</span>
                  <span className="text-[10px] bg-amber-400 text-emerald-950 font-black px-2 py-0.5 rounded uppercase">
                    Colombia
                  </span>
                </div>
                <p className={`text-xs ${isDark ? 'text-emerald-400' : 'text-emerald-700 font-medium'}`}>Punto de Venta, Caja e Inventario para Tiendas</p>
              </div>
            </div>

            {/* Public Navbar Links */}
            <nav className="flex items-center gap-1 sm:gap-2 bg-stone-800/10 p-1 rounded-2xl">
              <button
                onClick={() => setPublicTab('inicio')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                  publicTab === 'inicio' 
                    ? 'bg-emerald-700 text-white shadow-sm' 
                    : isDark ? 'text-stone-300 hover:text-white hover:bg-stone-800' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200'
                }`}
              >
                Inicio
              </button>
              <button
                onClick={() => setPublicTab('planes')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                  publicTab === 'planes' 
                    ? 'bg-emerald-700 text-white shadow-sm' 
                    : isDark ? 'text-stone-300 hover:text-white hover:bg-stone-800' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200'
                }`}
              >
                Planes y Precios
              </button>
              <button
                onClick={() => setPublicTab('servicios')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                  publicTab === 'servicios' 
                    ? 'bg-emerald-700 text-white shadow-sm' 
                    : isDark ? 'text-stone-300 hover:text-white hover:bg-stone-800' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200'
                }`}
              >
                Servicios
              </button>
            </nav>

            {/* Right Action & Theme Toggle */}
            <div className="flex items-center gap-3">
              <button
                onClick={toggleTheme}
                title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                className={`p-2.5 rounded-xl border transition ${
                  isDark 
                    ? 'bg-stone-900 border-stone-800 text-amber-300 hover:bg-stone-800' 
                    : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-100 shadow-xs'
                }`}
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4 text-stone-800" />}
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
                className="bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow transition active:scale-98"
              >
                Modo Prueba
              </button>
            </div>
          </div>
        </header>

        {/* Main Body */}
        <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8 w-full flex-1">
          {publicTab === 'inicio' && (
            <div className="max-w-4xl mx-auto text-center space-y-8 py-4">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-900/60 border border-emerald-700 text-emerald-300 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Sistema Profesional con Pre-Aprobación y Contador de 30 Días</span>
              </div>

              <h1 className={`text-3xl sm:text-6xl font-black ${isDark ? 'text-white' : 'text-stone-900'} tracking-tight leading-tight`}>
                Administra tu tienda fácil y rápido
              </h1>

              <p className={`text-sm sm:text-base ${isDark ? 'text-stone-300' : 'text-stone-600'} max-w-2xl mx-auto leading-relaxed`}>
                Diseñado 100% para el comercio colombiano: caja rápida para celular y computador, cobros con Nequi y Daviplata, el cuaderno de fiados digital con cobro por WhatsApp, control de inventario y catálogo online propio.
              </p>

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
                  className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-5 py-3.5 rounded-2xl shadow-lg transition active:scale-98 text-xs sm:text-sm"
                >
                  <span>Modo Prueba</span>
                  <ArrowRight className="w-4 h-4 text-emerald-300" />
                </button>

                <button
                  onClick={() => setShowPublicRegisterModal(true)}
                  className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-emerald-950 font-bold px-5 py-3.5 rounded-2xl shadow-lg transition active:scale-98 text-xs sm:text-sm"
                >
                  <Store className="w-4 h-4" />
                  <span>Registra tu Negocio</span>
                </button>
              </div>

              {showPublicRegisterModal && (
                <NewStoreRequestModal 
                  onClose={() => setShowPublicRegisterModal(false)} 
                  isInitialSetup={true} 
                />
              )}

              {/* Feature highlights */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 text-left">
                <div className={`p-5 rounded-2xl ${isDark ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200 shadow-xs'}`}>
                  <Receipt className="w-6 h-6 text-amber-500 mb-2" />
                  <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-stone-900'}`}>Caja Rápida POS</h3>
                  <p className="text-xs text-stone-400 mt-1">Cobros en efectivo, Nequi, Daviplata y ticket térmico.</p>
                </div>

                <div className={`p-5 rounded-2xl ${isDark ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200 shadow-xs'}`}>
                  <Users className="w-6 h-6 text-emerald-500 mb-2" />
                  <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-stone-900'}`}>Cuaderno de Fiados</h3>
                  <p className="text-xs text-stone-400 mt-1">Saldos pendientes, abonos y extractos a WhatsApp.</p>
                </div>

                <div className={`p-5 rounded-2xl ${isDark ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200 shadow-xs'}`}>
                  <Boxes className="w-6 h-6 text-teal-500 mb-2" />
                  <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-stone-900'}`}>Stock y Balanza</h3>
                  <p className="text-xs text-stone-400 mt-1">Kardex, alertas de agotados y venta por peso en balanza.</p>
                </div>

                <div className={`p-5 rounded-2xl ${isDark ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200 shadow-xs'}`}>
                  <Globe className="w-6 h-6 text-blue-500 mb-2" />
                  <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-stone-900'}`} >Catálogo Online</h3>
                  <p className="text-xs text-stone-400 mt-1">Pedidos directos a tu WhatsApp sin pagar comisiones.</p>
                </div>
              </div>
            </div>
          )}

          {publicTab === 'planes' && (
            <PlansServicesView />
          )}

          {publicTab === 'servicios' && (
            <div className="max-w-4xl mx-auto space-y-8 py-4">
              <div className="text-center space-y-3">
                <span className="text-xs bg-emerald-700 text-white font-black px-3.5 py-1 rounded-full uppercase tracking-wider">
                  Servicios Incluidos
                </span>
                <h2 className={`text-3xl sm:text-4xl font-black ${isDark ? 'text-white' : 'text-stone-900'}`}>
                  Todo lo que tu negocio necesita en una sola aplicación
                </h2>
                <p className="text-sm text-stone-400 max-w-xl mx-auto">
                  Diseñado para optimizar cada minuto en tu minimarket, tienda de barrio o almacén.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className={`p-6 rounded-3xl border ${isDark ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200 shadow-md'} space-y-3`}>
                  <div className="w-10 h-10 rounded-2xl bg-amber-400 text-emerald-950 flex items-center justify-center font-bold">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-stone-900'}`}>1. Punto de Venta (POS) y Caja Rápida</h3>
                  <p className="text-xs text-stone-400 leading-relaxed">
                    Registra ventas en segundos con lector de código de barras o búsqueda rápida. Maneja efectivo, transferencias Nequi y Daviplata, calcule devueltos automáticamente e imprime tickets en impresoras térmicas Bluetooth o USB.
                  </p>
                </div>

                <div className={`p-6 rounded-3xl border ${isDark ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200 shadow-md'} space-y-3`}>
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center font-bold">
                    <Users className="w-5 h-5" />
                  </div>
                  <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-stone-900'}`}>2. Cuaderno de Fiados Digital</h3>
                  <p className="text-xs text-stone-400 leading-relaxed">
                    Olvídate de los cuadernos de papel. Lleva el control exacto de lo que fía cada cliente, registra abonos parciales y envía recordatorios de cobro profesionales directamente a su WhatsApp con un solo clic.
                  </p>
                </div>

                <div className={`p-6 rounded-3xl border ${isDark ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200 shadow-md'} space-y-3`}>
                  <div className="w-10 h-10 rounded-2xl bg-teal-500 text-white flex items-center justify-center font-bold">
                    <Boxes className="w-5 h-5" />
                  </div>
                  <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-stone-900'}`}>3. Control de Inventario y Balanza</h3>
                  <p className="text-xs text-stone-400 leading-relaxed">
                    Kardex detallado de entradas, salidas y mermas. Alertas automáticas de productos próximos a agotarse. Soporte para productos fraccionados y venta por peso en balanza digital.
                  </p>
                </div>

                <div className={`p-6 rounded-3xl border ${isDark ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200 shadow-md'} space-y-3`}>
                  <div className="w-10 h-10 rounded-2xl bg-blue-500 text-white flex items-center justify-center font-bold">
                    <Globe className="w-5 h-5" />
                  </div>
                  <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-stone-900'}`}>4. Catálogo Online con Enlace Propio</h3>
                  <p className="text-xs text-stone-400 leading-relaxed">
                    Publica tu tienda en internet con un enlace personalizado para que tus vecinos y clientes habituales puedan hacer pedidos a domicilio directamente desde sus celulares hacia tu WhatsApp.
                  </p>
                </div>
              </div>

              <div className="text-center pt-4">
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
                  className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-8 py-4 rounded-2xl shadow-xl transition active:scale-98"
                >
                  Probar Aplicación en Vivo (Modo Demo)
                </button>
              </div>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className={`p-4 border-t ${isDark ? 'border-stone-800 text-stone-500' : 'border-stone-200 text-stone-500'} text-center text-xs`}>
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
