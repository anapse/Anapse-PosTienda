import React from 'react';
import { useAuth } from '../firebase/authContext';
import { Store, CircleDollarSign, UserCheck, LogOut, Menu, PlusCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { formatCOP } from '../utils/currency';

interface NavbarProps {
  onToggleSidebar: () => void;
  onNavigate: (view: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar, onNavigate }) => {
  const { user, currentBusiness, businesses, currentRole, activeShift, selectBusiness, signOutUser, isSuperAdmin } = useAuth();

  return (
    <header className="bg-emerald-800 text-white shadow-md sticky top-0 z-40 print:hidden">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Left: Mobile hamburger & Brand */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="md:hidden p-2 rounded-lg text-emerald-100 hover:text-white hover:bg-emerald-700 focus:outline-none"
            aria-label="Abrir menú"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div 
            onClick={() => onNavigate('dashboard')}
            className="flex items-center gap-2 cursor-pointer select-none group"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-400 text-emerald-950 flex items-center justify-center font-black text-xl shadow-sm group-hover:scale-105 transition-transform">
              A
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-lg tracking-tight">Anapse PosTienda</span>
                <span className="text-[10px] bg-amber-400 text-emerald-950 font-bold px-1.5 py-0.5 rounded tracking-wide uppercase">
                  Colombia
                </span>
              </div>
              <p className="text-[11px] text-emerald-200 hidden sm:block truncate max-w-[200px]">
                {currentBusiness?.name || 'Mi Comercio'}
              </p>
            </div>
          </div>
        </div>

        {/* Center: Store Selector & Active Shift Indicator */}
        <div className="flex items-center gap-3">
          {/* Store switcher */}
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
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition active:scale-95 ${
              activeShift
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400'
                : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/50'
            }`}
          >
            <CircleDollarSign className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {activeShift ? `Caja Abierta (${formatCOP(activeShift.initialCash)})` : 'Caja Cerrada'}
            </span>
            <span className="sm:hidden">
              {activeShift ? 'Caja OK' : 'Abrir Caja'}
            </span>
          </button>

          {/* Quick POS Button */}
          <button
            onClick={() => onNavigate('pos')}
            className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-emerald-950 font-bold px-3 py-1.5 rounded-xl text-xs sm:text-sm shadow-sm transition active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Vender</span>
          </button>
        </div>

        {/* Right: User Role & Sign Out */}
        <div className="flex items-center gap-2">
          {isSuperAdmin && (
            <button
              onClick={() => onNavigate('superadmin')}
              className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-emerald-950 font-black px-2.5 py-1.5 rounded-xl text-xs shadow-sm transition active:scale-95"
              title="Panel de Super Administrador (Aprobaciones y Contador de 30 Días)"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Panel Admin</span>
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

          <button
            onClick={signOutUser}
            title="Cerrar sesión"
            className="p-2 rounded-xl text-emerald-200 hover:text-white hover:bg-emerald-700 transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
