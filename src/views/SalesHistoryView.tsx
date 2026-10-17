import React, { useState, useEffect } from 'react';
import { useAuth } from '../firebase/authContext';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import { 
  collection, 
  onSnapshot, 
  doc, 
  runTransaction 
} from 'firebase/firestore';
import { Sale } from '../types';
import { formatCOP } from '../utils/currency';
import { formatColombianDate } from '../utils/date';
import { downloadCSV } from '../utils/exportCsv';
import { ReceiptModal } from '../components/ReceiptModal';
import { 
  Receipt, 
  Search, 
  Printer, 
  XCircle, 
  Eye, 
  Download, 
  Calendar, 
  Filter, 
  AlertTriangle,
  RotateCcw
} from 'lucide-react';

export const SalesHistoryView: React.FC = () => {
  const { currentBusiness, user, currentRole } = useAuth();

  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');

  // Selected sale for detail modal / receipt
  const [selectedSaleForReceipt, setSelectedSaleForReceipt] = useState<Sale | null>(null);
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<Sale | null>(null);

  // Cancellation modal
  const [saleToCancel, setSaleToCancel] = useState<Sale | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (!currentBusiness) return;

    const salesRef = collection(db, `businesses/${currentBusiness.id}/sales`);
    const unsub = onSnapshot(salesRef, (snapshot) => {
      const items: Sale[] = [];
      snapshot.forEach(docSnap => {
        items.push({ id: docSnap.id, ...docSnap.data() } as Sale);
      });
      // Sort newest first
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setSales(items);
      setLoading(false);
    }, (error) => {
      console.warn('Error fetching sales:', error);
      setLoading(false);
    });

    return () => unsub();
  }, [currentBusiness]);

  // Filters
  const filteredSales = sales.filter(s => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      s.saleNumber.toString().includes(query) ||
      (s.customerName && s.customerName.toLowerCase().includes(query)) ||
      (s.cashierName && s.cashierName.toLowerCase().includes(query));

    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;

    if (!matchesSearch || !matchesStatus) return false;

    if (dateFilter === 'ALL') return true;
    const saleTime = new Date(s.createdAt).getTime();
    const now = new Date();

    if (dateFilter === 'TODAY') {
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      return saleTime >= startOfToday;
    }
    if (dateFilter === 'WEEK') {
      const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).getTime();
      return saleTime >= startOfWeek;
    }
    if (dateFilter === 'MONTH') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      return saleTime >= startOfMonth;
    }
    return true;
  });

  // Export to CSV
  const handleExportCSV = () => {
    const rows = filteredSales.map(s => ({
      'N° Venta': `#${s.saleNumber}`,
      'Fecha': formatColombianDate(s.createdAt),
      'Cliente': s.customerName || 'Cliente Mostrador',
      'Atendido por': s.cashierName || 'Cajero',
      'Subtotal (COP)': s.subtotal,
      'Descuento (COP)': s.discount,
      'Total (COP)': s.total,
      'Costo Total (COP)': s.costTotal,
      'Ganancia Bruta (COP)': s.grossProfit,
      'Estado': s.status,
      'Medios de Pago': s.payments.map(p => `${p.method}: ${formatCOP(p.amount)}`).join(' | '),
      'Saldo Fiado (COP)': s.pendingAmount,
      'Observaciones': s.notes || ''
    }));
    downloadCSV(`ventas_${currentBusiness?.name || 'tienda'}`, rows);
  };

  // Controlled sale cancellation & inventory restoration
  const handleConfirmCancelSale = async () => {
    if (!saleToCancel || !currentBusiness || !user) return;
    if (!cancelReason.trim()) {
      alert('Debe especificar un motivo para la anulación de la venta.');
      return;
    }

    setIsCancelling(true);
    const nowIso = new Date().toISOString();

    try {
      await runTransaction(db, async (transaction) => {
        const saleRef = doc(db, `businesses/${currentBusiness.id}/sales`, saleToCancel.id);
        const saleSnap = await transaction.get(saleRef);
        if (!saleSnap.exists()) throw new Error('La venta ya no existe.');
        if (saleSnap.data().status === 'CANCELLED') throw new Error('Esta venta ya fue anulada previamente.');

        // 1. Restore products stock
        for (const item of saleToCancel.items) {
          const prodRef = doc(db, `businesses/${currentBusiness.id}/products`, item.productId);
          const prodSnap = await transaction.get(prodRef);
          if (prodSnap.exists()) {
            const currentStock = prodSnap.data().stock || 0;
            const restoredStock = currentStock + item.quantity;
            transaction.update(prodRef, {
              stock: restoredStock,
              updatedAt: nowIso
            });

            // Log reverse stock movement
            const movId = `mov_cancel_${Date.now()}_${item.productId}`;
            const movRef = doc(db, `businesses/${currentBusiness.id}/stockMovements`, movId);
            transaction.set(movRef, {
              id: movId,
              businessId: currentBusiness.id,
              productId: item.productId,
              productName: item.name,
              type: 'RETURN',
              quantity: item.quantity,
              previousStock: currentStock,
              newStock: restoredStock,
              reason: `Anulación Venta #${saleToCancel.saleNumber}: ${cancelReason}`,
              referenceId: saleToCancel.id,
              userId: user.uid,
              userName: user.displayName || 'Administrador',
              createdAt: nowIso,
            });
          }
        }

        // 2. If it had pending fiado debt, reduce it on the customer account
        if (saleToCancel.pendingAmount > 0 && saleToCancel.customerId) {
          const custRef = doc(db, `businesses/${currentBusiness.id}/customers`, saleToCancel.customerId);
          const custSnap = await transaction.get(custRef);
          if (custSnap.exists()) {
            const prevDebt = custSnap.data().currentDebt || 0;
            const newDebt = Math.max(0, prevDebt - saleToCancel.pendingAmount);
            transaction.update(custRef, { currentDebt: newDebt });

            // Record customer movement
            const cmovId = `cmov_cancel_${Date.now()}`;
            const cmovRef = doc(db, `businesses/${currentBusiness.id}/customerMovements`, cmovId);
            transaction.set(cmovRef, {
              id: cmovId,
              businessId: currentBusiness.id,
              customerId: saleToCancel.customerId,
              saleId: saleToCancel.id,
              type: 'PAYMENT',
              amount: saleToCancel.pendingAmount,
              previousDebt: prevDebt,
              newDebt,
              notes: `Anulación de crédito Venta #${saleToCancel.saleNumber}`,
              userId: user.uid,
              userName: user.displayName || 'Administrador',
              createdAt: nowIso,
            });
          }
        }

        // 3. Mark sale as CANCELLED
        transaction.update(saleRef, {
          status: 'CANCELLED',
          cancelledAt: nowIso,
          cancelReason: cancelReason,
        });
      });

      setSaleToCancel(null);
      setCancelReason('');
      alert('Venta anulada correctamente y mercancía devuelta al inventario.');
    } catch (err: any) {
      console.error('Error cancelling sale:', err);
      alert(err.message || 'Error al anular la venta.');
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="space-y-5 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Receipt className="w-6 h-6 text-emerald-700" />
            <h1 className="text-2xl font-black text-stone-900 tracking-tight">Historial de Ventas</h1>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Registro de todas las operaciones realizadas, consultas de comprobante y devoluciones controladas.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          disabled={filteredSales.length === 0}
          className="flex items-center gap-2 bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 font-semibold px-4 py-2.5 rounded-xl text-xs sm:text-sm shadow-xs transition"
        >
          <Download className="w-4 h-4 text-emerald-700" />
          <span>Exportar a Excel / CSV</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Buscar por # de venta, cliente o cajero..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <span className="text-xs font-semibold text-stone-500 whitespace-nowrap">Estado:</span>
            {[
              { id: 'ALL', label: 'Todos' },
              { id: 'PAID', label: 'Pagadas' },
              { id: 'CREDIT', label: 'Fiadas' },
              { id: 'PARTIAL', label: 'Parciales' },
              { id: 'CANCELLED', label: 'Anuladas' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  statusFilter === tab.id
                    ? 'bg-emerald-700 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <span className="text-xs font-semibold text-stone-500 whitespace-nowrap">Fecha:</span>
            {[
              { id: 'ALL', label: 'Siempre' },
              { id: 'TODAY', label: 'Hoy' },
              { id: 'WEEK', label: '7 días' },
              { id: 'MONTH', label: 'Este mes' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setDateFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  dateFilter === tab.id
                    ? 'bg-amber-400 text-emerald-950'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-stone-400 text-sm">Cargando transacciones...</div>
        ) : filteredSales.length === 0 ? (
          <div className="p-12 text-center text-stone-400 space-y-2">
            <Receipt className="w-10 h-10 mx-auto text-stone-300" />
            <p className="font-semibold text-stone-600">No hay ventas registradas con los filtros seleccionados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 text-xs font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3.5">N° Venta</th>
                  <th className="p-3.5">Fecha y Hora</th>
                  <th className="p-3.5">Cliente</th>
                  <th className="p-3.5">Medio(s) de Pago</th>
                  <th className="p-3.5 text-right">Total COP</th>
                  <th className="p-3.5 text-center">Estado</th>
                  <th className="p-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredSales.map((sale) => {
                  const isCancelled = sale.status === 'CANCELLED';
                  return (
                    <tr key={sale.id} className={`hover:bg-stone-50/80 transition ${isCancelled ? 'bg-rose-50/40 text-stone-400' : ''}`}>
                      <td className="p-3.5 font-bold text-stone-900">
                        #{sale.saleNumber}
                      </td>
                      <td className="p-3.5 text-stone-600 whitespace-nowrap">
                        {formatColombianDate(sale.createdAt)}
                      </td>
                      <td className="p-3.5 font-medium text-stone-800">
                        {sale.customerName || 'Cliente General'}
                      </td>
                      <td className="p-3.5 text-stone-600">
                        <div className="flex flex-wrap gap-1">
                          {sale.payments.map((p, idx) => (
                            <span key={idx} className="bg-stone-100 text-stone-700 text-[11px] font-medium px-1.5 py-0.5 rounded">
                              {p.method.toUpperCase()}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3.5 text-right font-extrabold text-stone-900">
                        <span className={isCancelled ? 'line-through text-stone-400' : 'text-emerald-700'}>
                          {formatCOP(sale.total)}
                        </span>
                        {sale.pendingAmount > 0 && !isCancelled && (
                          <span className="block text-[10px] text-amber-600 font-semibold">
                            Fiado: {formatCOP(sale.pendingAmount)}
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          isCancelled
                            ? 'bg-rose-100 text-rose-700'
                            : sale.status === 'PAID'
                            ? 'bg-emerald-100 text-emerald-800'
                            : sale.status === 'CREDIT'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {isCancelled ? 'ANULADA' : sale.status === 'PAID' ? 'PAGADA' : sale.status === 'CREDIT' ? 'FIADA' : 'PARCIAL'}
                        </span>
                      </td>
                      <td className="p-3.5 text-right whitespace-nowrap space-x-1">
                        <button
                          onClick={() => setSelectedSaleDetail(sale)}
                          title="Ver detalle"
                          className="p-1.5 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setSelectedSaleForReceipt(sale)}
                          title="Imprimir ticket"
                          className="p-1.5 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 rounded-lg transition"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        {!isCancelled && currentRole !== 'cashier' && (
                          <button
                            onClick={() => {
                              setSaleToCancel(sale);
                              setCancelReason('');
                            }}
                            title="Anular venta y devolver stock"
                            className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sale Detail Modal */}
      {selectedSaleDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <h3 className="font-bold text-stone-900 text-base">
                Detalle Venta #{selectedSaleDetail.saleNumber}
              </h3>
              <button
                onClick={() => setSelectedSaleDetail(null)}
                className="text-stone-400 hover:text-stone-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1.5 text-xs text-stone-600">
              <p><strong>Fecha:</strong> {formatColombianDate(selectedSaleDetail.createdAt)}</p>
              <p><strong>Atendió:</strong> {selectedSaleDetail.cashierName || 'Cajero'}</p>
              <p><strong>Cliente:</strong> {selectedSaleDetail.customerName || 'Cliente General'}</p>
              {selectedSaleDetail.notes && <p><strong>Nota:</strong> {selectedSaleDetail.notes}</p>}
            </div>

            <div className="border rounded-xl p-3 bg-stone-50 max-h-48 overflow-y-auto space-y-2">
              <p className="font-bold text-xs text-stone-700 uppercase">Productos vendidos:</p>
              {selectedSaleDetail.items.map((it, idx) => (
                <div key={idx} className="flex justify-between text-xs">
                  <span>{it.quantity}x {it.name}</span>
                  <span className="font-bold">{formatCOP(it.total)}</span>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-stone-200 flex justify-between font-bold text-sm">
              <span>Total:</span>
              <span className="text-emerald-700">{formatCOP(selectedSaleDetail.total)}</span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSelectedSaleForReceipt(selectedSaleDetail);
                  setSelectedSaleDetail(null);
                }}
                className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold"
              >
                Abrir Comprobante
              </button>
              <button
                onClick={() => setSelectedSaleDetail(null)}
                className="py-2 px-4 border border-stone-300 text-stone-700 rounded-xl text-xs font-semibold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Modal */}
      {saleToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center gap-2 text-rose-700 font-bold text-lg">
              <AlertTriangle className="w-5 h-5" />
              <span>Anular Venta #{saleToCancel.saleNumber}</span>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              Esta acción reintegrará automáticamente las unidades vendidas al inventario y revertirá la deuda en la cuenta fiada si aplica.
            </p>

            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">
                Motivo de anulación (requerido):
              </label>
              <textarea
                rows={3}
                placeholder="Ej: Error de digitación, cliente devolvió el producto, etc."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs focus:ring-1 focus:ring-rose-500"
              />
            </div>

            <div className="flex gap-2 pt-2 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setSaleToCancel(null)}
                disabled={isCancelling}
                className="flex-1 py-2.5 border border-stone-300 text-stone-700 text-xs font-semibold rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelSale}
                disabled={isCancelling || !cancelReason.trim()}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs"
              >
                {isCancelling ? 'Anulando...' : 'Confirmar Anulación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal for Reprinting */}
      {selectedSaleForReceipt && currentBusiness && (
        <ReceiptModal
          sale={selectedSaleForReceipt}
          business={currentBusiness}
          onClose={() => setSelectedSaleForReceipt(null)}
        />
      )}

    </div>
  );
};
