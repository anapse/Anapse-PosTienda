import React, { useState } from 'react';
import { 
  COMMERCIAL_PLANS, 
  CommercialPlan, 
  SERVICE_WHATSAPP_NUMBER, 
  getDaysRemaining, 
  getWhatsAppPlanChangeUrl, 
  getWhatsAppRenewalUrl 
} from '../utils/subscription';
import { useAuth } from '../firebase/authContext';
import { formatCOP } from '../utils/currency';
import { 
  Check, 
  ShieldCheck, 
  Smartphone, 
  Boxes, 
  Calendar, 
  ArrowRight, 
  Clock, 
  AlertTriangle,
  Zap,
  Info,
  Layers,
  HelpCircle
} from 'lucide-react';

interface PlansServicesViewProps {
  onNavigate?: (view: string) => void;
}

export const PlansServicesView: React.FC<PlansServicesViewProps> = ({ onNavigate }) => {
  const { currentBusiness, isSuperAdmin } = useAuth();
  const [billingCycle, setBillingCycle] = useState<'monthly'>('monthly');

  const daysRemaining = getDaysRemaining(currentBusiness?.subscriptionExpiresAt);
  const currentPlanName = currentBusiness?.planName || 'Plan Tienda';
  const currentMaxProducts = currentBusiness?.maxProducts || 500;

  return (
    <div className="space-y-8 pb-12 max-w-6xl mx-auto">
      
      {/* Top Banner / Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-stone-900 via-stone-850 to-stone-900 text-white rounded-3xl p-6 sm:p-10 border border-stone-800 shadow-xl">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-900/60 border border-emerald-600/50 text-emerald-300 text-xs font-bold uppercase tracking-wider">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Planes y Servicios Comerciales</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
            Planes adaptados al tamaño de tu catálogo en Colombia 🇨🇴
          </h1>
          <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
            Los límites de productos se definen y gestionan directamente en la aplicación según tus necesidades operativas. Todos los planes incluyen caja rápida POS, fiados digitales por WhatsApp, inventario, ventas y catálogo en línea.
          </p>

          {/* Current subscription quick status */}
          {currentBusiness && (
            <div className="pt-2 flex flex-wrap items-center gap-3 text-xs">
              <div className="bg-stone-800/90 border border-stone-700 px-3.5 py-2 rounded-xl flex items-center gap-2">
                <span className="text-stone-400">Plan Actual:</span>
                <span className="font-extrabold text-amber-400">{currentPlanName}</span>
                <span className="text-stone-400">({currentMaxProducts} productos)</span>
              </div>

              <div className="bg-stone-800/90 border border-stone-700 px-3.5 py-2 rounded-xl flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-stone-400">Vigencia:</span>
                <span className={`font-extrabold ${daysRemaining <= 5 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {daysRemaining} días de servicio
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Background decorative glow */}
        <div className="absolute right-0 top-0 -mt-10 -mr-10 w-80 h-80 rounded-full bg-emerald-600/10 blur-3xl pointer-events-none" />
      </div>

      {/* Pricing Cards Grid */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200 pb-3">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-stone-900">
              Selecciona el Plan Ideal para tu Negocio
            </h2>
            <p className="text-xs text-stone-500">
              Tarifas mensuales transparentes en Pesos Colombianos (COP) sin comisiones ocultas por venta.
            </p>
          </div>
          <div className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl self-start sm:self-auto">
            Suscripción mensual • Renovable cada 30 días
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {COMMERCIAL_PLANS.map((plan: CommercialPlan) => {
            const isCurrentPlan = currentBusiness && (
              (currentBusiness.planId && currentBusiness.planId === plan.id) ||
              (currentBusiness.maxProducts === plan.maxProducts)
            );

            const whatsappChangeUrl = currentBusiness 
              ? getWhatsAppPlanChangeUrl(currentBusiness.name, currentPlanName, plan)
              : `https://wa.me/51912391502?text=${encodeURIComponent(`Hola, me interesa contratar el ${plan.name} ($ ${plan.priceCOP.toLocaleString('es-CO')} COP/mes) en Anapse PosTienda.`)}`;

            return (
              <div 
                key={plan.id}
                className={`relative bg-white rounded-3xl p-6 sm:p-7 flex flex-col justify-between border transition-all duration-200 ${
                  plan.recommended 
                    ? 'border-2 border-emerald-600 shadow-xl shadow-emerald-950/5 ring-4 ring-emerald-600/10' 
                    : 'border-stone-200 shadow-md hover:border-stone-300'
                }`}
              >
                {/* Plan Badge */}
                {plan.badge && (
                  <div className="absolute -top-3.5 left-6">
                    <span className={`inline-block text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-xs ${
                      plan.recommended 
                        ? 'bg-emerald-700 text-white' 
                        : 'bg-stone-800 text-amber-300'
                    }`}>
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div className="space-y-4 pt-1">
                  {/* Plan Name & Scope */}
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-black text-stone-900">{plan.name}</h3>
                      {isCurrentPlan && (
                        <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md">
                          ACTIVO
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-500 mt-1 min-h-[32px]">
                      {plan.shortDescription}
                    </p>
                  </div>

                  {/* Product limit highlight box */}
                  <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200/80 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-400 text-emerald-950 flex items-center justify-center font-bold">
                      <Boxes className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-stone-400 block leading-tight">
                        Capacidad de Catálogo
                      </span>
                      <span className="text-xs sm:text-sm font-black text-stone-900">
                        {plan.productRangeLabel}
                      </span>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="pt-2 border-t border-stone-100">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl sm:text-4xl font-black text-stone-900">
                        {formatCOP(plan.priceCOP)}
                      </span>
                      <span className="text-xs text-stone-500 font-semibold">/ mes</span>
                    </div>
                    <p className="text-[11px] text-stone-400 mt-0.5">
                      Ciclos continuos de 30 días de servicio
                    </p>
                  </div>

                  {/* Features list */}
                  <div className="pt-2">
                    <p className="text-[11px] font-extrabold uppercase tracking-wider text-stone-400 mb-2.5">
                      ¿Qué incluye este plan?
                    </p>
                    <ul className="space-y-2 text-xs text-stone-700">
                      {plan.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <div className="mt-0.5 w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                          <span className="leading-tight">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Bottom CTA */}
                <div className="pt-6 mt-6 border-t border-stone-100">
                  <a
                    href={whatsappChangeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition active:scale-98 shadow-xs ${
                      isCurrentPlan
                        ? 'bg-stone-100 hover:bg-stone-200 text-stone-800'
                        : plan.recommended
                        ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                        : 'bg-stone-900 hover:bg-stone-800 text-white'
                    }`}
                  >
                    <Smartphone className="w-4 h-4 text-emerald-400" />
                    <span>
                      {isCurrentPlan ? 'Renovar / Consultar Plan' : `Solicitar ${plan.name}`}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 opacity-70" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Comparison table */}
      <div className="bg-white rounded-3xl border border-stone-200 p-6 sm:p-8 shadow-xs space-y-5">
        <div>
          <h3 className="text-base sm:text-lg font-black text-stone-900">
            Comparativa Rápida de Servicios y Capacidades
          </h3>
          <p className="text-xs text-stone-500">
            Todos los planes gozan de la robustez completa del software Anapse PosTienda. La diferencia principal radica en el volumen de catálogo de productos que administra tu negocio.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50 text-stone-700 font-extrabold uppercase">
                <th className="p-3">Característica</th>
                <th className="p-3 text-center">Plan Tienda ($40.000)</th>
                <th className="p-3 text-center">Plan Almacén ($60.000)</th>
                <th className="p-3 text-center">Plan Comercial ($90.000)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              <tr>
                <td className="p-3 font-bold text-stone-800">Límite de Productos Activos</td>
                <td className="p-3 text-center font-bold text-emerald-700">Hasta 500</td>
                <td className="p-3 text-center font-bold text-amber-700">501 a 2.000</td>
                <td className="p-3 text-center font-bold text-purple-700">+2.000 (Sin límite)</td>
              </tr>
              <tr>
                <td className="p-3 font-medium text-stone-700">Punto de Venta (POS) y Caja Rápida</td>
                <td className="p-3 text-center text-emerald-600 font-bold">✓ Ilimitado</td>
                <td className="p-3 text-center text-emerald-600 font-bold">✓ Ilimitado</td>
                <td className="p-3 text-center text-emerald-600 font-bold">✓ Ilimitado</td>
              </tr>
              <tr>
                <td className="p-3 font-medium text-stone-700">Cuaderno de Fiados y Cobro WhatsApp</td>
                <td className="p-3 text-center text-emerald-600 font-bold">✓ Incluido</td>
                <td className="p-3 text-center text-emerald-600 font-bold">✓ Incluido</td>
                <td className="p-3 text-center text-emerald-600 font-bold">✓ Incluido</td>
              </tr>
              <tr>
                <td className="p-3 font-medium text-stone-700">Ventas por Peso (Balanza) y Códigos de Barra</td>
                <td className="p-3 text-center text-emerald-600 font-bold">✓ Incluido</td>
                <td className="p-3 text-center text-emerald-600 font-bold">✓ Incluido</td>
                <td className="p-3 text-center text-emerald-600 font-bold">✓ Incluido</td>
              </tr>
              <tr>
                <td className="p-3 font-medium text-stone-700">Catálogo Digital Online para Clientes</td>
                <td className="p-3 text-center text-emerald-600 font-bold">✓ Incluido</td>
                <td className="p-3 text-center text-emerald-600 font-bold">✓ Incluido</td>
                <td className="p-3 text-center text-emerald-600 font-bold">✓ Incluido</td>
              </tr>
              <tr>
                <td className="p-3 font-medium text-stone-700">Importación Masiva CSV / Excel</td>
                <td className="p-3 text-center text-stone-600">Hasta 500 ítems</td>
                <td className="p-3 text-center text-amber-700 font-bold">Hasta 2.000 ítems</td>
                <td className="p-3 text-center text-purple-700 font-bold">Sin límite</td>
              </tr>
              <tr>
                <td className="p-3 font-medium text-stone-700">Gestión de Proveedores y Kardex Avanzado</td>
                <td className="p-3 text-center text-emerald-600 font-bold">✓ Incluido</td>
                <td className="p-3 text-center text-emerald-600 font-bold">✓ Herramientas Pro</td>
                <td className="p-3 text-center text-emerald-600 font-bold">✓ Completo / Auditoría</td>
              </tr>
              <tr>
                <td className="p-3 font-medium text-stone-700">Soporte Técnico Especializado</td>
                <td className="p-3 text-center text-stone-600">WhatsApp Oficial</td>
                <td className="p-3 text-center text-amber-700 font-bold">WhatsApp Prioritario</td>
                <td className="p-3 text-center text-purple-700 font-bold">Atención Preferencial</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Services and Support Block */}
      <div className="bg-stone-900 text-white rounded-3xl p-6 sm:p-8 border border-stone-800 shadow-md">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div className="md:col-span-2 space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs text-amber-400 font-bold">
              <ShieldCheck className="w-4 h-4" />
              <span>Atención Comercial y Pagos</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black">
              ¿Deseas activar tu tienda o ampliar tu capacidad de catálogo?
            </h3>
            <p className="text-xs text-stone-300 leading-relaxed">
              Comunícate directamente a nuestra línea oficial de soporte y activación. Atendemos solicitudes de activación por 30 días, extensiones de servicio, pagos y cambio de plan.
            </p>
          </div>

          <div className="text-left md:text-right space-y-2">
            <span className="text-[11px] uppercase tracking-wider text-stone-400 block">Línea Oficial de Soporte</span>
            <a
              href={`https://wa.me/51912391502?text=${encodeURIComponent('Hola, cordial saludo. Me comunico desde Anapse PosTienda para consultar sobre la activación y planes comerciales.')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-5 py-3 rounded-2xl shadow-lg transition active:scale-95 text-xs sm:text-sm"
            >
              <Smartphone className="w-4 h-4" />
              <span>WhatsApp: {SERVICE_WHATSAPP_NUMBER}</span>
            </a>
            <p className="text-[10px] text-stone-400">Atención exclusiva vía WhatsApp</p>
          </div>
        </div>
      </div>

      {/* FAQ Block */}
      <div className="bg-white rounded-3xl border border-stone-200 p-6 sm:p-8 space-y-4 shadow-xs">
        <h3 className="text-base font-black text-stone-900 flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-emerald-700" />
          <span>Preguntas Frecuentes sobre los Planes</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/70 space-y-1">
            <p className="font-extrabold text-stone-900">¿Cómo funcionan los 30 días de servicio?</p>
            <p className="text-stone-600">
              Cada activación o renovación añade 30 días de vigencia continua al comercio. Un contador en la barra superior te avisará con anticipación cuando se acerque la fecha de vencimiento.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/70 space-y-1">
            <p className="font-extrabold text-stone-900">¿Qué ocurre si llego al límite de productos?</p>
            <p className="text-stone-600">
              El sistema te informará de manera amigable que alcanzaste el tope de tu plan actual y te permitirá solicitar la ampliación al Plan Almacén o Comercial sin perder ningún dato.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/70 space-y-1">
            <p className="font-extrabold text-stone-900">¿Puedo cambiar de plan en cualquier momento?</p>
            <p className="text-stone-600">
              Sí. Puedes subir de plan cuando tu inventario lo requiera. El administrador ajustará tu cupo de productos de forma inmediata tras coordinar el pago.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/70 space-y-1">
            <p className="font-extrabold text-stone-900">¿Cómo se activan las cuentas registradas?</p>
            <p className="text-stone-600">
              Al registrarse, tu tienda entra en estado de pre-aprobación. El Administrador verifica la solicitud y la activa para iniciar los 30 días de servicio oficial.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
};
