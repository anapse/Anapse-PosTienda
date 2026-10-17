import React, { useState, useEffect } from 'react';
import { useAuth } from '../firebase/authContext';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import { 
  collection, 
  onSnapshot, 
  doc, 
  runTransaction 
} from 'firebase/firestore';
import { Product, StockMovement, MovementType } from '../types';
import { formatCOP, formatQuantity } from '../utils/currency';
import { formatColombianDate } from '../utils/date';
import { downloadCSV } from '../utils/exportCsv';
import { 
  Boxes, 
  Search, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Sliders, 
  AlertTriangle, 
  Download, 
  PlusCircle, 
  DollarSign 
} from 'lucide-react';

export const InventoryView: React.FC = () => {
  const { currentBusiness, user } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'MOVEMENTS' | 'ALERTS' | 'VALUATION'>('MOVEMENTS');
  const [searchQuery, setSearchQuery] = useState('');

  // Stock Adjustment Modal
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [adjustType, setAdjustType] = useState<'IN' | 'OUT' | 'ADJUST'>('IN');
  const [adjustQuantity, setAdjustQuantity] = useState<number>(1);
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!currentBusiness) return;

    // Load products
    const prodRef = collection(db, `businesses/${currentBusiness.id}/products`);
    const unsubProd = onSnapshot(prodRef, (snapshot) => {
      const items: Product[] = [];
      snapshot.forEach(docSnap => {
        items.push({ id: docSnap.id, ...docSnap.data() } as Product);
      });
      setProducts(items);
      setLoading(false);
    }, (err) => {
      console.warn('Error fetching products:', err);
      setLoading(false);
    });

    // Load stock movements
    const movRef = collection(db, `businesses/${currentBusiness.id}/stockMovements`);
    const unsubMov = onSnapshot(movRef, (snapshot) => {
      const movs: StockMovement[] = [];
      snapshot.forEach(docSnap => {
        movs.push({ id: docSnap.id, ...docSnap.data() } as StockMovement);
      });
      movs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setMovements(movs);
    }, (err) => {
      console.warn('Error fetching movements:', err);
    });

    return () => {
      unsubProd();
      unsubMov();
    };
  }, [currentBusiness]);

  // Total valuation
  const totalCostValuation = products.reduce((sum, p) => sum + ((p.costPrice || 0) * p.stock), 0);
  const totalSaleValuation = products.reduce((sum, p) => sum + (p.salePrice * p.stock), 0);
  const potentialProfit = totalSaleValuation - totalCostValuation;

  // Low stock
  const lowStockItems = products.filter(p => p.stock <= p.minStock);

  // Filtered movements
  const filteredMovements = movements.filter(m => {
    const q = searchQuery.toLowerCase();
    return (
      m.productName.toLowerCase().includes(q) ||
      m.reason.toLowerCase().includes(q) ||
      m.type.toLowerCase().includes(q)
    );
  });

  const handleOpenAdjustModal = (product?: Product) => {
    setSelectedProduct(product || (products.length > 0 ? products[0] : null));
    setAdjustType('IN');
    setAdjustQuantity(1);
    setAdjustReason('');
    setShowAdjustModal(true);
  };

  const handleConfirmAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBusiness || !user || !selectedProduct) return;
    if (adjustQuantity <= 0) {
      alert('La cantidad debe ser mayor a 0.');
      return;
    }
    if (!adjustReason.trim()) {
      alert('Debe especificar un motivo para el movimiento.');
      return;
    }

    setIsSubmitting(true);
    const nowIso = new Date().toISOString();

    try {
      await runTransaction(db, async (transaction) => {
        const prodRef = doc(db, `businesses/${currentBusiness.id}/products`, selectedProduct.id);
        const prodSnap = await transaction.get(prodRef);
        if (!prodSnap.exists()) throw new Error('El producto no existe.');

        const currentStock = prodSnap.data().stock || 0;
        let newStock = currentStock;

        if (adjustType === 'IN') {
          newStock = currentStock + adjustQuantity;
        } else if (adjustType === 'OUT') {
          newStock = Math.max(0, currentStock - adjustQuantity);
        } else {
          // Absolute adjustment to new stock
          newStock = adjustQuantity;
        }

        transaction.update(prodRef, {
          stock: newStock,
          updatedAt: nowIso,
        });

        const movId = `mov_adj_${Date.now()}`;
        const movRef = doc(db, `businesses/${currentBusiness.id}/stockMovements`, movId);
        transaction.set(movRef, {
          id: movId,
          businessId: currentBusiness.id,
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          type: adjustType,
          quantity: adjustType === 'ADJUST' ? Math.abs(newStock - currentStock) : adjustQuantity,
          previousStock: currentStock,
          newStock,
          reason: adjustReason.trim(),
          userId: user.uid,
          userName: user.displayName || 'Operador',
          createdAt: nowIso,
        });
      });

      setShowAdjustModal(false);
      alert('¡Ajuste de inventario aplicado con éxito!');
    } catch (error) {
      console.error('Error adjusting stock:', error);
      alert('Error al ajustar el inventario.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportCSV = () => {
    const rows = filteredMovements.map(m => ({
      'Fecha': formatColombianDate(m.createdAt),
      'Producto': m.productName,
      'Tipo de Movimiento': m.type,
      'Cantidad': m.quantity,
      'Stock Anterior': m.previousStock,
      'Nuevo Stock': m.newStock,
      'Motivo': m.reason,
      'Responsable': m.userName
    }));
    downloadCSV(`kardex_inventario_${currentBusiness?.name || 'tienda'}`, rows);
  };

  return (
    <div className="space-y-5 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Boxes className="w-6 h-6 text-emerald-700" />
            <h1 className="text-2xl font-black text-stone-900 tracking-tight">Inventario y Kardex</h1>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Control de existencias, trazabilidad de entradas/salidas, reposición y valorización.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            disabled={movements.length === 0}
            className="flex items-center gap-1.5 bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 font-semibold px-3 py-2 rounded-xl text-xs shadow-xs transition"
          >
            <Download className="w-3.5 h-3.5 text-stone-500" />
            <span>Exportar Kardex</span>
          </button>

          <button
            onClick={() => handleOpenAdjustModal()}
            className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 py-2 rounded-xl text-xs sm:text-sm shadow-sm transition active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Registrar Movimiento</span>
          </button>
        </div>
      </div>

      {/* Valuation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-xs">
          <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase">Valor Inventario (Al Costo)</span>
          <p className="text-xl sm:text-2xl font-extrabold text-stone-900 dark:text-stone-100 mt-1">{formatCOP(totalCostValuation)}</p>
          <p className="text-[11px] text-stone-400 mt-1">Capital invertido en mercancía</p>
        </div>

        <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-xs">
          <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase">Valor Comercial (A la Venta)</span>
          <p className="text-xl sm:text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 mt-1">{formatCOP(totalSaleValuation)}</p>
          <p className="text-[11px] text-stone-400 mt-1">Ingreso esperado por venta total</p>
        </div>

        <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-xs">
          <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase">Ganancia Bruta Potencial</span>
          <p className="text-xl sm:text-2xl font-extrabold text-blue-700 dark:text-blue-400 mt-1">{formatCOP(potentialProfit)}</p>
          <p className="text-[11px] text-stone-400 mt-1">Margen proyectado de todo el stock</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-stone-200 space-x-2">
        <button
          onClick={() => setActiveTab('MOVEMENTS')}
          className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition ${
            activeTab === 'MOVEMENTS'
              ? 'border-emerald-700 text-emerald-800'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          Kardex de Movimientos ({movements.length})
        </button>

        <button
          onClick={() => setActiveTab('ALERTS')}
          className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'ALERTS'
              ? 'border-emerald-700 text-emerald-800'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <span>Alertas de Stock Bajo</span>
          {lowStockItems.length > 0 && (
            <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-1.5 py-0.2 rounded-full">
              {lowStockItems.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab 1: Kardex Movements */}
      {activeTab === 'MOVEMENTS' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-3 border border-stone-200 shadow-xs">
            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar en el Kardex por producto, motivo o tipo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-xl"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
            {movements.length === 0 ? (
              <div className="p-8 text-center text-stone-400 text-xs sm:text-sm">
                No hay movimientos registrados aún. Las ventas y compras generarán registros automáticamente.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 text-xs font-bold uppercase tracking-wider">
                    <tr>
                      <th className="p-3">Fecha y Hora</th>
                      <th className="p-3">Producto</th>
                      <th className="p-3 text-center">Tipo</th>
                      <th className="p-3 text-right">Cantidad</th>
                      <th className="p-3 text-right">Stock Anterior</th>
                      <th className="p-3 text-right">Nuevo Stock</th>
                      <th className="p-3">Motivo / Referencia</th>
                      <th className="p-3">Usuario</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filteredMovements.map(m => {
                      const isPositive = m.type === 'IN' || m.type === 'PURCHASE' || m.type === 'RETURN';
                      return (
                        <tr key={m.id} className="hover:bg-stone-50/80 transition">
                          <td className="p-3 text-stone-600 whitespace-nowrap">
                            {formatColombianDate(m.createdAt)}
                          </td>
                          <td className="p-3 font-bold text-stone-900">{m.productName}</td>
                          <td className="p-3 text-center">
                            <span className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                              isPositive ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-700'
                            }`}>
                              {m.type}
                            </span>
                          </td>
                          <td className={`p-3 text-right font-extrabold ${isPositive ? 'text-emerald-700' : 'text-stone-800'}`}>
                            {isPositive ? `+${m.quantity}` : `-${m.quantity}`}
                          </td>
                          <td className="p-3 text-right text-stone-500 font-medium">{m.previousStock}</td>
                          <td className="p-3 text-right font-bold text-stone-900">{m.newStock}</td>
                          <td className="p-3 text-stone-600 truncate max-w-xs">{m.reason}</td>
                          <td className="p-3 text-stone-500 text-xs">{m.userName}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Low Stock Alerts */}
      {activeTab === 'ALERTS' && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-stone-200 bg-amber-50/50">
            <h3 className="font-bold text-amber-900 text-sm flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Productos agotados o que están en o por debajo de su stock mínimo</span>
            </h3>
          </div>

          {lowStockItems.length === 0 ? (
            <div className="p-10 text-center text-stone-400">
              <p className="font-semibold text-stone-600">¡Excelente! Ningún producto está bajo de inventario.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 text-xs font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-3.5">Producto</th>
                    <th className="p-3.5">Categoría</th>
                    <th className="p-3.5 text-center">Stock Mínimo</th>
                    <th className="p-3.5 text-center">Stock Actual</th>
                    <th className="p-3.5 text-right">Costo Reposición</th>
                    <th className="p-3.5 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {lowStockItems.map(p => (
                    <tr key={p.id} className="hover:bg-stone-50 transition">
                      <td className="p-3.5 font-bold text-stone-900">{p.name}</td>
                      <td className="p-3.5 text-stone-600">{p.category}</td>
                      <td className="p-3.5 text-center font-medium text-stone-600">{p.minStock} {p.unit}s</td>
                      <td className="p-3.5 text-center">
                        <span className={`inline-block font-extrabold px-2.5 py-0.5 rounded-full text-xs ${
                          p.stock <= 0 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {p.stock <= 0 ? 'AGOTADO (0)' : `${p.stock} ${p.unit}s`}
                        </span>
                      </td>
                      <td className="p-3.5 text-right font-medium text-stone-700">
                        {formatCOP(p.costPrice * Math.max(1, p.minStock - p.stock))}
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => handleOpenAdjustModal(p)}
                          className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold"
                        >
                          Reponer Stock
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Adjust Modal */}
      {showAdjustModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <h3 className="font-extrabold text-stone-900 text-base">Registrar Movimiento de Inventario</h3>
              <button
                onClick={() => setShowAdjustModal(false)}
                className="text-stone-400 hover:text-stone-600 text-base font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmAdjust} className="space-y-4">
              
              {/* Product selection */}
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Producto:
                </label>
                <select
                  value={selectedProduct.id}
                  onChange={(e) => {
                    const found = products.find(p => p.id === e.target.value);
                    if (found) setSelectedProduct(found);
                  }}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm font-semibold"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Stock actual: {p.stock} {p.unit})
                    </option>
                  ))}
                </select>
              </div>

              {/* Movement Type */}
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1.5">
                  Tipo de Operación:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'IN', label: 'Entrada (+)', desc: 'Compra o ingreso' },
                    { id: 'OUT', label: 'Salida (-)', desc: 'Merma, daño o gasto' },
                    { id: 'ADJUST', label: 'Ajuste (=)', desc: 'Conteo físico real' },
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setAdjustType(t.id as any)}
                      className={`p-2.5 rounded-xl border text-xs font-bold text-center transition ${
                        adjustType === t.id
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                      }`}
                    >
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  {adjustType === 'ADJUST' ? 'Nuevo Stock Real:' : 'Cantidad a mover:'}
                </label>
                <input
                  type="number"
                  min="0.01"
                  step={selectedProduct.allowDecimals ? '0.01' : '1'}
                  required
                  value={adjustQuantity}
                  onChange={(e) => setAdjustQuantity(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-sm font-bold text-stone-900"
                />
              </div>

              {/* Reason */}
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Motivo o justificación:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Reposición de mercancía, producto averiado, auditoría de conteo..."
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 border border-stone-300 text-stone-700 font-semibold rounded-xl text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-xs"
                >
                  {isSubmitting ? 'Guardando...' : 'Aplicar Movimiento'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
