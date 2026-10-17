/**
 * Formato de moneda para Colombia (Pesos Colombianos - COP)
 * Ejemplo: $ 25.000, $ 1.250.000
 */
export function formatCOP(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '$ 0';
  }
  
  // En Colombia usualmente se usa punto como separador de miles y sin centavos para transacciones minoristas
  const rounded = Math.round(amount);
  const formatted = new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(rounded);

  return `$ ${formatted}`;
}

/**
 * Formato de cantidades numéricas (soporte de decimales para peso en balanza, ej. 1,5 kg)
 */
export function formatQuantity(qty: number, allowDecimals: boolean = false): string {
  if (qty === undefined || qty === null || isNaN(qty)) return '0';
  if (!allowDecimals || Number.isInteger(qty)) {
    return qty.toString();
  }
  return qty.toLocaleString('es-CO', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 3,
  });
}
