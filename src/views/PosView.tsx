import React, { useState, useEffect } from 'react';
import { useAuth } from '../firebase/authContext';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import { 
  collection, 
  doc, 
  onSnapshot, 
  runTransaction, 
  getDocs, 
  query, 
  where,
  setDoc,
  updateDoc,
  increment
} from 'firebase/firestore';
import { Product, CartItem, Sale, Customer, PaymentRecord, PaymentMethod, CashShift } from '../types';
import { formatCOP, formatQuantity } from '../utils/currency';
import { ReceiptModal } from '../components/ReceiptModal';
import { ProductSelectionModal } from '../components/ProductSelectionModal';
import { 
  Search, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  User, 
  CreditCard, 
  DollarSign, 
  Smartphone, 
  CheckCircle, 
  AlertCircle,
  Tag,
  ArrowRight,
  RotateCcw,
  Scale
} from 'lucide-react';

interface PosViewProps {
  onNavigate: (view: string) => void;
}

export const PosView: React.FC<PosViewProps> = ({ onNavigate }) => {
  const { currentBusiness, user, activeShift } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  // Cart
  const [cart, setCart] = useState<{
    product: Product;
    quantity: number;
    discount: number; // Discount in COP for this item
  }[]>([]);
  const [generalDiscount, setGeneralDiscount] = useState<number>(0);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [saleNotes, setSaleNotes] = useState('');

  // Payment Modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [payments, setPayments] = useState<{ method: PaymentMethod; amount: number; reference: string }[]>([
    { method: 'cash', amount: 0, reference: '' }
  ]);
  const [cashTendered, setCashTendered] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastCompletedSale, setLastCompletedSale] = useState<Sale | null>(null);

  // Weighable product prompt modal
  const [weighingProduct, setWeighingProduct] = useState<Product | null>(null);
  const [customWeight, setCustomWeight] = useState<string>('1.0');

  useEffect(() => {
    if (!currentBusiness) return;

    // Load active products
    const productsRef = collection(db, `businesses/${currentBusiness.id}/products`);
    const unsubProducts = onSnapshot(productsRef, (snap) => {
      const items: Product[] = [];
      snap.forEach(d => {
        const p = { id: d.id, ...d.data() } as Product;
        if (p.active) items.push(p);
      });
      setProducts(items);
      setLoading(false);
    }, (err) => {
      console.warn('Error loading products: ', err);
      setLoading(false);
    });

    // Load customers
    const customersRef = collection(db, `businesses/${currentBusiness.id}/customers`);
    const unsubCustomers = onSnapshot(customersRef, (snap) => {
      const custs: Customer[] = [];
      snap.forEach(d => {
        custs.push({ id: d.id, ...d.data() } as Customer);
      });
      setCustomers(custs);
    }, (err) => {
      console.warn('Error loading customers: ', err);
    });

    return () => {
      unsubProducts();
      unsubCustomers();
    };
  }, [currentBusiness]);



  // Cart operations
  const addToCart = (product: Product, quantityToAdd: number = 1) => {
    if (product.allowDecimals && quantityToAdd === 1) {
      // Open weight prompt modal
      setWeighingProduct(product);
      setCustomWeight('1.0');
      return;
    }

    setCart(prev => {
      const existingIndex = prev.findIndex(item => item.product.id === product.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        const newQty = updated[existingIndex].quantity + quantityToAdd;
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: Math.max(0.001, newQty)
        };
        return updated;
      } else {
        return [...prev, { product, quantity: quantityToAdd, discount: 0 }];
      }
    });
  };

  const updateQuantity = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev =>
      prev.map(item =>
        item.product.id === productId ? { ...item, quantity: newQty } : item
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setGeneralDiscount(0);
    setSelectedCustomer(null);
    setSaleNotes('');
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + (item.product.salePrice * item.quantity), 0);
  const itemsDiscount = cart.reduce((sum, item) => sum + item.discount, 0);
  const totalDiscount = itemsDiscount + generalDiscount;
  const total = Math.max(0, subtotal - totalDiscount);
  const costTotal = cart.reduce((sum, item) => sum + ((item.product.costPrice || 0) * item.quantity), 0);
  const grossProfit = total - costTotal;

  // Open payment modal
  const handleOpenPayment = () => {
    if (cart.length === 0) return;
    setPayments([{ method: 'cash', amount: total, reference: '' }]);
    setCashTendered(total);
    setShowPaymentModal(true);
  };

  // Colombian denominations quick buttons
  const COLOMBIAN_BILLS = [2000, 5000, 10000, 20000, 50000, 100000];

  const handleQuickBillClick = (billAmount: number) => {
    setCashTendered(prev => prev + billAmount);
  };

  // Execute Sale Transaction
  const handleConfirmSale = async () => {
    if (!currentBusiness || !user) return;
    if (cart.length === 0) return;

    const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const pendingAmount = Math.max(0, total - totalPaid);

    // If there is pending debt (fiado), customer is required!
    if (pendingAmount > 0 && !selectedCustomer) {
      alert('Para registrar una venta a crédito o fiada, debe asociar un cliente registrado.');
      return;
    }

    setIsSubmitting(true);
    const saleId = `sale_${Date.now()}`;
    const saleNumber = Date.now() % 1000000;
    const nowIso = new Date().toISOString();

    const saleItems = cart.map(item => ({
      productId: item.product.id,
      name: item.product.name,
      barcode: item.product.barcode || '',
      unit: item.product.unit,
      quantity: item.quantity,
      costPrice: item.product.costPrice || 0,
      unitPrice: item.product.salePrice,
      discount: item.discount,
      subtotal: item.product.salePrice * item.quantity,
      total: (item.product.salePrice * item.quantity) - item.discount,
    }));

    const cashPayment = payments.find(p => p.method === 'cash');
    const cashAmount = cashPayment ? cashPayment.amount : 0;
    const changeGiven = cashTendered > cashAmount ? cashTendered - cashAmount : 0;

    let saleStatus: 'PAID' | 'PARTIAL' | 'CREDIT' = 'PAID';
    if (pendingAmount === total) {
      saleStatus = 'CREDIT';
    } else if (pendingAmount > 0) {
      saleStatus = 'PARTIAL';
    }

    const saleData: Sale = {
      id: saleId,
      saleNumber,
      businessId: currentBusiness.id,
      cashierId: user.uid,
      cashierName: user.displayName || 'Cajero',
      customerId: selectedCustomer ? selectedCustomer.id : null,
      customerName: selectedCustomer ? selectedCustomer.name : 'Cliente General (Mostrador)',
      customerPhone: selectedCustomer?.phone || null,
      customerNit: selectedCustomer?.documentNumber || null,
      items: saleItems,
      subtotal,
      discount: totalDiscount,
      tax: 0,
      total,
      costTotal,
      grossProfit,
      status: saleStatus,
      payments,
      amountPaid: totalPaid,
      pendingAmount,
      cashReceived: cashPayment ? cashTendered : null,
      changeGiven: cashPayment ? changeGiven : null,
      notes: saleNotes || null,
      createdAt: nowIso,
    };

    try {
      // Perform atomic inventory deduction and sale recording
      // Perform atomic inventory deduction and sale recording with all reads before writes
      await runTransaction(db, async (transaction) => {
        // --- PHASE 1: ALL READS ---
        const productReads = await Promise.all(
          cart.map(async (item) => {
            const prodRef = doc(db, `businesses/${currentBusiness.id}/products`, item.product.id);
            const prodSnap = await transaction.get(prodRef);
            return { item, prodRef, prodSnap };
          })
        );

        let custRef = null;
        let custSnap = null;
        if (pendingAmount > 0 && selectedCustomer) {
          custRef = doc(db, `businesses/${currentBusiness.id}/customers`, selectedCustomer.id);
          custSnap = await transaction.get(custRef);
        }

        let shiftRef = null;
        let shiftSnap = null;
        if (activeShift) {
          shiftRef = doc(db, `businesses/${currentBusiness.id}/cashShifts`, activeShift.id);
          shiftSnap = await transaction.get(shiftRef);
        }

        // --- PHASE 2: ALL WRITES ---
        // 1. Verify stocks and deduct
        for (const { item, prodRef, prodSnap } of productReads) {
          if (prodSnap.exists()) {
            const currentStock = prodSnap.data().stock || 0;
            const newStock = Math.max(0, currentStock - item.quantity);
            transaction.update(prodRef, {
              stock: newStock,
              updatedAt: nowIso
            });

            // Record stock movement
            const movId = `mov_${Date.now()}_${item.product.id}`;
            const movRef = doc(db, `businesses/${currentBusiness.id}/stockMovements`, movId);
            transaction.set(movRef, {
              id: movId,
              businessId: currentBusiness.id,
              productId: item.product.id,
              productName: item.product.name,
              type: 'SALE',
              quantity: item.quantity,
              previousStock: currentStock,
              newStock: newStock,
              reason: `Venta #${saleNumber}`,
              referenceId: saleId,
              userId: user.uid,
              userName: user.displayName || 'Cajero',
              createdAt: nowIso,
            });
          }
        }

        // 2. Write sale document
        const saleRef = doc(db, `businesses/${currentBusiness.id}/sales`, saleId);
        transaction.set(saleRef, saleData);

        // 3. If credit / fiado, update customer balance
        if (pendingAmount > 0 && selectedCustomer && custRef && custSnap) {
          const prevDebt = custSnap.exists() ? (custSnap.data().currentDebt || 0) : 0;
          const newDebt = prevDebt + pendingAmount;
          transaction.update(custRef, { currentDebt: newDebt });

          // Record customer movement
          const custMovId = `cmov_${Date.now()}`;
          const custMovRef = doc(db, `businesses/${currentBusiness.id}/customerMovements`, custMovId);
          transaction.set(custMovRef, {
            id: custMovId,
            businessId: currentBusiness.id,
            customerId: selectedCustomer.id,
            saleId,
            type: 'DEBT',
            amount: pendingAmount,
            previousDebt: prevDebt,
            newDebt,
            notes: `Fiado Venta #${saleNumber}`,
            userId: user.uid,
            userName: user.displayName || 'Cajero',
            createdAt: nowIso,
          });
        }

        // 4. If there's an active cash shift, update shift balances
        if (activeShift && shiftRef && shiftSnap && shiftSnap.exists()) {
          const shiftData = shiftSnap.data();
          let newCashSales = shiftData.cashSales || 0;
          let newNequi = shiftData.nequiSales || 0;
          let newDaviplata = shiftData.daviplataSales || 0;
          let newTransfer = shiftData.transferSales || 0;
          let newCard = shiftData.cardSales || 0;
          let newCredit = shiftData.creditSales || 0;

          payments.forEach(p => {
            if (p.method === 'cash') newCashSales += p.amount;
            else if (p.method === 'nequi') newNequi += p.amount;
            else if (p.method === 'daviplata') newDaviplata += p.amount;
            else if (p.method === 'transfer') newTransfer += p.amount;
            else if (p.method === 'card') newCard += p.amount;
          });

          if (pendingAmount > 0) {
            newCredit += pendingAmount;
          }

          const newExpectedCash = (shiftData.initialCash || 0) + newCashSales + (shiftData.cashIn || 0) - (shiftData.cashOut || 0);

          transaction.update(shiftRef, {
            cashSales: newCashSales,
            nequiSales: newNequi,
            daviplataSales: newDaviplata,
            transferSales: newTransfer,
            cardSales: newCard,
            creditSales: newCredit,
            expectedCash: newExpectedCash,
          });
        }
      });

      // Clear cart and show printable receipt
      setLastCompletedSale(saleData);
      setShowPaymentModal(false);
      clearCart();
    } catch (error) {
      console.error('Error confirming sale:', error);
      handleFirestoreError(error, OperationType.WRITE, `businesses/${currentBusiness.id}/sales/${saleId}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-[calc(100vh-5rem)] flex flex-col lg:flex-row gap-4 pb-6">
      
      {/* Left: Product Catalog & Fast Search */}
      <div className="flex-1 flex flex-col bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        
        {/* Product Selection Button */}
        <div className="p-4 border-b border-stone-200">
          <button 
            onClick={() => setShowProductModal(true)}
            className="w-full py-4 bg-emerald-700 text-white rounded-2xl font-black text-lg flex items-center justify-center gap-2 hover:bg-emerald-800 transition"
          >
            <Plus className="w-6 h-6" />
            <span>Agregar Producto</span>
          </button>
        </div>

        {/* Product Modal */}
        {showProductModal && (
          <ProductSelectionModal 
            products={products} 
            onClose={() => setShowProductModal(false)}
            onAddToCart={addToCart}
          />
        )}

      </div>

      {/* Right: Cart & Checkout Panel - Responsive with toggle */}
      <div className={`w-full lg:w-96 bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden flex flex-col ${cart.length === 0 ? 'hidden lg:flex' : 'flex'}`}>
        
        {/* Cart Header - Added mobile toggle button */}
        <div className="p-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-emerald-700" />
            <h2 className="font-bold text-stone-900 text-base">Carrito ({cart.length})</h2>
          </div>
          {cart.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowProductModal(true)}
                title="Agregar más productos"
                className="text-xs bg-emerald-700 text-white font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 hover:bg-emerald-800"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar</span>
              </button>
              <button
                onClick={clearCart}
                title="Vaciar carrito"
                className="text-xs text-rose-600 hover:text-rose-800 font-medium flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Vaciar</span>
              </button>
            </div>
          )}
        </div>

        {/* Customer Selector */}
        <div className="p-3 border-b border-stone-200 bg-emerald-50/50">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-stone-700 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-emerald-700" />
              <span>Cliente / Fiado:</span>
            </span>
            {selectedCustomer && (
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-stone-400 hover:text-stone-600"
              >
                Cambiar a Mostrador
              </button>
            )}
          </div>

          <select
            value={selectedCustomer?.id || ''}
            onChange={(e) => {
              const c = customers.find(x => x.id === e.target.value) || null;
              setSelectedCustomer(c);
            }}
            className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-600"
          >
            <option value="">Cliente General (Mostrador)</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} {c.currentDebt > 0 ? `(Debe: ${formatCOP(c.currentDebt)})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 p-3 overflow-y-auto divide-y divide-stone-100">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-400">
              <ShoppingCart className="w-10 h-10 mb-2 text-stone-300" />
              <p className="text-sm font-medium text-stone-500">Carrito vacío</p>
              <p className="text-xs text-stone-400 mt-1">Selecciona productos a la izquierda para agregarlos a la venta.</p>
            </div>
          ) : (
            cart.map((item) => {
              const itemTotal = (item.product.salePrice * item.quantity) - item.discount;
              return (
                <div key={item.product.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-xs sm:text-sm text-stone-900 dark:text-stone-100 truncate">
                      {item.product.name}
                    </p>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400">
                      {formatCOP(item.product.salePrice)} / {item.product.unit}
                    </p>
                  </div>

                  {/* Quantity controls */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => updateQuantity(item.product.id, item.quantity - (item.product.allowDecimals ? 0.25 : 1))}
                      className="w-7 h-7 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 flex items-center justify-center font-bold"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    
                    <span className="w-12 text-center text-xs font-bold text-stone-800 dark:text-stone-100">
                      {formatQuantity(item.quantity, item.product.allowDecimals)}
                    </span>

                    <button
                      onClick={() => updateQuantity(item.product.id, item.quantity + (item.product.allowDecimals ? 0.25 : 1))}
                      className="w-7 h-7 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 flex items-center justify-center font-bold"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="text-right w-20">
                    <p className="font-bold text-xs sm:text-sm text-stone-900 dark:text-stone-100">
                      {formatCOP(itemTotal)}
                    </p>
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="text-stone-300 hover:text-rose-500 transition"
                      title="Eliminar del carrito"
                    >
                      <Trash2 className="w-3.5 h-3.5 inline" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Cart Totals & Checkout Button */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 space-y-3">
          
          <div className="space-y-1.5 text-xs text-stone-600">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-medium">{formatCOP(subtotal)}</span>
            </div>
            
            {/* General Discount */}
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-stone-600">
                <Tag className="w-3 h-3 text-emerald-600" /> Descuento:
              </span>
              <input
                type="number"
                min="0"
                step="500"
                placeholder="$ 0"
                value={generalDiscount === 0 ? '' : generalDiscount}
                onChange={(e) => setGeneralDiscount(Number(e.target.value) || 0)}
                className="w-24 text-right px-2 py-0.5 border border-stone-300 rounded text-xs focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            <div className="pt-2 border-t border-stone-200 dark:border-stone-700 flex justify-between items-baseline">
              <span className="text-sm font-extrabold text-stone-900 dark:text-stone-100 uppercase">Total a Pagar:</span>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{formatCOP(total)}</span>
            </div>
          </div>

          <button
            onClick={handleOpenPayment}
            disabled={cart.length === 0}
            className="w-full py-3.5 px-4 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold text-base rounded-xl shadow-md transition active:scale-98 flex items-center justify-center gap-2"
          >
            <CreditCard className="w-5 h-5 text-emerald-300" />
            <span>Cobrar {formatCOP(total)}</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Modal: Colombian Weight Prompt for decimal items */}
      {weighingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center gap-2 text-emerald-800 font-bold text-base">
              <Scale className="w-5 h-5" />
              <span>Venta por Peso ({weighingProduct.unit})</span>
            </div>
            <p className="text-xs text-stone-600">
              {weighingProduct.name} se comercializa por {weighingProduct.unit}. Ingrese el peso registrado en la balanza:
            </p>
            <div>
              <label className="text-xs font-semibold text-stone-700 block mb-1">
                Cantidad / Peso en {weighingProduct.unit}:
              </label>
              <input
                type="number"
                step="0.05"
                min="0.05"
                value={customWeight}
                onChange={(e) => setCustomWeight(e.target.value)}
                className="w-full text-center text-2xl font-bold py-2 border-2 border-emerald-600 rounded-xl focus:outline-none"
              />
            </div>
            <div className="text-center font-bold text-sm text-stone-800">
              Total producto: {formatCOP(weighingProduct.salePrice * (parseFloat(customWeight) || 0))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setWeighingProduct(null)}
                className="flex-1 py-2 rounded-xl border border-stone-300 text-stone-700 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const qty = parseFloat(customWeight) || 1;
                  addToCart(weighingProduct, qty);
                  setWeighingProduct(null);
                }}
                className="flex-1 py-2 rounded-xl bg-emerald-700 text-white text-sm font-bold hover:bg-emerald-800"
              >
                Añadir al Carrito
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 space-y-4 my-auto">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div>
                <h3 className="text-lg font-bold text-stone-900">Registrar Cobro de Venta</h3>
                <p className="text-xs text-stone-500">
                  {selectedCustomer ? `Cliente: ${selectedCustomer.name}` : 'Cliente Mostrador'}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-stone-400 block">Total a Cobrar</span>
                <span className="text-2xl font-black text-emerald-700">{formatCOP(total)}</span>
              </div>
            </div>

            {/* Payment Methods Tabs */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-stone-700 block">
                Método de Pago Principal:
              </label>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'cash', label: 'Efectivo', icon: DollarSign },
                  { id: 'nequi', label: 'Nequi', icon: Smartphone },
                  { id: 'daviplata', label: 'Daviplata', icon: Smartphone },
                  { id: 'transfer', label: 'Transferencia', icon: CreditCard },
                  { id: 'card', label: 'Datáfono', icon: CreditCard },
                  { id: 'credit', label: 'Fiado (Crédito)', icon: User },
                ].map((m) => {
                  const Icon = m.icon;
                  const isSelected = payments[0]?.method === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setPayments([{ method: m.id as PaymentMethod, amount: total, reference: '' }]);
                        if (m.id === 'cash') setCashTendered(total);
                      }}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition ${
                        isSelected
                          ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                          : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cash Calculator / Colombian Bills */}
            {payments[0]?.method === 'cash' && (
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900">Efectivo Recibido:</span>
                  <input
                    type="number"
                    step="1000"
                    value={cashTendered === 0 ? '' : cashTendered}
                    onChange={(e) => setCashTendered(Number(e.target.value) || 0)}
                    className="w-36 text-right px-3 py-1.5 bg-white border border-emerald-300 rounded-lg font-bold text-sm text-stone-900"
                  />
                </div>

                {/* Quick Colombian Bill Buttons */}
                <div>
                  <span className="text-[11px] text-emerald-800 font-semibold block mb-1">
                    Billetes colombianos rápidos:
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {COLOMBIAN_BILLS.map(bill => (
                      <button
                        key={bill}
                        type="button"
                        onClick={() => handleQuickBillClick(bill)}
                        className="py-1 px-2 bg-white hover:bg-emerald-100 border border-emerald-300 rounded-lg text-xs font-bold text-emerald-900 transition active:scale-95"
                      >
                        {formatCOP(bill)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Change Given */}
                <div className="pt-2 border-t border-emerald-200 flex items-center justify-between font-bold text-sm">
                  <span className="text-emerald-900">Cambio / Vueltas a devolver:</span>
                  <span className="text-base text-emerald-800">
                    {formatCOP(Math.max(0, cashTendered - total))}
                  </span>
                </div>
              </div>
            )}

            {/* Nequi / Daviplata / Transfer Reference */}
            {['nequi', 'daviplata', 'transfer', 'card'].includes(payments[0]?.method) && (
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                <label className="text-xs font-semibold text-stone-700 block">
                  Número de Aprobación / Comprobante Digital (Opcional):
                </label>
                <input
                  type="text"
                  placeholder="Ej: M1234567 o # de transacción"
                  value={payments[0]?.reference || ''}
                  onChange={(e) => {
                    const ref = e.target.value;
                    setPayments(prev => [{ ...prev[0], reference: ref }]);
                  }}
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-xs"
                />
              </div>
            )}

            {/* Fiado warning */}
            {payments[0]?.method === 'credit' && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-300 text-xs text-amber-900 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertCircle className="w-4 h-4 text-amber-700" />
                  <span>Venta a Crédito / Fiado</span>
                </div>
                {selectedCustomer ? (
                  <p>
                    Se sumará {formatCOP(total)} al saldo pendiente de <strong>{selectedCustomer.name}</strong>.
                    Saldo actual: {formatCOP(selectedCustomer.currentDebt)}.
                  </p>
                ) : (
                  <p className="text-rose-700 font-bold">
                    ¡Atención! Debe seleccionar un cliente antes de confirmar una venta fiada.
                  </p>
                )}
              </div>
            )}

            {/* Note */}
            <div>
              <label className="text-xs font-medium text-stone-600 block mb-1">
                Observación interna (opcional):
              </label>
              <input
                type="text"
                placeholder="Ej: Domicilio, empaque especial..."
                value={saleNotes}
                onChange={(e) => setSaleNotes(e.target.value)}
                className="w-full px-3 py-1.5 border border-stone-300 rounded-lg text-xs"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                disabled={isSubmitting}
                className="flex-1 py-2.5 border border-stone-300 text-stone-700 font-semibold rounded-xl text-sm hover:bg-stone-50"
              >
                Volver al Carrito
              </button>
              <button
                type="button"
                onClick={handleConfirmSale}
                disabled={isSubmitting || (payments[0]?.method === 'credit' && !selectedCustomer)}
                className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-extrabold rounded-xl text-sm shadow-sm transition active:scale-98 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <span>Registrando venta...</span>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Confirmar Venta</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Completed Sale Receipt Modal */}
      {lastCompletedSale && currentBusiness && (
        <ReceiptModal
          sale={lastCompletedSale}
          business={currentBusiness}
          onClose={() => setLastCompletedSale(null)}
        />
      )}

    </div>
  );
};
