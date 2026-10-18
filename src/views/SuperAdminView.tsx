import React, { useState, useMemo } from 'react';
import { useAuth } from '../firebase/authContext';
import { Business, BusinessStatus } from '../types';
import { formatCOP } from '../utils/currency';
import { formatColombianDate } from '../utils/date';
import { 
  getDaysRemaining, 
  SERVICE_WHATSAPP_NUMBER, 
  SERVICE_WHATSAPP_CLEAN, 
  COMMERCIAL_PLANS,
  CommercialPlan,
  BUSINESS_TYPES,
  getPlanById
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
  Search,
  Boxes,
  Zap,
  DollarSign,
  TrendingUp,
  Users,
  Edit3,
  X,
  Send,
  Building2,
  FileText,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

interface SuperAdminViewProps {
  onNavigate?: (view: string) => void;
}

export const SuperAdminView: React.FC<SuperAdminViewProps> = ({ onNavigate }) => {
  const { 
    allBusinesses, 
    approveBusiness, 
    suspendBusiness, 
    reactivateBusiness, 
    extendSubscription, 
    setCustomSubscriptionExpiration,
    updateBusinessByAdmin,
    createBusinessByAdmin,
    deleteBusiness,
    changeBusinessPlan,
    selectBusiness,
    user
  } = useAuth();

  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterPlan, setFilterPlan] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Modals state
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null);
  const [suspendingBusiness, setSuspendingBusiness] = useState<Business | null>(null);
  const [suspensionReasonInput, setSuspensionReasonInput] = useState('Mora en el pago de la mensualidad');
  const [showNewStoreModal, setShowNewStoreModal] = useState(false);

  // Quick statistics calculation
  const stats = useMemo(() => {
    const total = allBusinesses.length;
    const pending = allBusinesses.filter(b => b.status === 'PENDING');
    const active = allBusinesses.filter(b => b.status === 'ACTIVE');
    const suspended = allBusinesses.filter(b => b.status === 'SUSPENDED');
    
    // Comercios activos que vencen en los próximos 7 días
    const expiringSoon = active.filter(b => {
      const days = getDaysRemaining(b.subscriptionExpiresAt);
      return days >= 0 && days <= 7;
    });

    // Ingresos Mensuales Recurrentes (MRR) en COP
    const mrr = active.reduce((sum, b) => {
      const price = b.planPrice !== undefined ? b.planPrice : 40000;
      return sum + price;
    }, 0);

    // Ingresos Anuales Estimados (ARR)
    const arr = mrr * 12;

    // ARPU (Ingreso promedio por cliente activo)
    const arpu = active.length > 0 ? Math.round(mrr / active.length) : 0;

    // Breakdown por plan
    const planCounts = {
      tienda: allBusinesses.filter(b => (b.planId || 'tienda') === 'tienda').length,
      almacen: allBusinesses.filter(b => b.planId === 'almacen').length,
      comercial: allBusinesses.filter(b => b.planId === 'comercial').length,
    };

    // Ciudades principales
    const cityMap: Record<string, number> = {};
    allBusinesses.forEach(b => {
      const city = b.city?.trim() || 'No especificada';
      cityMap[city] = (cityMap[city] || 0) + 1;
    });

    return {
      total,
      pendingCount: pending.length,
      activeCount: active.length,
      suspendedCount: suspended.length,
      expiringSoonCount: expiringSoon.length,
      mrr,
      arr,
      arpu,
      planCounts,
      cityMap,
    };
  }, [allBusinesses]);

  // Filtered list
  const filtered = useMemo(() => {
    return allBusinesses.filter(b => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = 
        !q ||
        b.name?.toLowerCase().includes(q) ||
        b.phone?.includes(q) ||
        b.whatsapp?.includes(q) ||
        b.nit?.toLowerCase().includes(q) ||
        b.businessType?.toLowerCase().includes(q) ||
        b.merchantContactName?.toLowerCase().includes(q) ||
        b.city?.toLowerCase().includes(q);

      let matchStatus = true;
      if (filterStatus === 'PENDING') matchStatus = b.status === 'PENDING';
      else if (filterStatus === 'ACTIVE') matchStatus = b.status === 'ACTIVE';
      else if (filterStatus === 'SUSPENDED') matchStatus = b.status === 'SUSPENDED';
      else if (filterStatus === 'EXPIRING_SOON') {
        const days = getDaysRemaining(b.subscriptionExpiresAt);
        matchStatus = b.status === 'ACTIVE' && days >= 0 && days <= 7;
      }

      let matchPlan = true;
      if (filterPlan !== 'ALL') {
        matchPlan = (b.planId || 'tienda') === filterPlan;
      }

      return matchSearch && matchStatus && matchPlan;
    });
  }, [allBusinesses, searchQuery, filterStatus, filterPlan]);

  // Handler for quick 30-day approval
  const handleApprove = async (b: Business) => {
    setActionLoadingId(b.id);
    try {
      await approveBusiness(b.id, 30);
      alert(`¡Tienda "${b.name}" aprobada exitosamente y activada por 30 días!`);
    } catch (e: any) {
      alert('Error al aprobar: ' + e.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handler for quick +30 days extension
  const handleExtendDays = async (b: Business, days: number = 30) => {
    setActionLoadingId(b.id);
    try {
      await extendSubscription(b.id, days);
    } catch (e: any) {
      alert('Error al extender suscripción: ' + e.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Confirm and apply suspension
  const handleConfirmSuspend = async () => {
    if (!suspendingBusiness) return;
    setActionLoadingId(suspendingBusiness.id);
    try {
      await suspendBusiness(suspendingBusiness.id, suspensionReasonInput);
      setSuspendingBusiness(null);
      setSuspensionReasonInput('Mora en el pago de la mensualidad');
    } catch (e: any) {
      alert('Error al suspender: ' + e.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handler for reactivation
  const handleReactivate = async (b: Business) => {
    setActionLoadingId(b.id);
    try {
      await reactivateBusiness(b.id);
    } catch (e: any) {
      alert('Error al reactivar: ' + e.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handler for permanent deletion
  const handleDelete = async (b: Business) => {
    if (!window.confirm(`¿Seguro que deseas eliminar permanentemente el comercio "${b.name}"?\nEsta acción borrará la cuenta y sus registros.`)) return;
    setActionLoadingId(b.id);
    try {
      await deleteBusiness(b.id);
    } catch (e: any) {
      alert('Error al eliminar: ' + e.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Open WhatsApp with smart templates
  const handleOpenWhatsApp = (b: Business, template: 'cobro' | 'bienvenida' | 'suspension' | 'custom' = 'custom') => {
    const raw = b.whatsapp || b.phone || '';
    const clean = raw.replace(/\D/g, '');
    if (!clean) {
      alert('Este comercio no tiene número de teléfono registrado.');
      return;
    }
    const target = clean.startsWith('57') || clean.startsWith('51') ? clean : `57${clean}`;
    const contact = b.merchantContactName || b.name;
    const days = getDaysRemaining(b.subscriptionExpiresAt);

    let msg = '';
    if (template === 'cobro') {
      msg = `Hola ${contact}, te saludamos de Anapse PosTienda. Te recordamos que la suscripción de tu negocio "${b.name}" vence en ${days} días. Para continuar disfrutando del sistema de ventas, caja y catálogo online, puedes renovar tu plan mensual de ${formatCOP(b.planPrice || 40000)} vía Nequi / Daviplata al ${SERVICE_WHATSAPP_NUMBER}. ¡Muchas gracias!`;
    } else if (template === 'bienvenida') {
      msg = `¡Hola ${contact}! Bienvenido a Anapse PosTienda Colombia. Tu negocio "${b.name}" ha sido aprobado y activado con 30 días de servicio completo. Ya puedes ingresar con tu correo para empezar a vender y llevar tu inventario.`;
    } else if (template === 'suspension') {
      msg = `Estimado(a) ${contact}, te contactamos de Anapse PosTienda. El acceso a tu cuenta "${b.name}" se encuentra temporalmente suspendido por: ${b.suspensionReason || 'Mensualidad vencida'}. Por favor comunícate con nosotros para reactivar tu servicio al instante.`;
    } else {
      msg = `Hola ${contact}, te saludamos de Anapse PosTienda Colombia respecto a tu tienda "${b.name}"...`;
    }

    window.open(`https://wa.me/${target}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="space-y-6 pb-16">
      
      {/* Top Banner & Context Header */}
      <div className="bg-stone-900 text-white rounded-3xl p-5 sm:p-7 shadow-xl border border-stone-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400 text-stone-950 font-black text-xs uppercase tracking-wide mb-3 shadow-sm">
              <ShieldCheck className="w-4 h-4" />
              <span>Panel Maestro • Super Administrador</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">
              Gestión Global de Comercios y Facturación
            </h1>
            <p className="text-xs sm:text-sm text-stone-300 mt-1 max-w-2xl leading-relaxed">
              Supervisión de clientes, control de 30 días de prueba, suspensión/reactivación de cuentas, edición de planes comerciales y cobranzas en Colombia.
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
            <button
              onClick={() => setShowNewStoreModal(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-2xl shadow-lg transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Tienda</span>
            </button>

            {onNavigate && (
              <button
                onClick={() => onNavigate('pos')}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-stone-800 hover:bg-stone-700 text-amber-300 border border-amber-400/40 text-xs sm:text-sm font-bold px-4 py-2.5 rounded-2xl shadow-sm transition active:scale-95"
                title="Ir al Punto de Venta para operar como cajero/tendero"
              >
                <Store className="w-4 h-4" />
                <span>Ir al POS (Tienda)</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Financial & Operational KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* MRR Card */}
        <div className="bg-gradient-to-br from-emerald-900 to-emerald-950 p-4 sm:p-5 rounded-2xl border border-emerald-700/60 shadow-md text-white">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold text-emerald-300 uppercase tracking-wider">
              MRR Mensual
            </span>
            <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
          </div>
          <p className="text-xl sm:text-3xl font-black text-amber-300 mt-2">
            {formatCOP(stats.mrr)}
          </p>
          <p className="text-[10px] sm:text-xs text-emerald-300/80 mt-1">
            ARR Anual: {formatCOP(stats.arr)}
          </p>
        </div>

        {/* Tiendas Activas */}
        <div 
          onClick={() => setFilterStatus('ACTIVE')}
          className="bg-white dark:bg-stone-900 p-4 sm:p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs cursor-pointer hover:border-emerald-500 transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
              Tiendas Activas
            </span>
            <CheckCircle className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition" />
          </div>
          <p className="text-xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-400 mt-2">
            {stats.activeCount}
          </p>
          <p className="text-[10px] sm:text-xs text-stone-400 mt-1">
            Ticket prom: {formatCOP(stats.arpu)}/mes
          </p>
        </div>

        {/* Por Aprobar */}
        <div 
          onClick={() => setFilterStatus('PENDING')}
          className={`p-4 sm:p-5 rounded-2xl border shadow-xs cursor-pointer transition group ${
            stats.pendingCount > 0 
              ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700/60' 
              : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider">
              Por Aprobar
            </span>
            <Clock className={`w-4 h-4 text-amber-600 ${stats.pendingCount > 0 ? 'animate-pulse' : ''}`} />
          </div>
          <p className="text-xl sm:text-3xl font-black text-amber-700 dark:text-amber-400 mt-2">
            {stats.pendingCount}
          </p>
          <p className="text-[10px] sm:text-xs text-amber-800/80 dark:text-amber-400/80 mt-1">
            {stats.pendingCount > 0 ? '¡Requieren activación!' : 'Sin solicitudes pendientes'}
          </p>
        </div>

        {/* Suspendidas o Por Vencer */}
        <div 
          onClick={() => setFilterStatus(stats.expiringSoonCount > 0 ? 'EXPIRING_SOON' : 'SUSPENDED')}
          className="bg-white dark:bg-stone-900 p-4 sm:p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs cursor-pointer hover:border-rose-400 transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider">
              Atención Cobranza
            </span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-xl sm:text-3xl font-black text-rose-600 dark:text-rose-400">
              {stats.suspendedCount}
            </span>
            <span className="text-xs text-stone-400">susp.</span>
            {stats.expiringSoonCount > 0 && (
              <span className="text-xs bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold ml-auto">
                {stats.expiringSoonCount} por vencer
              </span>
            )}
          </div>
          <p className="text-[10px] sm:text-xs text-stone-400 mt-1 truncate">
            {stats.expiringSoonCount} vencen en ≤ 7 días
          </p>
        </div>
      </div>

      {/* Plan Breakdown & Cities Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Plans Distribution Card */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 sm:p-5 border border-stone-200 dark:border-stone-800 shadow-xs">
          <span className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider block mb-3">
            Distribución por Plan Comercial
          </span>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-emerald-700 dark:text-emerald-400">Plan Tienda ($40.000 COP)</span>
                <span className="text-stone-900 dark:text-white font-mono">{stats.planCounts.tienda} comercios</span>
              </div>
              <div className="w-full h-2 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-600 rounded-full" 
                  style={{ width: `${stats.total ? (stats.planCounts.tienda / stats.total) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-amber-600 dark:text-amber-400">Plan Almacén ($60.000 COP)</span>
                <span className="text-stone-900 dark:text-white font-mono">{stats.planCounts.almacen} comercios</span>
              </div>
              <div className="w-full h-2 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-amber-500 rounded-full" 
                  style={{ width: `${stats.total ? (stats.planCounts.almacen / stats.total) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-purple-600 dark:text-purple-400">Plan Comercial ($90.000 COP)</span>
                <span className="text-stone-900 dark:text-white font-mono">{stats.planCounts.comercial} comercios</span>
              </div>
              <div className="w-full h-2 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-purple-500 rounded-full" 
                  style={{ width: `${stats.total ? (stats.planCounts.comercial / stats.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Coverage & Cities Card */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 sm:p-5 border border-stone-200 dark:border-stone-800 shadow-xs">
          <span className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider block mb-3">
            Cobertura por Ciudades (Colombia)
          </span>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(stats.cityMap).map(([city, count]) => (
              <span 
                key={city}
                className="inline-flex items-center gap-1.5 bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 text-xs px-2.5 py-1 rounded-xl font-medium"
              >
                <span>{city}</span>
                <span className="bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300 text-[10px] px-1.5 py-0.2 rounded-md font-bold">
                  {count}
                </span>
              </span>
            ))}
          </div>
        </div>

        {/* Quick Admin Actions Card */}
        <div className="bg-stone-900 text-white rounded-2xl p-4 sm:p-5 border border-stone-800 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block mb-1">
              Soporte y Cobranza WhatsApp
            </span>
            <p className="text-xs text-stone-300">
              Línea oficial de activación: <strong className="text-white">{SERVICE_WHATSAPP_NUMBER}</strong>
            </p>
          </div>
          <div className="pt-3 border-t border-stone-800 space-y-1.5 text-xs text-stone-400">
            <p>• Los clientes aprobados reciben 30 días de prueba gratuita.</p>
            <p>• Puedes suspender o reactivar cuentas en tiempo real sin reiniciar el servidor.</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 border border-stone-200 dark:border-stone-800 shadow-xs flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar por comercio, contacto, teléfono, NIT, ciudad o tipo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-white rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'ALL', label: `Todos (${stats.total})` },
            { id: 'PENDING', label: `Por Aprobar (${stats.pendingCount})`, highlight: stats.pendingCount > 0 },
            { id: 'ACTIVE', label: `Activos (${stats.activeCount})` },
            { id: 'EXPIRING_SOON', label: `Por Vencer ≤7d (${stats.expiringSoonCount})` },
            { id: 'SUSPENDED', label: `Suspendidos (${stats.suspendedCount})` },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                filterStatus === tab.id
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : tab.highlight
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 hover:bg-amber-200'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Plan Filter */}
        <select
          value={filterPlan}
          onChange={(e) => setFilterPlan(e.target.value)}
          className="bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 text-xs rounded-xl px-3 py-2 font-bold focus:outline-none"
        >
          <option value="ALL">Todos los Planes</option>
          <option value="tienda">Plan Tienda ($40k)</option>
          <option value="almacen">Plan Almacén ($60k)</option>
          <option value="comercial">Plan Comercial ($90k)</option>
        </select>
      </div>

      {/* Main Businesses Table */}
      <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-stone-400">
            <Store className="w-12 h-12 mx-auto text-stone-300 dark:text-stone-700 mb-3" />
            <p className="font-bold text-stone-700 dark:text-stone-300 text-base">No se encontraron comercios</p>
            <p className="text-xs text-stone-400 mt-1">Prueba con otros términos de búsqueda o cambia los filtros de estado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-stone-50 dark:bg-stone-850 border-b border-stone-200 dark:border-stone-800 text-stone-500 dark:text-stone-400 text-[11px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-4">Comercio / Propietario</th>
                  <th className="p-4">Tipo & Ubicación</th>
                  <th className="p-4">Plan & Límite</th>
                  <th className="p-4 text-center">Estado de Cuenta</th>
                  <th className="p-4 text-center">Vigencia (Días)</th>
                  <th className="p-4 text-right">Gestión Administrativa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {filtered.map(b => {
                  const days = getDaysRemaining(b.subscriptionExpiresAt);
                  const isPending = b.status === 'PENDING';
                  const isActive = b.status === 'ACTIVE';
                  const isSuspended = b.status === 'SUSPENDED';
                  const isLoading = actionLoadingId === b.id;

                  return (
                    <tr 
                      key={b.id} 
                      className={`hover:bg-stone-50 dark:hover:bg-stone-800/50 transition ${
                        isPending ? 'bg-amber-50/50 dark:bg-amber-950/20' : 
                        isSuspended ? 'bg-rose-50/30 dark:bg-rose-950/20' : ''
                      }`}
                    >
                      {/* Store & Owner Info */}
                      <td className="p-4">
                        <div className="flex items-start gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-amber-400/20 text-amber-950 dark:text-amber-300 font-black flex items-center justify-center shrink-0 border border-amber-400/30">
                            {b.name?.[0]?.toUpperCase() || 'T'}
                          </div>
                          <div>
                            <p className="font-extrabold text-stone-900 dark:text-white text-sm">
                              {b.name}
                            </p>
                            <p className="text-xs text-stone-600 dark:text-stone-400 font-medium">
                              {b.merchantContactName || 'Propietario no registrado'}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              {b.phone ? (
                                <button
                                  onClick={() => handleOpenWhatsApp(b, isPending ? 'bienvenida' : isSuspended ? 'suspension' : days <= 7 ? 'cobro' : 'custom')}
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
                                  title="Abrir chat de WhatsApp con plantilla personalizada"
                                >
                                  <Smartphone className="w-3 h-3" />
                                  <span>{b.phone}</span>
                                </button>
                              ) : (
                                <span className="text-[10px] text-stone-400">Sin teléfono</span>
                              )}
                              <span className="text-[10px] text-stone-400">NIT: {b.nit || 'Sin NIT'}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Business Type & City */}
                      <td className="p-4">
                        <p className="font-semibold text-stone-800 dark:text-stone-200">
                          {b.businessType || 'Comercio General'}
                        </p>
                        <p className="text-xs text-stone-500 dark:text-stone-400">
                          {b.city || 'Colombia'} {b.address ? `• ${b.address}` : ''}
                        </p>
                        <span className="text-[10px] text-stone-400 block mt-0.5">
                          Reg: {formatColombianDate(b.requestedAt || b.createdAt, false)}
                        </span>
                      </td>

                      {/* Plan & Pricing */}
                      <td className="p-4">
                        <div className="space-y-1">
                          <span className={`inline-block px-2 py-0.5 rounded-lg text-xs font-bold ${
                            b.planId === 'comercial' ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300' :
                            b.planId === 'almacen' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                            'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          }`}>
                            {b.planName || 'Plan Tienda'}
                          </span>
                          <p className="text-xs font-mono font-bold text-stone-700 dark:text-stone-300">
                            {formatCOP(b.planPrice || 40000)}/mes
                          </p>
                          <span className="text-[10px] text-stone-400 block">
                            Límite: {b.maxProducts && b.maxProducts > 2000 ? '+2.000 prod.' : `${b.maxProducts || 500} prod.`}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="p-4 text-center">
                        <span className={`inline-block font-black text-[11px] px-2.5 py-1 rounded-full ${
                          isPending ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300' :
                          isActive ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300' :
                          'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300'
                        }`}>
                          {isPending ? 'POR APROBAR' : isActive ? 'ACTIVA' : 'SUSPENDIDA'}
                        </span>
                        {isSuspended && b.suspensionReason && (
                          <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-1 max-w-[140px] mx-auto truncate" title={b.suspensionReason}>
                            Motivo: {b.suspensionReason}
                          </p>
                        )}
                      </td>

                      {/* Expiration and Days Remaining */}
                      <td className="p-4 text-center">
                        {isPending ? (
                          <span className="text-xs text-stone-400">En espera de activación</span>
                        ) : (
                          <div>
                            <span className={`inline-block font-black text-sm ${
                              days === 0 ? 'text-rose-600' : 
                              days <= 7 ? 'text-amber-600' : 
                              'text-emerald-700 dark:text-emerald-400'
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

                      {/* Administrative Actions */}
                      <td className="p-4 text-right whitespace-nowrap space-x-1.5">
                        
                        {/* 1. Edit / Manage Account Modal button */}
                        <button
                          onClick={() => setEditingBusiness(b)}
                          className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-xl text-xs font-bold transition inline-flex items-center gap-1 shadow-2xs"
                          title="Editar cuenta completa, suscripción, días y motivos"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-stone-600 dark:text-stone-300" />
                          <span>Editar Cuenta</span>
                        </button>

                        {/* 2. Approve if pending */}
                        {isPending && (
                          <button
                            onClick={() => handleApprove(b)}
                            disabled={isLoading}
                            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition"
                          >
                            Aprobar 30d
                          </button>
                        )}

                        {/* 3. Quick +30 Days extension */}
                        {isActive && (
                          <button
                            onClick={() => handleExtendDays(b, 30)}
                            disabled={isLoading}
                            className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-2xs active:scale-95 transition"
                            title="Añadir +30 días de suscripción"
                          >
                            +30d
                          </button>
                        )}

                        {/* 4. Suspend Button */}
                        {isActive && (
                          <button
                            onClick={() => setSuspendingBusiness(b)}
                            disabled={isLoading}
                            className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                            title="Suspender cuenta"
                          >
                            <Lock className="w-4 h-4" />
                          </button>
                        )}

                        {/* 5. Reactivate Button */}
                        {isSuspended && (
                          <button
                            onClick={() => handleReactivate(b)}
                            disabled={isLoading}
                            className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition active:scale-95"
                            title="Reactivar cuenta"
                          >
                            Reactivar
                          </button>
                        )}

                        {/* 6. Delete Button */}
                        <button
                          onClick={() => handleDelete(b)}
                          disabled={isLoading}
                          className="p-1.5 text-stone-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                          title="Eliminar registro permanentemente"
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

      {/* MODAL 1: EDIT STORE ACCOUNT & SUSPENSION DETAILS */}
      {editingBusiness && (
        <EditBusinessModal
          business={editingBusiness}
          onClose={() => setEditingBusiness(null)}
          onSave={async (updatedData) => {
            await updateBusinessByAdmin(editingBusiness.id, updatedData);
            setEditingBusiness(null);
          }}
          onSuspend={async (reason) => {
            await suspendBusiness(editingBusiness.id, reason);
            setEditingBusiness(null);
          }}
          onReactivate={async () => {
            await reactivateBusiness(editingBusiness.id);
            setEditingBusiness(null);
          }}
          onExtendDays={async (days) => {
            await extendSubscription(editingBusiness.id, days);
          }}
        />
      )}

      {/* MODAL 2: SUSPEND STORE WITH REASON */}
      {suspendingBusiness && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-stone-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-200 dark:border-stone-800 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-stone-900 dark:text-white text-base">
                  Suspender Servicio de Tienda
                </h3>
                <p className="text-xs text-stone-500">
                  {suspendingBusiness.name}
                </p>
              </div>
            </div>

            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
              Al suspender la cuenta, el usuario no podrá acceder al punto de venta ni al inventario hasta que regularice su situación.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                Motivo de la suspensión:
              </label>
              <select
                value={suspensionReasonInput}
                onChange={(e) => setSuspensionReasonInput(e.target.value)}
                className="w-full text-xs bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl p-2.5 font-medium text-stone-900 dark:text-white focus:outline-none"
              >
                <option value="Mora en el pago de la mensualidad">Mora en el pago de la mensualidad</option>
                <option value="Comprobante de pago rechazado o no verificado">Comprobante de pago rechazado o no verificado</option>
                <option value="Periodo de 30 días de prueba finalizado">Periodo de 30 días de prueba finalizado</option>
                <option value="Solicitado voluntariamente por el comerciante">Solicitado voluntariamente por el comerciante</option>
                <option value="Revisión administrativa por seguridad">Revisión administrativa por seguridad</option>
                <option value="Incumplimiento de términos y condiciones">Incumplimiento de términos y condiciones</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSuspendingBusiness(null)}
                className="px-4 py-2 text-xs font-bold text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmSuspend}
                disabled={actionLoadingId === suspendingBusiness.id}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md transition"
              >
                Confirmar Suspensión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CREATE NEW STORE DIRECTLY BY ADMIN */}
      {showNewStoreModal && (
        <NewStoreAdminModal
          onClose={() => setShowNewStoreModal(false)}
          onCreate={async (newStoreData) => {
            await createBusinessByAdmin(newStoreData);
            setShowNewStoreModal(false);
          }}
        />
      )}

    </div>
  );
};

// -------------------------------------------------------------
// SUB-COMPONENT: EDIT BUSINESS MODAL
// -------------------------------------------------------------
interface EditBusinessModalProps {
  business: Business;
  onClose: () => void;
  onSave: (data: Partial<Business>) => Promise<void>;
  onSuspend: (reason: string) => Promise<void>;
  onReactivate: () => Promise<void>;
  onExtendDays: (days: number) => Promise<void>;
}

const EditBusinessModal: React.FC<EditBusinessModalProps> = ({
  business,
  onClose,
  onSave,
  onSuspend,
  onReactivate,
  onExtendDays
}) => {
  const [name, setName] = useState(business.name || '');
  const [merchantContactName, setMerchantContactName] = useState(business.merchantContactName || '');
  const [phone, setPhone] = useState(business.phone || '');
  const [whatsapp, setWhatsapp] = useState(business.whatsapp || business.phone || '');
  const [nit, setNit] = useState(business.nit || '');
  const [city, setCity] = useState(business.city || 'Bogotá');
  const [address, setAddress] = useState(business.address || '');
  const [businessType, setBusinessType] = useState(business.businessType || 'Tienda de barrio / Abarrotes');
  const [status, setStatus] = useState<BusinessStatus>(business.status || 'ACTIVE');
  const [suspensionReason, setSuspensionReason] = useState(business.suspensionReason || '');
  const [planId, setPlanId] = useState(business.planId || 'tienda');
  const [planPrice, setPlanPrice] = useState<number>(business.planPrice || 40000);
  const [maxProducts, setMaxProducts] = useState<number>(business.maxProducts || 500);
  const [adminNotes, setAdminNotes] = useState(business.adminNotes || '');
  
  // Expiration Date calculation
  const defaultIso = business.subscriptionExpiresAt 
    ? new Date(business.subscriptionExpiresAt).toISOString().split('T')[0]
    : new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  const [expirationDate, setExpirationDate] = useState(defaultIso);
  const [isSaving, setIsSaving] = useState(false);

  const handlePlanSelect = (pid: string) => {
    setPlanId(pid);
    const plan = getPlanById(pid);
    setPlanPrice(plan.priceCOP);
    setMaxProducts(plan.maxProducts);
  };

  const handleQuickAddDays = (days: number) => {
    const current = expirationDate ? new Date(expirationDate).getTime() : Date.now();
    const newDate = new Date(current + days * 86400000).toISOString().split('T')[0];
    setExpirationDate(newDate);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const plan = getPlanById(planId);
      const expiresAtIso = new Date(`${expirationDate}T23:59:59Z`).toISOString();

      await onSave({
        name: name.trim(),
        merchantContactName: merchantContactName.trim(),
        phone: phone.trim(),
        whatsapp: whatsapp.trim(),
        nit: nit.trim(),
        city: city.trim(),
        address: address.trim(),
        businessType: businessType || 'Tienda de barrio / Abarrotes',
        status: (status as BusinessStatus) || (business.status as BusinessStatus) || 'ACTIVE',
        suspensionReason: status === 'SUSPENDED' ? (suspensionReason || 'Mora en pago de mensualidad') : '',
        planId: plan.id,
        planName: plan.name,
        planPrice: Number(planPrice) || plan.priceCOP,
        maxProducts: Number(maxProducts) || plan.maxProducts,
        subscriptionExpiresAt: expiresAtIso,
        adminNotes: adminNotes.trim(),
      });
    } catch (err: any) {
      alert('Error al guardar: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white dark:bg-stone-900 rounded-3xl max-w-2xl w-full p-5 sm:p-7 shadow-2xl border border-stone-200 dark:border-stone-800 space-y-5 my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400 text-stone-950 font-black flex items-center justify-center shadow-sm">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-stone-900 dark:text-white">
                Editar Cuenta de Comercio
              </h2>
              <p className="text-xs text-stone-400">
                ID: <span className="font-mono">{business.id}</span>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Section 1: Business Details */}
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block mb-2">
              1. Datos del Comercio y Propietario
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">Nombre de la Tienda:</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl p-2.5 font-bold text-stone-900 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">Nombre del Propietario / Contacto:</label>
                <input
                  type="text"
                  value={merchantContactName}
                  onChange={(e) => setMerchantContactName(e.target.value)}
                  className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl p-2.5 font-bold text-stone-900 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">Teléfono Móvil:</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ej: 3101234567"
                  className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl p-2.5 text-stone-900 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">WhatsApp para Notificaciones:</label>
                <input
                  type="text"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="Ej: 573101234567"
                  className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl p-2.5 text-stone-900 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">NIT / Cédula:</label>
                <input
                  type="text"
                  value={nit}
                  onChange={(e) => setNit(e.target.value)}
                  className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl p-2.5 text-stone-900 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">Ciudad:</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl p-2.5 text-stone-900 dark:text-white focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">Tipo de Negocio:</label>
                <select
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl p-2.5 text-stone-900 dark:text-white focus:outline-none font-medium"
                >
                  {BUSINESS_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Subscription & Suspension Control */}
          <div className="pt-2 border-t border-stone-100 dark:border-stone-800">
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 block mb-2">
              2. Control de Estado, Suspensión y Vigencia
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              
              {/* Account Status */}
              <div>
                <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">Estado de la Cuenta:</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as BusinessStatus)}
                  className={`w-full border rounded-xl p-2.5 font-black focus:outline-none ${
                    status === 'ACTIVE' ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-400' :
                    status === 'SUSPENDED' ? 'bg-rose-50 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border-rose-400' :
                    'bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-400'
                  }`}
                >
                  <option value="ACTIVE">ACTIVA (Servicio Operativo)</option>
                  <option value="SUSPENDED">SUSPENDIDA (Bloqueada por Mora/Revisión)</option>
                  <option value="PENDING">PENDIENTE (Por Aprobar)</option>
                  <option value="REJECTED">RECHAZADA</option>
                </select>
              </div>

              {/* Commercial Plan */}
              <div>
                <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">Plan Comercial:</label>
                <select
                  value={planId}
                  onChange={(e) => handlePlanSelect(e.target.value)}
                  className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl p-2.5 text-stone-900 dark:text-white font-bold focus:outline-none"
                >
                  <option value="tienda">Plan Tienda ($40.000 - 500 prod.)</option>
                  <option value="almacen">Plan Almacén ($60.000 - 2.000 prod.)</option>
                  <option value="comercial">Plan Comercial ($90.000 - Ilimitado)</option>
                </select>
              </div>

              {/* Suspension Reason (Only if SUSPENDED) */}
              {status === 'SUSPENDED' && (
                <div className="sm:col-span-2 bg-rose-50 dark:bg-rose-950/40 p-3 rounded-2xl border border-rose-200 dark:border-rose-800 space-y-1.5">
                  <label className="font-bold text-rose-800 dark:text-rose-300 block">Motivo de la Suspensión (Visible para el cliente):</label>
                  <input
                    type="text"
                    value={suspensionReason}
                    onChange={(e) => setSuspensionReason(e.target.value)}
                    placeholder="Ej: Mensualidad vencida. Comuníquese para renovar."
                    className="w-full bg-white dark:bg-stone-900 border border-rose-300 dark:border-rose-700 rounded-xl p-2 text-stone-900 dark:text-white font-medium focus:outline-none"
                  />
                  <div className="flex flex-wrap gap-1 pt-1">
                    {[
                      'Mora en pago de mensualidad',
                      'Comprobante Nequi/Daviplata rechazado',
                      'Periodo de prueba finalizado',
                      'A petición del cliente',
                    ].map(reason => (
                      <button
                        type="button"
                        key={reason}
                        onClick={() => setSuspensionReason(reason)}
                        className="text-[10px] bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-200 px-2 py-0.5 rounded-lg font-medium"
                      >
                        {reason}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Custom Plan Price in COP & Max Products */}
              <div>
                <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">Precio Mensual Acordado (COP):</label>
                <input
                  type="number"
                  value={planPrice}
                  onChange={(e) => setPlanPrice(Number(e.target.value))}
                  className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl p-2.5 font-mono font-bold text-stone-900 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">Límite de Productos Activos:</label>
                <input
                  type="number"
                  value={maxProducts}
                  onChange={(e) => setMaxProducts(Number(e.target.value))}
                  className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl p-2.5 font-mono font-bold text-stone-900 dark:text-white focus:outline-none"
                />
              </div>

              {/* Expiration Date with quick add buttons */}
              <div className="sm:col-span-2 bg-stone-50 dark:bg-stone-850 p-3.5 rounded-2xl border border-stone-200 dark:border-stone-700 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-stone-800 dark:text-stone-200">
                    Fecha Exacta de Vencimiento de Suscripción:
                  </label>
                  <span className="text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-400">
                    {getDaysRemaining(new Date(expirationDate).toISOString())} días restantes
                  </span>
                </div>
                
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <input
                    type="date"
                    required
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                    className="w-full sm:w-auto flex-1 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-600 rounded-xl p-2 text-stone-900 dark:text-white font-bold focus:outline-none"
                  />

                  {/* Quick Extension Buttons */}
                  <div className="flex items-center gap-1">
                    {[
                      { label: '+7d', days: 7 },
                      { label: '+15d', days: 15 },
                      { label: '+30d', days: 30 },
                      { label: '+60d', days: 60 },
                      { label: '+1 año', days: 365 },
                    ].map(btn => (
                      <button
                        type="button"
                        key={btn.label}
                        onClick={() => handleQuickAddDays(btn.days)}
                        className="px-2.5 py-1.5 bg-stone-200 dark:bg-stone-700 hover:bg-emerald-600 hover:text-white text-stone-800 dark:text-stone-200 rounded-xl text-xs font-bold transition"
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Section 3: Admin Notes */}
          <div className="pt-2 border-t border-stone-100 dark:border-stone-800">
            <span className="text-[11px] font-black uppercase tracking-wider text-stone-500 dark:text-stone-400 block mb-2">
              3. Notas Privadas del Super Administrador
            </span>
            <textarea
              rows={2}
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Registro de pagos Nequi/Daviplata, acuerdos especiales, llamadas de seguimiento..."
              className="w-full text-xs bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl p-2.5 text-stone-900 dark:text-white focus:outline-none"
            />
          </div>

          {/* Actions Footer */}
          <div className="pt-4 border-t border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {status === 'ACTIVE' ? (
                <button
                  type="button"
                  onClick={() => setStatus('SUSPENDED')}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Suspender Cuenta</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setStatus('ACTIVE');
                    setSuspensionReason('');
                  }}
                  className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Reactivar Cuenta</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 text-xs font-black bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl shadow-md transition active:scale-95"
              >
                {isSaving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};

// -------------------------------------------------------------
// SUB-COMPONENT: CREATE NEW STORE MODAL (ADMIN)
// -------------------------------------------------------------
interface NewStoreAdminModalProps {
  onClose: () => void;
  onCreate: (data: Partial<Business>) => Promise<void>;
}

const NewStoreAdminModal: React.FC<NewStoreAdminModalProps> = ({ onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [nit, setNit] = useState('');
  const [city, setCity] = useState('Bogotá');
  const [address, setAddress] = useState('');
  const [businessType, setBusinessType] = useState('Tienda de barrio / Abarrotes');
  const [planId, setPlanId] = useState('tienda');
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const plan = getPlanById(planId);
      const expiresAt = new Date(Date.now() + days * 86400000).toISOString();

      await onCreate({
        name,
        merchantContactName: contactName,
        phone,
        whatsapp: phone.startsWith('57') || phone.startsWith('51') ? phone : `57${phone}`,
        nit: nit || 'Sin NIT',
        city,
        address,
        businessType,
        planId: plan.id,
        planName: plan.name,
        planPrice: plan.priceCOP,
        maxProducts: plan.maxProducts,
        status: 'ACTIVE',
        subscriptionExpiresAt: expiresAt,
        adminNotes: `Creado manualmente por Super Admin con ${days} días iniciales.`,
      });
    } catch (err: any) {
      alert('Error al crear tienda: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-stone-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 dark:border-stone-800 space-y-4">
        <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white font-black flex items-center justify-center">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-stone-900 dark:text-white">
                Registrar Nueva Tienda (Admin)
              </h2>
              <p className="text-xs text-stone-400">Creación directa y activación inmediata</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-stone-400 hover:text-stone-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">Nombre del Comercio:</label>
            <input
              type="text"
              required
              placeholder="Ej: Minimarket La Esperanza"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl p-2.5 text-stone-900 dark:text-white font-bold focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">Propietario / Contacto:</label>
              <input
                type="text"
                placeholder="Nombre del tendero"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl p-2.5 text-stone-900 dark:text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">Teléfono / WhatsApp:</label>
              <input
                type="text"
                placeholder="Ej: 3101234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl p-2.5 text-stone-900 dark:text-white focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">Ciudad:</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl p-2.5 text-stone-900 dark:text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">NIT / Cédula:</label>
              <input
                type="text"
                placeholder="Opcional"
                value={nit}
                onChange={(e) => setNit(e.target.value)}
                className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl p-2.5 text-stone-900 dark:text-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">Tipo de Negocio:</label>
            <select
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl p-2.5 text-stone-900 dark:text-white font-medium focus:outline-none"
            >
              {BUSINESS_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">Plan Inicial:</label>
              <select
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
                className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl p-2.5 text-stone-900 dark:text-white font-bold focus:outline-none"
              >
                <option value="tienda">Plan Tienda ($40k)</option>
                <option value="almacen">Plan Almacén ($60k)</option>
                <option value="comercial">Plan Comercial ($90k)</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">Días de Servicio Inicial:</label>
              <select
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl p-2.5 text-stone-900 dark:text-white font-bold focus:outline-none"
              >
                <option value={15}>15 días</option>
                <option value={30}>30 días (1 Mes)</option>
                <option value={60}>60 días (2 Meses)</option>
                <option value={90}>90 días (3 Meses)</option>
                <option value={365}>365 días (1 Año)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-stone-500 font-bold hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-black rounded-xl shadow-md transition"
            >
              {loading ? 'Creando...' : 'Crear y Activar Tienda'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
