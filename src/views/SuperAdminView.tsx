import React, { useState } from 'react';
import { useAuth } from '../firebase/authContext';
import { Business } from '../types';
import { formatCOP } from '../utils/currency';
import { formatColombianDate } from '../utils/date';
import { 
  getDaysRemaining, 
  SERVICE_WHATSAPP_NUMBER, 
  SERVICE_WHATSAPP_CLEAN, 
  PLAN_MONTHLY_PRICE_COP, 
  PLAN_MAX_PRODUCTS 
} from '../utils/subscription';
import { 
  ShieldCheck, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Smartphone, 
  Store, 
  Trash2, 
  RefreshCw, 
  Plus, 
  Calendar,
  Lock,
  Unlock,
  Search
} from 'lucide-react';

export const SuperAdminView: React.FC = () => {
  const { allBusinesses, approveBusiness, suspendBusiness, reactivateBusiness, extendSubscription, deleteBusiness } = useAuth();

  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const pendingStores = allBusinesses.filter(b => b.status === 'PENDING');
  const activeStores = allBusinesses.filter(b => b.status === 'ACTIVE');
  const suspendedStores = allBusinesses.filter(b => b.status === 'SUSPENDED');

  const filtered = allBusinesses.filter(b => {
    const q = searchQuery.toLowerCase();
    const matchSearch = 
      b.name.toLowerCase().includes(q) ||
      (b.phone && b.phone.includes(q)) ||
      (b.businessType && b.businessType.toLowerCase().includes(q)) ||
      (b.merchantContactName && b.merchantContactName.toLowerCase().includes(q)) ||
      (b.city && b.city.toLowerCase().includes(q));

    const matchStatus = filterStatus === 'ALL' || b.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const handleApprove = async (b: Business) => {
    setActionLoadingId(b.id);
    try {
      await approveBusiness(b.id, 30);
      alert(`¡Tienda "${b.name}" aprobada y activada por 30 días!`);
    } catch (e: any) {
      alert('Error al aprobar: ' + e.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleExtend30Days = async (b: Business) => {
    setActionLoadingId(b.id);
    try {
      await extendSubscription(b.id, 30);
      alert(`¡Se añadieron +30 días de servicio a "${b.name}"!`);
    } catch (e: any) {
      alert('Error al extender suscripción: ' + e.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSuspend = async (b: Business) => {
    if (!window.confirm(`¿Seguro que deseas suspender el servicio de "${b.name}"?`)) return;
    setActionLoadingId(b.id);
    try {
      await suspendBusiness(b.id);
      alert(`Tienda "${b.name}" suspendida.`);
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReactivate = async (b: Business) => {
    setActionLoadingId(b.id);
    try {
      await reactivateBusiness(b.id);
      alert(`Tienda "${b.name}" reactivada.`);
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (b: Business) => {
    if (!window.confirm(`¿Eliminar permanentemente la tienda o petición de "${b.name}"?`)) return;
    setActionLoadingId(b.id);
    try {
      await deleteBusiness(b.id);
      alert(`Tienda eliminada.`);
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleOpenWhatsApp = (phone: string, name: string) => {
    const clean = phone.replace(/\D/g, '');
    const target = clean.startsWith('57') || clean.startsWith('51') ? clean : `57${clean}`;
    const msg = `Hola ${name}, te saludamos de Anapse PosTienda. Nos comunicamos respecto a tu solicitud de activación de tienda...`;
    window.open(`https://wa.me/${target}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-stone-900 text-white rounded-2xl p-6 shadow-md border border-stone-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-amber-400 text-emerald-950 font-black text-xs uppercase mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Panel de Super Administrador</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Gestión de Activaciones y Clientes
            </h1>
            <p className="text-xs text-stone-400 mt-1">
              Pre-aprobación de solicitudes, control de los 30 días de servicio y soporte WhatsApp ({SERVICE_WHATSAPP_NUMBER}).
            </p>
          </div>

          <div className="bg-stone-800 p-3.5 rounded-xl border border-stone-700 text-right text-xs">
            <span className="text-stone-400 block">Tarifa Oficial Establecida:</span>
            <span className="text-base font-black text-amber-400">$ 40.000 COP / mes</span>
            <span className="text-[11px] text-stone-300 block">Hasta 500 productos por tienda</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-amber-50 p-4 rounded-2xl border border-amber-300 shadow-xs">
          <span className="text-xs font-bold text-amber-800 uppercase">Pendientes de Aprobación</span>
          <p className="text-2xl sm:text-3xl font-black text-amber-700 mt-1">{pendingStores.length}</p>
          <p className="text-[11px] text-amber-900 mt-1">Solicitudes por revisar y activar</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-xs font-bold text-emerald-800 uppercase">Tiendas Activas</span>
          <p className="text-2xl sm:text-3xl font-black text-emerald-700 mt-1">{activeStores.length}</p>
          <p className="text-[11px] text-stone-500 mt-1">Con servicio vigente</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-xs font-bold text-rose-800 uppercase">Suspendidas / Expiradas</span>
          <p className="text-2xl sm:text-3xl font-black text-rose-600 mt-1">{suspendedStores.length}</p>
          <p className="text-[11px] text-stone-500 mt-1">Pendientes de pago o renovación</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-xs font-bold text-stone-600 uppercase">Total Solicitudes</span>
          <p className="text-2xl sm:text-3xl font-black text-stone-900 mt-1">{allBusinesses.length}</p>
          <p className="text-[11px] text-stone-400 mt-1">Base general de comercios</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar por nombre de negocio, tipo, teléfono o contacto..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: 'ALL', label: `Todos (${allBusinesses.length})` },
            { id: 'PENDING', label: `Por Aprobar (${pendingStores.length})` },
            { id: 'ACTIVE', label: `Activos (${activeStores.length})` },
            { id: 'SUSPENDED', label: `Suspendidos (${suspendedStores.length})` },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                filterStatus === tab.id
                  ? 'bg-emerald-700 text-white'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Requests & Stores Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-stone-400">
            <Store className="w-10 h-10 mx-auto text-stone-300 mb-2" />
            <p className="font-semibold text-stone-600">No hay tiendas en esta categoría.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 text-xs font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3.5">Comercio</th>
                  <th className="p-3.5">Tipo de Negocio</th>
                  <th className="p-3.5">Contacto / WhatsApp</th>
                  <th className="p-3.5 text-center">Estado</th>
                  <th className="p-3.5 text-center">Contador 30 Días</th>
                  <th className="p-3.5 text-right">Acciones de Activación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filtered.map(b => {
                  const days = getDaysRemaining(b.subscriptionExpiresAt);
                  const isPending = b.status === 'PENDING';
                  const isActive = b.status === 'ACTIVE';
                  const isSuspended = b.status === 'SUSPENDED';
                  const isLoading = actionLoadingId === b.id;

                  return (
                    <tr key={b.id} className={`hover:bg-stone-50 transition ${isPending ? 'bg-amber-50/40' : ''}`}>
                      <td className="p-3.5">
                        <p className="font-bold text-stone-900">{b.name}</p>
                        <p className="text-[11px] text-stone-400">
                          {b.city || 'Colombia'} {b.address ? `• ${b.address}` : ''}
                        </p>
                        <p className="text-[10px] text-stone-400">
                          Solicitado: {formatColombianDate(b.requestedAt || b.createdAt)}
                        </p>
                      </td>

                      <td className="p-3.5">
                        <span className="font-semibold text-stone-800">
                          {b.businessType || 'Comercio General'}
                        </span>
                      </td>

                      <td className="p-3.5">
                        <p className="font-medium text-stone-900">{b.merchantContactName || 'Propietario'}</p>
                        {b.phone ? (
                          <button
                            onClick={() => handleOpenWhatsApp(b.phone, b.merchantContactName || b.name)}
                            className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 font-bold text-xs mt-0.5"
                          >
                            <Smartphone className="w-3.5 h-3.5" />
                            <span>{b.phone}</span>
                          </button>
                        ) : (
                          <span className="text-stone-400 text-xs">Sin teléfono</span>
                        )}
                      </td>

                      <td className="p-3.5 text-center">
                        <span className={`inline-block font-black text-[11px] px-2.5 py-1 rounded-full ${
                          isPending ? 'bg-amber-100 text-amber-800' :
                          isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'
                        }`}>
                          {isPending ? 'POR APROBAR' : isActive ? 'ACTIVO' : 'SUSPENDIDO'}
                        </span>
                      </td>

                      <td className="p-3.5 text-center">
                        {isPending ? (
                          <span className="text-xs text-stone-400">En espera</span>
                        ) : (
                          <div>
                            <span className={`inline-block font-black text-sm ${
                              days === 0 ? 'text-rose-600' : days <= 5 ? 'text-amber-600' : 'text-emerald-700'
                            }`}>
                              {days} días
                            </span>
                            {b.subscriptionExpiresAt && (
                              <p className="text-[10px] text-stone-400">
                                Vence: {formatColombianDate(b.subscriptionExpiresAt, false)}
                              </p>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="p-3.5 text-right whitespace-nowrap space-x-1.5">
                        {isPending && (
                          <button
                            onClick={() => handleApprove(b)}
                            disabled={isLoading}
                            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition"
                          >
                            Aprobar (30 Días)
                          </button>
                        )}

                        {isActive && (
                          <>
                            <button
                              onClick={() => handleExtend30Days(b)}
                              disabled={isLoading}
                              className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-2xs active:scale-95 transition"
                              title="Añadir 30 días de suscripción"
                            >
                              +30 Días
                            </button>
                            <button
                              onClick={() => handleSuspend(b)}
                              disabled={isLoading}
                              className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title="Suspender tienda"
                            >
                              <Lock className="w-4 h-4" />
                            </button>
                          </>
                        )}

                        {isSuspended && (
                          <button
                            onClick={() => handleReactivate(b)}
                            disabled={isLoading}
                            className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition"
                            title="Reactivar tienda"
                          >
                            Reactivar
                          </button>
                        )}

                        <button
                          onClick={() => handleDelete(b)}
                          disabled={isLoading}
                          className="p-1.5 text-stone-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Eliminar registro"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
