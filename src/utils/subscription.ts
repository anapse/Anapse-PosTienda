export const SERVICE_WHATSAPP_NUMBER = '+51 912391502';
export const SERVICE_WHATSAPP_CLEAN = '51912391502';
export const SUPER_ADMIN_EMAIL = 'elherreroanapse@gmail.com';

export interface CommercialPlan {
  id: 'tienda' | 'almacen' | 'comercial';
  name: string;
  badge?: string;
  priceCOP: number;
  maxProducts: number; // 500, 2000, or Infinity (e.g. 999999)
  productRangeLabel: string;
  shortDescription: string;
  features: string[];
  recommended?: boolean;
}

export const COMMERCIAL_PLANS: CommercialPlan[] = [
  {
    id: 'tienda',
    name: 'Plan Tienda',
    badge: 'Popular • Emprendedores',
    priceCOP: 40000,
    maxProducts: 500,
    productRangeLabel: 'Hasta 500 productos activos',
    shortDescription: 'Ideal para tiendas de barrio, minimarkets y pequeños comercios que inician su digitalización.',
    features: [
      'Hasta 500 productos activos en catálogo e inventario',
      'Punto de venta y caja rápida (PC y celular)',
      'Cobros con efectivo, Nequi, Daviplata y tarjetas',
      'Cuaderno de fiados digital y cobro por WhatsApp',
      'Control de inventario con alertas de stock mínimo',
      'Venta por peso en balanza y códigos de barras',
      'Catálogo online para recibir pedidos por WhatsApp',
      'Reportes de ventas diarias y ganancias',
      'Soporte técnico directo vía WhatsApp',
    ],
    recommended: true,
  },
  {
    id: 'almacen',
    name: 'Plan Almacén',
    badge: 'Mayor Capacidad',
    priceCOP: 60000,
    maxProducts: 2000,
    productRangeLabel: '501 – 2.000 productos activos',
    shortDescription: 'Más capacidad de catálogo y herramientas avanzadas de inventario para almacenes y minimarkets medianos.',
    features: [
      'De 501 hasta 2.000 productos activos',
      'Todas las funciones del Plan Tienda incluidas',
      'Herramientas avanzadas de inventario y Kardex detallado',
      'Importación masiva de productos por archivo CSV / Excel',
      'Gestión integral de proveedores y registro de compras',
      'Control de cajas y turnos de cajeros independientes',
      'Catálogo online con mayor volumen de productos',
      'Prioridad en soporte técnico vía WhatsApp',
    ],
  },
  {
    id: 'comercial',
    name: 'Plan Comercial',
    badge: 'Empresarial • Sin Límites',
    priceCOP: 90000,
    maxProducts: 999999,
    productRangeLabel: 'Más de 2.000 productos',
    shortDescription: 'Orientado a negocios con catálogos grandes, supermercados y necesidades de administración más avanzadas.',
    features: [
      'Más de 2.000 productos (Catálogo masivo sin límite)',
      'Todas las herramientas de venta, inventario y caja',
      'Administración multi-rol (Administrador, Dueño y Cajeros)',
      'Exportación avanzada de ventas y kardex para contabilidad',
      'Reportes financieros detallados y márgenes de ganancia',
      'Soporte preferencial dedicado con atención continua',
      'Actualizaciones y mejoras prioritarias del sistema',
    ],
  },
];

export const PLAN_MONTHLY_PRICE_COP = COMMERCIAL_PLANS[0].priceCOP; // Default $40.000 COP
export const PLAN_MAX_PRODUCTS = COMMERCIAL_PLANS[0].maxProducts; // Default 500

export const BUSINESS_TYPES = [
  'Tienda de barrio / Abarrotes',
  'Minimarket / Supermercado',
  'Panadería / Pastelería',
  'Carnicería / Charcutería',
  'Fruver (Frutas y Verduras)',
  'Droguería / Farmacia',
  'Papelería / Miscelánea',
  'Licorera / Cigarrería',
  'Restaurante / Comidas Rápidas',
  'Ferretería / Eléctricos',
  'Almacén de Ropa / Calzado',
  'Otro Comercio',
];

export function getDaysRemaining(expiresAt?: string | null): number {
  if (!expiresAt) return 0;
  const expDate = new Date(expiresAt).getTime();
  const now = new Date().getTime();
  const diffMs = expDate - now;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

export function isSubscriptionExpired(expiresAt?: string | null): boolean {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() <= new Date().getTime();
}

export function getPlanById(planId?: string): CommercialPlan {
  if (!planId) return COMMERCIAL_PLANS[0];
  const found = COMMERCIAL_PLANS.find(p => p.id === planId || p.name.toLowerCase().includes(planId.toLowerCase()));
  return found || COMMERCIAL_PLANS[0];
}

export function getWhatsAppActivationUrl(
  businessName: string, 
  businessType?: string, 
  contactName?: string,
  plan?: CommercialPlan
): string {
  const chosenPlan = plan || COMMERCIAL_PLANS[0];
  let msg = `Hola, cordial saludo. He registrado mi negocio en *Anapse PosTienda* y solicito la activación del servicio:\n\n`;
  msg += `📌 *Negocio:* ${businessName}\n`;
  if (businessType) msg += `🏢 *Tipo de comercio:* ${businessType}\n`;
  if (contactName) msg += `👤 *Propietario:* ${contactName}\n`;
  msg += `💎 *Plan seleccionado:* ${chosenPlan.name} ($ ${chosenPlan.priceCOP.toLocaleString('es-CO')} COP/mes - ${chosenPlan.productRangeLabel})\n\n`;
  msg += `Quedo atento a las instrucciones de pago para la activación. ¡Muchas gracias!`;

  return `https://wa.me/${SERVICE_WHATSAPP_CLEAN}?text=${encodeURIComponent(msg)}`;
}

export function getWhatsAppRenewalUrl(businessName: string, daysRemaining: number, planName?: string, planPrice?: number): string {
  const price = planPrice || 40000;
  const plan = planName || 'Plan Tienda';
  let msg = `Hola, deseo realizar la renovación de 30 días de suscripción en *Anapse PosTienda*:\n\n`;
  msg += `📌 *Negocio:* ${businessName}\n`;
  msg += `💎 *Plan:* ${plan}\n`;
  msg += `⏳ *Días restantes actuales:* ${daysRemaining} días\n`;
  msg += `💰 *Valor mensualidad:* $ ${price.toLocaleString('es-CO')} COP\n\n`;
  msg += `Por favor envíeme los medios de pago para registrar la extensión de 30 días de servicio. Gracias.`;

  return `https://wa.me/${SERVICE_WHATSAPP_CLEAN}?text=${encodeURIComponent(msg)}`;
}

export function getWhatsAppPlanChangeUrl(businessName: string, currentPlan: string, targetPlan: CommercialPlan): string {
  let msg = `Hola, deseo cambiar el plan de suscripción de mi negocio en *Anapse PosTienda*:\n\n`;
  msg += `📌 *Negocio:* ${businessName}\n`;
  msg += `🔄 *Plan actual:* ${currentPlan}\n`;
  msg += `✨ *Nuevo plan solicitado:* ${targetPlan.name} ($ ${targetPlan.priceCOP.toLocaleString('es-CO')} COP/mes - ${targetPlan.productRangeLabel})\n\n`;
  msg += `Por favor facilíteme las instrucciones para actualizar el cupo de productos de mi comercio. Gracias.`;

  return `https://wa.me/${SERVICE_WHATSAPP_CLEAN}?text=${encodeURIComponent(msg)}`;
}
