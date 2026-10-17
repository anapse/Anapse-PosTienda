export const SERVICE_WHATSAPP_NUMBER = '+51 912391502';
export const SERVICE_WHATSAPP_CLEAN = '51912391502';
export const PLAN_MONTHLY_PRICE_COP = 40000;
export const PLAN_MAX_PRODUCTS = 500;
export const SUPER_ADMIN_EMAIL = 'elherreroanapse@gmail.com';

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

export function getWhatsAppActivationUrl(businessName: string, businessType?: string, contactName?: string): string {
  let msg = `Hola, cordial saludo. He registrado mi negocio en *Anapse PosTienda* y solicito la activación del servicio:\n\n`;
  msg += `📌 *Negocio:* ${businessName}\n`;
  if (businessType) msg += `🏢 *Tipo de comercio:* ${businessType}\n`;
  if (contactName) msg += `👤 *Propietario:* ${contactName}\n`;
  msg += `💰 *Plan seleccionado:* Mensual ($ 40.000 COP - Hasta 500 productos)\n\n`;
  msg += `Quedo atento a las instrucciones de pago para la activación. ¡Muchas gracias!`;

  return `https://wa.me/${SERVICE_WHATSAPP_CLEAN}?text=${encodeURIComponent(msg)}`;
}

export function getWhatsAppRenewalUrl(businessName: string, daysRemaining: number): string {
  let msg = `Hola, deseo realizar la renovación de 30 días de suscripción en *Anapse PosTienda*:\n\n`;
  msg += `📌 *Negocio:* ${businessName}\n`;
  msg += `⏳ *Días restantes actuales:* ${daysRemaining} días\n`;
  msg += `💰 *Valor mensualidad:* $ 40.000 COP\n\n`;
  msg += `Por favor envíeme los medios de pago para registrar la extensión de 30 días. Gracias.`;

  return `https://wa.me/${SERVICE_WHATSAPP_CLEAN}?text=${encodeURIComponent(msg)}`;
}
