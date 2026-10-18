import React from 'react';
import { 
  Home, 
  ShoppingCart, 
  Receipt, 
  Package, 
  Boxes, 
  Truck, 
  Users, 
  Building2, 
  CircleDollarSign, 
  BarChart3, 
  Globe, 
  Settings, 
  X, 
  ShieldCheck, 
  Zap,
  Store,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../firebase/authContext';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, isOpen, onClose }) => {
  const { currentRole, currentBusiness, allBusinesses, isSuperAdmin, user } = useAuth();
  const isAdminView = currentView === 'superadmin';
  const pendingCount = allBusinesses.filter(b => b.status === 'PENDING').length;

  const storeNavItems = [
    { id: 'dashboard', label: '1. Inicio', icon: Home, roles: ['owner', 'admin', 'cashier'] },
    { id: 'pos', label: '2. Nueva venta (Caja)', icon: ShoppingCart, roles: ['owner', 'admin', 'cashier'], highlight: true },
    { id: 'sales', label: '3. Historial de ventas', icon: Receipt, roles: ['owner', 'admin', 'cashier'] },
    { id: 'products', label: '4. Productos', icon: Package, roles: ['owner', 'admin'] },
    { id: 'inventory', label: '5. Inventario y Kardex', icon: Boxes, roles: ['owner', 'admin'] },
    { id: 'purchases', label: '6. Compras y Abastecimiento', icon: Truck, roles: ['owner', 'admin'] },
    { id: 'customers', label: '7. Clientes y Fiado', icon: Users, roles: ['owner', 'admin', 'cashier'] },
    { id: 'suppliers', label: '8. Proveedores', icon: Building2, roles: ['owner', 'admin'] },
    { id: 'cash', label: '9. Caja Diaria', icon: CircleDollarSign, roles: ['owner', 'admin', 'cashier'] },
    { id: 'reports', label: '10. Reportes y Ganancias', icon: BarChart3, roles: ['owner', 'admin'] },
    { id: 'catalog', label: '11. Catálogo Online', icon: Globe, roles: ['owner', 'admin'] },
    { id: 'plans', label: '12. Planes y Servicios', icon: Zap, roles: ['owner', 'admin', 'cashier'], highlight: true },
    { id: 'settings', label: '13. Configuración y DIAN', icon: Settings, roles: ['owner', 'admin'] },
  ];

  const allowedStoreItems = storeNavItems.filter(item => item.roles.includes(currentRole));

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          onClick={onClose}
          className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs z-40 md:hidden"
        />
      )}

      {/* Sidebar container */}
      <aside 
        className={`fixed md:sticky top-0 md:top-16 left-0 h-full md:h-[calc(100vh-4rem)] w-72 bg-stone-900 text-stone-200 flex flex-col z-50 md:z-30 transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } border-r border-stone-800 print:hidden`}
      >
        {/* Mobile Header */}
        <div className="p-4 flex items-center justify-between border-b border-stone-800 md:hidden">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-lg">
              {isAdminView ? 'Menú Super Admin' : 'Menú de Tienda'}
            </span>
            <span className="text-[10px] bg-amber-400 text-stone-950 font-bold px-1.5 py-0.5 rounded uppercase">
              {isAdminView ? 'MASTER' : 'COP'}
            </span>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* CASE A: USER IS IN SUPER ADMIN VIEW */}
        {/* ----------------------------------------------------------------- */}
        {isAdminView ? (
          <div className="flex-1 flex flex-col justify-between overflow-y-auto">
            <div className="p-3 space-y-3">
              
              {/* Admin Master Identity */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-stone-950 to-stone-900 border border-amber-500/30 shadow-md">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-400 text-stone-950 flex items-center justify-center font-black text-base shadow">
                    👑
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-amber-400 block tracking-wider">
                      SUPER ADMINISTRADOR
                    </span>
                    <p className="font-bold text-sm text-white truncate max-w-[170px]">
                      {user?.email || 'Admin Master'}
                    </p>
                  </div>
                </div>
                <div className="pt-2 border-t border-stone-800 text-xs text-stone-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Comercios:</span>
                    <span className="font-bold text-amber-400 font-mono">{allBusinesses.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Por Aprobar:</span>
                    <span className={`font-bold font-mono ${pendingCount > 0 ? 'text-amber-400 animate-pulse' : 'text-stone-400'}`}>
                      {pendingCount}
                    </span>
                  </div>
                </div>
              </div>

              {/* Admin Navigation Options */}
              <nav className="space-y-1">
                <button
                  onClick={() => { onNavigate('superadmin'); onClose(); }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold bg-amber-400 text-stone-950 shadow-md"
                >
                  <ShieldCheck className="w-4 h-4 text-stone-950" />
                  <span>Panel Maestro & Comercios</span>
                </button>
              </nav>

              {/* Return to store button */}
              <div className="pt-4 border-t border-stone-800">
                <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider px-2 mb-2">
                  Operación de Tienda
                </p>
                <button
                  onClick={() => { onNavigate('pos'); onClose(); }}
                  className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-bold bg-emerald-700 hover:bg-emerald-600 text-white transition active:scale-95 shadow-md"
                >
                  <Store className="w-4 h-4 text-emerald-200" />
                  <span>Ir al POS (Caja / Ventas)</span>
                </button>
              </div>

            </div>

            <div className="p-3 border-t border-stone-800 text-[11px] text-stone-400 text-center">
              <p className="font-bold text-stone-300">Anapse PosTienda</p>
              <p className="text-stone-400 text-[10px]">Consola Master de Gestión</p>
            </div>
          </div>
        ) : (
          /* ----------------------------------------------------------------- */
          /* CASE B: USER IS IN STORE VIEW (POS, Dashboard, Inventory, etc.)   */
          /* ----------------------------------------------------------------- */
          <div className="flex-1 flex flex-col justify-between overflow-y-auto">
            <div>
              {/* If super admin (or demo), show clear banner to jump to Admin Panel */}
              {(isSuperAdmin || user?.isAnonymous) && (
                <div className="p-3 m-2 rounded-2xl bg-amber-400/10 border border-amber-400/30">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                      Modo Master Admin
                    </span>
                    {pendingCount > 0 ? (
                      <span className="bg-rose-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                        {pendingCount} por aprobar
                      </span>
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    )}
                  </div>
                  <button
                    onClick={() => { onNavigate('superadmin'); onClose(); }}
                    className="w-full py-2 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-black text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-95"
                  >
                    <ShieldCheck className="w-4 h-4 text-stone-950" />
                    <span>Abrir Panel Super Admin</span>
                  </button>
                </div>
              )}

              {/* Store mini profile */}
              <div className="p-4 border-b border-stone-800/80 bg-stone-950/40">
                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">
                  Tienda Activa (POS)
                </p>
                <p className="font-bold text-sm text-white truncate">{currentBusiness?.name || 'Mi Tienda'}</p>
                <div className="flex items-center justify-between mt-1 text-xs text-stone-400">
                  <span>NIT: {currentBusiness?.nit || 'No asignado'}</span>
                  <span className="text-emerald-400 font-semibold">{currentBusiness?.city || 'Colombia'}</span>
                </div>
              </div>

              {/* Navigation Items */}
              <nav className="p-3 space-y-1">
                {allowedStoreItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentView === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onNavigate(item.id);
                        onClose();
                      }}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all text-left group ${
                        isActive
                          ? item.highlight
                            ? 'bg-amber-400 text-stone-950 font-bold shadow-md shadow-amber-400/20'
                            : 'bg-emerald-700 text-white shadow-sm'
                          : item.highlight
                          ? 'text-amber-300 hover:bg-amber-400/10'
                          : 'text-stone-300 hover:bg-stone-800 hover:text-white'
                      }`}
                    >
                      <Icon className={`w-4 h-4 flex-shrink-0 ${
                        isActive 
                          ? item.highlight ? 'text-stone-950' : 'text-emerald-200'
                          : item.highlight ? 'text-amber-400' : 'text-stone-400 group-hover:text-stone-200'
                      }`} />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Bottom footer */}
            <div className="p-3 border-t border-stone-800 text-[11px] text-stone-400 text-center">
              <p className="font-medium text-stone-300">Anapse PosTienda Colombia</p>
              <p className="text-stone-400 text-[10px]">Moneda: Pesos Colombianos (COP)</p>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};
