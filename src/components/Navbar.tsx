import React from 'react';
import { useAuth } from '../firebase/authContext';
import { Store, CircleDollarSign, LogOut, Menu, PlusCircle, ShieldCheck, Zap, Sun, Moon } from 'lucide-react';
import { formatCOP } from '../utils/currency';

interface NavbarProps {
  onToggleSidebar: () => void;
  onNavigate: (view: string) => void;
  currentView?: string;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  onToggleSidebar, 
  onNavigate, 
  currentView = 'dashboard', 
  theme = 'light', 
  onToggleTheme 
}) => {
  const { user, currentBusiness, businesses, allBusinesses, currentRole, activeShift, selectBusiness, signOutUser, isSuperAdmin } = useAuth();
  const isAdminView = currentView === 'superadmin';
  const pendingApprovalsCount = allBusinesses.filter(b => b.status === 'PENDING').length;

  // -------------------------------------------------------------
  // DEDICATED SUPER ADMIN NAVBAR (When inside Super Admin View)
  // -------------------------------------------------------------
  if (isAdminView) {
    return (
      <header className="bg-stone-950 text-white shadow-lg sticky top-0 z-40 border-b border-stone-800 print:hidden w-full max-w-full overflow-hidden box-border">
        <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-1 sm:gap-3 box-border min-w-0">
          
          {/* Left: Mobile hamburger & Master Brand */}
          <div className="flex items-center gap-1 sm:gap-2.5 min-w-0 max-w-[130px] xs:max-w-[180px] sm:max-w-none">
            <button
              onClick={onToggleSidebar}
              className="md:hidden p-1 sm:p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 focus:outline-none shrink-0"
              aria-label="Abrir menú"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div 
              onClick={() => onNavigate('superadmin')}
              className="flex items-center gap-1.5 cursor-pointer select-none group min-w-0"
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-400 text-stone-950 flex items-center justify-center font-black text-sm sm:text-lg shadow-md group-hover:scale-105 transition-transform shrink-0">
                👑
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span className="font-black text-xs sm:text-base tracking-tight text-white truncate max-w-[85px] xs:max-w-[130px] sm:max-w-none">
                    Anapse PosTienda
                  </span>
                  <span className="hidden xs:inline text-[9px] sm:text-[10px] bg-amber-400 text-stone-950 font-black px-1.5 py-0.2 rounded-full uppercase tracking-wider shrink-0">
                    Master
                  </span>
                </div>
                <span className="text-[10px] text-stone-400 hidden sm:block -mt-0.5 truncate">
                  Centro de Control de Clientes y Suscripciones
                </span>
              </div>
            </div>
          </div>

          {/* Center: Platform Health & Switch to Store POS */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <div className="hidden md:flex items-center gap-2 text-xs bg-stone-900 border border-stone-800 px-3 py-1 rounded-xl">
              <span className="text-stone-400 font-medium">Comercios:</span>
              <span className="font-bold text-amber-400 font-mono">{allBusinesses.length}</span>
              {pendingApprovalsCount > 0 && (
                <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full ml-1 animate-pulse">
                  {pendingApprovalsCount} por aprobar
                </span>
              )}
            </div>

            {/* Button to go to Store POS */}
            <button
              onClick={() => onNavigate('pos')}
              className="flex items-center gap-1 bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-2 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-sm shadow-md transition active:scale-95 shrink-0"
              title="Abrir la caja registradora / Punto de Venta de tu tienda"
            >
              <Store className="w-3.5 h-3.5 text-emerald-200" />
              <span className="hidden sm:inline">Ir a mi Tienda (POS)</span>
              <span className="sm:hidden text-[10px] xs:text-xs">Tienda POS</span>
            </button>
          </div>

          {/* Right: User & Theme & Logout */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <div className="hidden lg:flex flex-col text-right">
              <span className="text-xs font-bold text-white truncate max-w-[150px]">
                {user?.email || 'Super Administrador'}
              </span>
              <span className="text-[10px] text-amber-400 font-bold uppercase">
                Acceso Maestro
              </span>
            </div>

            {onToggleTheme && (
              <button
                onClick={onToggleTheme}
                title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                className="p-1 sm:p-2 rounded-xl text-stone-300 hover:text-white hover:bg-stone-800 transition shrink-0"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4" />}
              </button>
            )}

            <button
              onClick={signOutUser}
              title="Cerrar sesión"
              className="p-1 sm:p-2 rounded-xl text-rose-300 hover:text-white hover:bg-rose-950/40 transition shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>
      </header>
    );
  }

  // -------------------------------------------------------------
  // REGULAR STORE NAVBAR (When inside POS, Dashboard, etc.)
  // -------------------------------------------------------------
  return (
    <header className="bg-emerald-800 text-white shadow-md sticky top-0 z-40 print:hidden w-full max-w-full overflow-hidden box-border">
      <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-1 sm:gap-2 box-border min-w-0">
        
        {/* Left: Mobile hamburger & Brand */}
        <div className="flex items-center gap-1 sm:gap-2 min-w-0 max-w-[110px] xs:max-w-[160px] sm:max-w-none">
          <button
            onClick={onToggleSidebar}
            className="md:hidden p-1 sm:p-1.5 rounded-lg text-emerald-100 hover:text-white hover:bg-emerald-700 focus:outline-none shrink-0"
            aria-label="Abrir menú"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div 
            onClick={() => onNavigate('dashboard')}
            className="flex items-center gap-1.5 cursor-pointer select-none group min-w-0"
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-400 text-emerald-950 flex items-center justify-center font-black text-sm sm:text-lg shadow-sm group-hover:scale-105 transition-transform shrink-0">
              {currentBusiness?.name?.[0]?.toUpperCase() || 'A'}
            </div>
            <div className="min-w-0">
              <span className="font-bold text-xs sm:text-base tracking-tight truncate block max-w-[65px] xs:max-w-[110px] sm:max-w-[200px]">
                {currentBusiness?.name || 'Anapse PosTienda'}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Store Selector, Caja status & Quick POS */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Store switcher (visible on wide screens) */}
          {businesses.length > 1 && (
            <div className="hidden lg:flex items-center gap-1.5 bg-emerald-900/60 rounded-xl px-2.5 py-1 text-xs">
              <Store className="w-3.5 h-3.5 text-amber-300" />
              <select
                value={currentBusiness?.id || ''}
                onChange={(e) => {
                  const b = businesses.find(x => x.id === e.target.value);
                  if (b) selectBusiness(b);
                }}
                className="bg-transparent text-white text-xs font-medium focus:outline-none cursor-pointer pr-2"
              >
                {businesses.map((b) => (
                  <option key={b.id} value={b.id} className="text-stone-900">
                    {b.name} ({b.city})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Caja Status Pill */}
          <button
            onClick={() => onNavigate('cash')}
            title={activeShift ? `Caja Abierta (${formatCOP(activeShift.initialCash)})` : 'Caja Cerrada'}
            className={`flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-full text-[10px] sm:text-xs font-semibold transition active:scale-95 shrink-0 ${
              activeShift
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400'
                : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/50'
            }`}
          >
            <CircleDollarSign className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {activeShift ? `Caja Abierta (${formatCOP(activeShift.initialCash)})` : 'Caja Cerrada'}
            </span>
            <span className="sm:hidden text-[10px]">
              {activeShift ? 'Caja OK' : 'Caja'}
            </span>
          </button>

          {/* Quick POS Button - Hidden on mobile if already in pos view */}
          {currentView !== 'pos' && (
            <button
              onClick={() => onNavigate('pos')}
              className="flex items-center gap-1 bg-amber-400 hover:bg-amber-300 text-emerald-950 font-bold px-1.5 sm:px-2.5 py-1 rounded-xl text-xs sm:text-sm shadow-sm transition active:scale-95 shrink-0"
              title="Abrir Punto de Venta"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Vender</span>
            </button>
          )}

          {/* Planes Button */}
          <button
            onClick={() => onNavigate('plans')}
            className="hidden md:flex items-center gap-1.5 bg-emerald-700/80 hover:bg-emerald-700 text-white font-bold px-2.5 py-1.5 rounded-xl text-xs border border-emerald-600 transition active:scale-95"
            title="Ver Planes y Servicios Comerciales"
          >
            <Zap className="w-3.5 h-3.5 text-amber-300" />
            <span>Planes</span>
          </button>
        </div>

        {/* Right: Super Admin switch pill & User Role & Sign Out */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {(isSuperAdmin || user?.isAnonymous) && (
            <button
              onClick={() => onNavigate('superadmin')}
              className="flex items-center gap-1 bg-amber-400 hover:bg-amber-300 text-stone-950 font-black px-1.5 sm:px-2 py-1 rounded-xl text-[10px] sm:text-xs shadow-md transition active:scale-95 shrink-0 border border-amber-500"
              title="Abrir Panel Master Super Administrador"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-stone-950" />
              <span className="hidden sm:inline">Panel Super Admin</span>
              <span className="sm:hidden text-[9px] font-bold">Admin</span>
              {pendingApprovalsCount > 0 && (
                <span className="bg-rose-600 text-white text-[8px] sm:text-[9px] px-1 py-0.2 rounded-full font-bold">
                  {pendingApprovalsCount}
                </span>
              )}
            </button>
          )}

          <div className="hidden md:flex flex-col text-right">
            <span className="text-xs font-medium text-white truncate max-w-[120px]">
              {user?.displayName || (user?.isAnonymous ? 'Modo Demo' : 'Tendero')}
            </span>
            <span className="text-[10px] text-emerald-300 capitalize">
              Rol: {currentRole === 'owner' ? 'Propietario' : currentRole === 'admin' ? 'Administrador' : 'Cajero'}
            </span>
          </div>

          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              className="p-1 sm:p-2 rounded-xl text-emerald-200 hover:text-white hover:bg-emerald-700 transition shrink-0"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4" />}
            </button>
          )}

          <button
            onClick={signOutUser}
            title="Cerrar sesión"
            className="p-1 sm:p-2 rounded-xl text-emerald-200 hover:text-white hover:bg-emerald-700 transition shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
