import React from 'react';
import { Sale, Business } from '../types';
import { formatCOP } from '../utils/currency';
import { formatColombianDate } from '../utils/date';
import { Printer, Share2, X, CheckCircle, Smartphone } from 'lucide-react';

interface ReceiptModalProps {
  sale: Sale;
  business: Business;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ sale, business, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  const handleShareWhatsApp = () => {
    const phone = sale.customerPhone ? sale.customerPhone.replace(/\D/g, '') : '';
    const cleanPhone = phone.startsWith('57') ? phone : `57${phone}`;

    let msg = `*COMPROBANTE DE COMPRA - ${business.name}*\n`;
    msg += `NIT: ${business.nit}\n`;
    msg += `Comprobante Interno: #${sale.saleNumber}\n`;
    msg += `Fecha: ${formatColombianDate(sale.createdAt)}\n`;
    msg += `Cliente: ${sale.customerName || 'Cliente General'}\n`;
    msg += `--------------------------------\n`;
    sale.items.forEach(item => {
      msg += `${item.quantity}x ${item.name} = ${formatCOP(item.total)}\n`;
    });
    msg += `--------------------------------\n`;
    msg += `*TOTAL: ${formatCOP(sale.total)}*\n`;
    if (sale.amountPaid < sale.total) {
      msg += `Abonado: ${formatCOP(sale.amountPaid)}\n`;
      msg += `*Saldo Fiado Pendiente: ${formatCOP(sale.pendingAmount)}*\n`;
    } else {
      msg += `Estado: Pagado totalmente\n`;
      if (sale.changeGiven && sale.changeGiven > 0) {
        msg += `Cambio entregado: ${formatCOP(sale.changeGiven)}\n`;
      }
    }
    msg += `\n${business.receiptFooter || '¡Gracias por su compra!'}`;

    const url = phone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col my-auto border border-stone-200">
        {/* Top toolbar (not printed) */}
        <div className="p-4 bg-emerald-700 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-300" />
            <span className="font-semibold text-lg">Comprobante de Venta</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-emerald-800 text-emerald-100 hover:text-white transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Printable Ticket Content */}
        <div className="p-6 overflow-y-auto max-h-[70vh] font-mono text-stone-800 text-sm print:p-0 print:max-h-none print:text-xs">
          <div className="text-center space-y-1 pb-3 border-b border-dashed border-stone-400">
            <h2 className="text-lg font-bold tracking-tight text-stone-900">{business.name}</h2>
            <p className="text-xs text-stone-600">NIT: {business.nit}</p>
            {business.address && <p className="text-xs text-stone-600">{business.address} - {business.city}</p>}
            {business.phone && <p className="text-xs text-stone-600">Tel / WhatsApp: {business.phone}</p>}
            <p className="text-[11px] font-semibold text-stone-500 uppercase mt-1">
              Comprobante Interno de Venta
            </p>
          </div>

          <div className="py-2.5 space-y-1 text-xs border-b border-dashed border-stone-300">
            <div className="flex justify-between">
              <span className="text-stone-500">N° Venta:</span>
              <span className="font-bold">#{sale.saleNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Fecha:</span>
              <span>{formatColombianDate(sale.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Atendido por:</span>
              <span>{sale.cashierName || 'Cajero'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Cliente:</span>
              <span className="font-medium">{sale.customerName || 'Cliente General'}</span>
            </div>
            {sale.customerNit && (
              <div className="flex justify-between">
                <span className="text-stone-500">CC / NIT:</span>
                <span>{sale.customerNit}</span>
              </div>
            )}
          </div>

          {/* Items Table */}
          <div className="py-3 border-b border-dashed border-stone-300 space-y-2">
            <div className="grid grid-cols-12 text-xs font-bold text-stone-600 pb-1">
              <span className="col-span-2">Cant</span>
              <span className="col-span-6">Descripción</span>
              <span className="col-span-4 text-right">Total</span>
            </div>
            {sale.items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 text-xs gap-1">
                <span className="col-span-2 font-medium">{item.quantity}</span>
                <span className="col-span-6 text-stone-700 truncate">{item.name}</span>
                <span className="col-span-4 text-right font-medium">{formatCOP(item.total)}</span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="py-2.5 space-y-1 text-xs border-b border-dashed border-stone-400">
            {sale.discount > 0 && (
              <div className="flex justify-between text-stone-600">
                <span>Descuento aplicado:</span>
                <span className="text-emerald-700">-{formatCOP(sale.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold text-stone-900 pt-1">
              <span>TOTAL A PAGAR:</span>
              <span className="text-base text-emerald-700">{formatCOP(sale.total)}</span>
            </div>
          </div>

          {/* Payments detail */}
          <div className="py-2.5 space-y-1 text-xs border-b border-dashed border-stone-300">
            <p className="font-semibold text-stone-600 text-[11px] uppercase tracking-wider">Detalle del Pago:</p>
            {sale.payments.map((p, idx) => {
              const label =
                p.method === 'cash' ? 'Efectivo' :
                p.method === 'nequi' ? 'Nequi' :
                p.method === 'daviplata' ? 'Daviplata' :
                p.method === 'transfer' ? 'Transferencia' :
                p.method === 'card' ? 'Tarjeta / Datáfono' : 'Fiado (Crédito)';
              return (
                <div key={idx} className="flex justify-between">
                  <span>{label} {p.reference ? `(${p.reference})` : ''}:</span>
                  <span className="font-medium">{formatCOP(p.amount)}</span>
                </div>
              );
            })}

            {sale.cashReceived && sale.cashReceived > 0 && (
              <>
                <div className="flex justify-between text-stone-600 pt-1">
                  <span>Efectivo recibido:</span>
                  <span>{formatCOP(sale.cashReceived)}</span>
                </div>
                <div className="flex justify-between font-bold text-stone-900">
                  <span>Cambio / Vueltas:</span>
                  <span className="text-emerald-700">{formatCOP(sale.changeGiven || 0)}</span>
                </div>
              </>
            )}

            {sale.pendingAmount > 0 && (
              <div className="flex justify-between font-bold text-amber-700 pt-1">
                <span>Saldo Pendiente (Fiado):</span>
                <span>{formatCOP(sale.pendingAmount)}</span>
              </div>
            )}
          </div>

          {/* Footer note */}
          <div className="pt-3 text-center text-xs text-stone-600 space-y-1">
            <p className="italic">{business.receiptFooter || '¡Gracias por su compra!'}</p>
            <p className="text-[10px] text-stone-400">
              Sistema Anapse PosTienda Colombia • Régimen simplificado / No responsable de IVA
            </p>
          </div>
        </div>

        {/* Action Buttons (Not printed) */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex flex-col sm:flex-row gap-2 print:hidden">
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-medium py-2.5 px-4 rounded-xl shadow-sm transition active:scale-98"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Ticket</span>
          </button>
          
          <button
            onClick={handleShareWhatsApp}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-medium py-2.5 px-4 rounded-xl transition active:scale-98"
          >
            <Smartphone className="w-4 h-4 text-emerald-600" />
            <span>WhatsApp</span>
          </button>

          <button
            onClick={onClose}
            className="py-2.5 px-4 border border-stone-300 hover:bg-stone-100 text-stone-700 font-medium rounded-xl transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
