import React from 'react';
import { useAuth } from '../firebase/authContext';
import { getDaysRemaining, isSubscriptionExpired, getWhatsAppRenewalUrl, SERVICE_WHATSAPP_NUMBER } from '../utils/subscription';
import { Clock, AlertTriangle, Smartphone } from 'lucide-react';

export const SubscriptionBanner: React.FC = () => {
  const { currentBusiness, isSuperAdmin } = useAuth();

  if (!currentBusiness || isSuperAdmin) return null;

  const days = getDaysRemaining(currentBusiness.subscriptionExpiresAt);
  const isExpired = isSubscriptionExpired(currentBusiness.subscriptionExpiresAt);

  const renewalUrl = getWhatsAppRenewalUrl(currentBusiness.name, days);

  return (
    <div className={`py-2 px-4 rounded-xl mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs border ${
      isExpired || days <= 3
        ? 'bg-rose-50 border-rose-300 text-rose-900'
        : days <= 7
        ? 'bg-amber-50 border-amber-300 text-amber-900'
        : 'bg-emerald-50 border-emerald-200 text-emerald-900'
    } print:hidden`}>
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 flex-shrink-0" />
        <div>
          <span className="font-bold">
            Plan Mensual ($ 40.000 COP / mes • Hasta 500 productos):
          </span>
          <span className="ml-1">
            {isExpired
              ? 'Tu período de 30 días ha vencido.'
              : `Te quedan ${days} días de servicio activo.`}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[11px] text-stone-500 hidden md:inline">
          Soporte: {SERVICE_WHATSAPP_NUMBER}
        </span>
        <a
          href={renewalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-3 py-1 rounded-lg text-xs shadow-2xs transition active:scale-95 whitespace-nowrap"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Renovar por WhatsApp</span>
        </a>
      </div>
    </div>
  );
};
