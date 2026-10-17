import React, { useState, useEffect } from 'react';
import { useAuth } from '../firebase/authContext';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  runTransaction 
} from 'firebase/firestore';
import { Purchase, PurchaseItem, Supplier, Product } from '../types';
import { formatCOP } from '../utils/currency';
import { formatColombianDate } from '../utils/date';
import { downloadCSV } from '../utils/exportCsv';
import { 
  Truck, 
  Plus, 
  Search, 
  Download, 
  CheckCircle, 
  Clock, 
  Trash2, 
  AlertCircle 
} from 'lucide-react';

export const PurchasesView: React.FC = () => {
  const { currentBusiness, user } = useAuth();

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // New Purchase Modal
  const [showModal, setShowModal] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'PAID' | 'CREDIT' | 'PARTIAL'>('PAID');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [purchaseItems, setPurchaseItems] = useState<{
    productId: string;
    productName: string;
    quantity: number;
    unitCost: number;
  }[]>([]);

  // Item being added
  const [itemProductId, setItemProductId] = useState('');
  const [itemQty, setItemQty] = useState(1);
  const [itemCost, setItemCost] = useState(0);

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!currentBusiness) return;

    // Load purchases
    const pRef = collection(db, `businesses/${currentBusiness.id}/purchases`);
    const unsubP = onSnapshot(pRef, (snap) => {
      const items: Purchase[] = [];
      snap.forEach(d => items.push({ id: d.id, ...d.data() } as Purchase));
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setPurchases(items);
      setLoading(false);
    }, (err) => {
      console.warn('Error loading purchases: ', err);
      setLoading(false);
    });

    // Load suppliers
    const sRef = collection(db, `businesses/${currentBusiness.id}/suppliers`);
    const unsubS = onSnapshot(sRef, (snap) => {
      const items: Supplier[] = [];
      snap.forEach(d => items.push({ id: d.id, ...d.data() } as Supplier));
      setSuppliers(items);
    }, (err) => console.warn(err));

    // Load products
    const prodRef = collection(db, `businesses/${currentBusiness.id}/products`);
    const unsubProd = onSnapshot(prodRef, (snap) => {
      const items: Product[] = [];
      snap.forEach(d => items.push({ id: d.id, ...d.data() } as Product));
      setProducts(items);
    }, (err) => console.warn(err));

    return () => {
      unsubP();
      unsubS();
      unsubProd();
    };
  }, [currentBusiness]);

  const handleAddItem = () => {
    if (!itemProductId) return;
    const prod = products.find(p => p.id === itemProductId);
    if (!prod) return;

    setPurchaseItems(prev => [
      ...prev,
      {
        productId: prod.id,
        productName: prod.name,
        quantity: itemQty,
        unitCost: itemCost > 0 ? itemCost : (prod.costPrice || 0),
      }
    ]);

    setItemProductId('');
    setItemQty(1);
    setItemCost(0);
  };

  const handleRemoveItem = (index: number) => {
    setPurchaseItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const totalPurchase = purchaseItems.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);

  const handleCreatePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBusiness || !user) return;
    if (!selectedSupplierId) {
      alert('Debe seleccionar un proveedor.');
      return;
    }
    if (purchaseItems.length === 0) {
      alert('Debe añadir al menos un producto a la compra.');
      return;
    }

    setIsSubmitting(true);
    const purchaseId = `purch_${Date.now()}`;
    const purchaseNumber = Date.now() % 100000;
    const nowIso = new Date().toISOString();
    const supplier = suppliers.find(s => s.id === selectedSupplierId);

    const purchaseData: Purchase = {
      id: purchaseId,
      purchaseNumber,
      businessId: currentBusiness.id,
      supplierId: selectedSupplierId,
      supplierName: supplier?.name || 'Proveedor General',
      invoiceNumber: invoiceNumber.trim(),
      items: purchaseItems.map(it => ({
        ...it,
        subtotal: it.quantity * it.unitCost,
      })),
      total: totalPurchase,
      status: 'RECEIVED',
      paymentStatus,
      paidAmount: paymentStatus === 'PAID' ? totalPurchase : paidAmount,
      notes: notes.trim(),
      userId: user.uid,
      createdAt: nowIso,
    };

    try {
      await runTransaction(db, async (transaction) => {
        // 1. Update stock for each product and record movement
        for (const item of purchaseItems) {
          const prodRef = doc(db, `businesses/${currentBusiness.id}/products`, item.productId);
          const prodSnap = await transaction.get(prodRef);
          if (prodSnap.exists()) {
            const currentStock = prodSnap.data().stock || 0;
            const newStock = currentStock + item.quantity;

            // Update cost price and stock
            transaction.update(prodRef, {
              stock: newStock,
              costPrice: item.unitCost,
              updatedAt: nowIso,
            });

            // Log stock movement
            const movId = `mov_purch_${Date.now()}_${item.productId}`;
            const movRef = doc(db, `businesses/${currentBusiness.id}/stockMovements`, movId);
            transaction.set(movRef, {
              id: movId,
              businessId: currentBusiness.id,
              productId: item.productId,
              productName: item.productName,
              type: 'PURCHASE',
              quantity: item.quantity,
              previousStock: currentStock,
              newStock,
              cost: item.unitCost,
              reason: `Compra #${purchaseNumber} a ${supplier?.name}`,
              referenceId: purchaseId,
              userId: user.uid,
              userName: user.displayName || 'Comprador',
              createdAt: nowIso,
            });
          }
        }

        // 2. Save purchase document
        const pRef = doc(db, `businesses/${currentBusiness.id}/purchases`, purchaseId);
        transaction.set(pRef, purchaseData);
      });

      setShowModal(false);
      setPurchaseItems([]);
      setInvoiceNumber('');
      setNotes('');
      alert('¡Compra registrada e inventario actualizado exitosamente!');
    } catch (err: any) {
      console.error('Error creating purchase:', err);
      alert('Error al registrar la compra.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportCSV = () => {
    const rows = purchases.map(p => ({
      'N° Compra': `#${p.purchaseNumber}`,
      'Fecha': formatColombianDate(p.createdAt),
      'Proveedor': p.supplierName,
      'Factura Proveedor': p.invoiceNumber || '',
      'Total (COP)': p.total,
      'Estado': p.status,
      'Pago': p.paymentStatus,
      'Monto Pagado (COP)': p.paidAmount,
      'Observaciones': p.notes || ''
    }));
    downloadCSV(`compras_${currentBusiness?.name || 'tienda'}`, rows);
  };

  return (
    <div className="space-y-5 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Truck className="w-6 h-6 text-emerald-700" />
            <h1 className="text-2xl font-black text-stone-900 tracking-tight">Compras y Abastecimiento</h1>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Registro de compras de mercancía a distribuidores, actualización de costos y reposición de stock.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            disabled={purchases.length === 0}
            className="flex items-center gap-1.5 bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 font-semibold px-3 py-2 rounded-xl text-xs shadow-xs transition"
          >
            <Download className="w-3.5 h-3.5 text-stone-500" />
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={() => {
              if (suppliers.length === 0) {
                alert('Primero debes registrar proveedores en la sección Proveedores.');
                return;
              }
              setSelectedSupplierId(suppliers[0].id);
              setShowModal(true);
            }}
            className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 py-2 rounded-xl text-xs sm:text-sm shadow-sm transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Compra</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-stone-400 text-sm">Cargando compras...</div>
        ) : purchases.length === 0 ? (
          <div className="p-12 text-center text-stone-400 space-y-2">
            <Truck className="w-10 h-10 mx-auto text-stone-300" />
            <p className="font-semibold text-stone-600">No hay compras registradas aún.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 text-xs font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3.5">N° Compra</th>
                  <th className="p-3.5">Fecha</th>
                  <th className="p-3.5">Proveedor</th>
                  <th className="p-3.5">Factura / Remisión</th>
                  <th className="p-3.5 text-center">Productos</th>
                  <th className="p-3.5 text-right">Total COP</th>
                  <th className="p-3.5 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {purchases.map(p => (
                  <tr key={p.id} className="hover:bg-stone-50 transition">
                    <td className="p-3.5 font-bold text-stone-900">#{p.purchaseNumber}</td>
                    <td className="p-3.5 text-stone-600 whitespace-nowrap">{formatColombianDate(p.createdAt)}</td>
                    <td className="p-3.5 font-semibold text-stone-800">{p.supplierName}</td>
                    <td className="p-3.5 text-stone-500 font-mono">{p.invoiceNumber || 'Sin número'}</td>
                    <td className="p-3.5 text-center font-medium">{p.items.length} ítems</td>
                    <td className="p-3.5 text-right font-extrabold text-stone-900">{formatCOP(p.total)}</td>
                    <td className="p-3.5 text-center">
                      <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        RECIBIDA
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Purchase Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-stone-200 space-y-4 my-auto">
            
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <h3 className="font-extrabold text-stone-900 text-lg">Registrar Compra a Proveedor</h3>
              <button onClick={() => setShowModal(false)} className="text-stone-400 hover:text-stone-600 text-lg font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePurchase} className="space-y-4">
              
              {/* Supplier & Invoice */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Proveedor *</label>
                  <select
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm font-semibold"
                  >
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.city || 'Colombia'})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">N° Factura / Remisión del Proveedor</label>
                  <input
                    type="text"
                    placeholder="Ej: FAC-8921"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm font-mono"
                  />
                </div>
              </div>

              {/* Add Items Box */}
              <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                <span className="text-xs font-bold text-stone-800 uppercase block">Añadir Producto a la Compra:</span>
                
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                  <div className="sm:col-span-5">
                    <label className="text-[11px] font-semibold text-stone-600 block">Producto</label>
                    <select
                      value={itemProductId}
                      onChange={(e) => {
                        setItemProductId(e.target.value);
                        const p = products.find(x => x.id === e.target.value);
                        if (p) setItemCost(p.costPrice || 0);
                      }}
                      className="w-full px-2 py-1.5 bg-white border border-stone-300 rounded-lg text-xs"
                    >
                      <option value="">Seleccione producto...</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="text-[11px] font-semibold text-stone-600 block">Cantidad</label>
                    <input
                      type="number"
                      min="1"
                      value={itemQty}
                      onChange={(e) => setItemQty(parseFloat(e.target.value) || 1)}
                      className="w-full px-2 py-1.5 bg-white border border-stone-300 rounded-lg text-xs text-center font-bold"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="text-[11px] font-semibold text-stone-600 block">Costo Unitario COP</label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={itemCost || ''}
                      onChange={(e) => setItemCost(parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-bold text-emerald-800"
                    />
                  </div>

                  <div className="sm:col-span-1">
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="w-full py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div className="border rounded-xl p-3 max-h-48 overflow-y-auto space-y-2 bg-white">
                <span className="text-xs font-bold text-stone-700 uppercase block mb-1">
                  Ítems a ingresar ({purchaseItems.length}):
                </span>

                {purchaseItems.length === 0 ? (
                  <p className="text-xs text-stone-400 text-center py-4">Añada los productos que está recibiendo del proveedor.</p>
                ) : (
                  purchaseItems.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-stone-100 last:border-none">
                      <div>
                        <span className="font-bold text-stone-900">{item.quantity}x {item.productName}</span>
                        <span className="text-stone-400 block">a {formatCOP(item.unitCost)} c/u</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-stone-900">{formatCOP(item.quantity * item.unitCost)}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-stone-300 hover:text-rose-500"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Totals */}
              <div className="pt-2 border-t border-stone-200 flex justify-between items-baseline font-black text-base text-stone-900">
                <span>Total Compra:</span>
                <span className="text-xl text-emerald-700">{formatCOP(totalPurchase)}</span>
              </div>

              <div className="flex gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border border-stone-300 text-stone-700 text-xs font-semibold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || purchaseItems.length === 0}
                  className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  {isSubmitting ? 'Guardando...' : 'Confirmar Compra e Ingreso de Stock'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
