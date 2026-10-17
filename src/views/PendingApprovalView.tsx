import React, { useState } from 'react';
import { useAuth } from '../firebase/authContext';
import { 
  SERVICE_WHATSAPP_NUMBER, 
  SERVICE_WHATSAPP_CLEAN, 
  PLAN_MONTHLY_PRICE_COP, 
  PLAN_MAX_PRODUCTS, 
  getWhatsAppActivationUrl, 
  getWhatsAppRenewalUrl, 
  getDaysRemaining 
} from '../utils/subscription';
import { formatCOP } from '../utils/currency';
import { 
  Clock, 
  ShieldAlert, 
  Smartphone, 
  RefreshCw, 
  LogOut, 
  Store, 
  CheckCircle2, 
  Lock 
} from 'lucide-react';

export const PendingApprovalView: React.FC = () => {
  const { currentBusiness, refreshBusiness, signOutUser } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isPending = currentBusiness?.status === 'PENDING';
  const isSuspended = currentBusiness?.status === 'SUSPENDED';

  const days = getDaysRemaining(currentBusiness?.subscriptionExpiresAt);

  const activationUrl = currentBusiness
    ? getWhatsAppActivationUrl(
        currentBusiness.name,
        currentBusiness.businessType,
        currentBusiness.merchantContactName
      )
    : `https://wa.me/${SERVICE_WHATSAPP_CLEAN}`;

  const renewalUrl = currentBusiness
    ? getWhatsAppRenewalUrl(currentBusiness.name, days)
    : `https://wa.me/${SERVICE_WHATSAPP_CLEAN}`;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshBusiness();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col justify-between p-4 sm:p-6 font-sans">
      
      {/* Top Header */}
      <header className="max-w-2xl mx-auto w-full flex items-center justify-between py-2">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-amber-400 text-emerald-950 flex items-center justify-center font-black text-xl shadow-sm">
            A
          </div>
          <div>
            <span className="font-extrabold text-stone-900 text-base">Anapse PosTienda</span>
            <span className="text-[10px] bg-amber-400 text-emerald-950 font-black px-1.5 py-0.5 rounded ml-1.5 uppercase">
              Colombia
            </span>
          </div>
        </div>

        <button
          onClick={signOutUser}
          className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 transition font-medium"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Cerrar Sesión</span>
        </button>
      </header>

      {/* Main Card */}
      <main className="max-w-xl mx-auto w-full my-auto py-6">
        <div className="bg-white rounded-3xl border border-stone-200 p-6 sm:p-8 shadow-xl space-y-6 text-center">
          
          {/* Status Icon */}
          <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center shadow-inner">
            {isPending ? (
              <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <Clock className="w-8 h-8 animate-pulse" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center">
                <Lock className="w-8 h-8" />
              </div>
            )}
          </div>

          {/* Heading */}
          <div>
            <span className={`inline-block text-[11px] font-black px-3 py-1 rounded-full uppercase mb-2 ${
              isPending ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
            }`}>
              {isPending ? 'Solicitud en Revisión' : 'Servicio Suspendido'}
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
              {isPending
                ? 'Tu tienda está en proceso de pre-aprobación'
                : 'Período de servicio concluido o suspendido'}
            </h1>
            <p className="text-xs sm:text-sm text-stone-600 mt-2 leading-relaxed">
              {isPending
                ? 'Para garantizar la seguridad de la plataforma, cada cuenta debe ser activada por el Administrador General antes de comenzar a operar.'
                : 'El ciclo de 30 días ha finalizado o tu cuenta requiere renovación. Comunícate para reactivar tu tienda al instante.'}
            </p>
          </div>

          {/* Business Details Box */}
          {currentBusiness && (
            <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200 text-left space-y-2 text-xs">
              <div className="flex justify-between pb-1 border-b border-stone-200">
                <span className="text-stone-500">Comercio Solicitado:</span>
                <span className="font-bold text-stone-900">{currentBusiness.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Tipo de Negocio:</span>
                <span className="font-bold text-stone-800">{currentBusiness.businessType || 'Comercio General'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Tarifa Plan Mensual:</span>
                <span className="font-black text-emerald-700">{formatCOP(PLAN_MONTHLY_PRICE_COP)} / mes</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Capacidad Máxima:</span>
                <span className="font-semibold text-stone-700">Hasta {PLAN_MAX_PRODUCTS} productos</span>
              </div>
            </div>
          )}

          {/* Action WhatsApp Button */}
          <div className="space-y-3 pt-2">
            <a
              href={isPending ? activationUrl : renewalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold py-3.5 px-6 rounded-2xl shadow-lg transition active:scale-98 text-sm sm:text-base"
            >
              <Smartphone className="w-5 h-5 text-emerald-300" />
              <span>Contactar por WhatsApp ({SERVICE_WHATSAPP_NUMBER})</span>
            </a>

            <p className="text-[11px] text-stone-400">
              * Número oficial para activación y pagos: <strong>{SERVICE_WHATSAPP_NUMBER}</strong> (Solo WhatsApp).
            </p>
          </div>

          {/* Check Status Button */}
          <div className="pt-2 border-t border-stone-100 flex items-center justify-center">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 text-xs font-bold text-stone-600 hover:text-emerald-700 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-700' : ''}`} />
              <span>{isRefreshing ? 'Consultando autorización...' : 'Actualizar estado de aprobación'}</span>
            </button>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-stone-400 py-2">
        Anapse PosTienda Colombia • Soporte de activaciones vía WhatsApp {SERVICE_WHATSAPP_NUMBER}
      </footer>

    </div>
  );
};
