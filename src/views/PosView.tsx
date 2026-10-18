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
  Scale,
  Sparkles
} from 'lucide-react';
import { seedBusinessSampleData } from '../utils/sampleData';

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

  const [weighingProduct, setWeighingProduct] = useState<Product | null>(null);
  const [customWeight, setCustomWeight] = useState<string>('1.0');
  const [isSeeding, setIsSeeding] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');

  // Shortcut F2 to open modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        setShowProductModal(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleBarcodeSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const val = barcodeInput.trim();
    if (!val) {
      setShowProductModal(true);
      return;
    }
    const matchBarcode = products.find(p => p.barcode && p.barcode.toLowerCase() === val.toLowerCase());
    if (matchBarcode) {
      addToCart(matchBarcode, 1);
      setBarcodeInput('');
      return;
    }
    const matchName = products.find(p => p.name.toLowerCase() === val.toLowerCase());
    if (matchName) {
      addToCart(matchName, 1);
      setBarcodeInput('');
      return;
    }
    // If not exact match, open selection modal
    setShowProductModal(true);
  };

  const handleSeedProducts = async () => {
    if (!currentBusiness) return;
    setIsSeeding(true);
    try {
      await seedBusinessSampleData(currentBusiness.id);
    } catch (err) {
      console.error('Error seeding products:', err);
      handleFirestoreError(err, OperationType.WRITE, `businesses/${currentBusiness.id}/products`);
    } finally {
      setIsSeeding(false);
    }
  };

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
  const addToCart = (product: Product, quantityToAdd: number = 1, skipWeightPrompt: boolean = false) => {
    if (product.allowDecimals && quantityToAdd === 1 && !skipWeightPrompt) {
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
    <div className="flex flex-col gap-3 pb-6 w-full max-w-full min-w-0 overflow-x-hidden">
      
      {/* Top Controls Bar: Action Button, Quick Barcode Scanner & Customer */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-3 sm:p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        
        {/* Left: Prominent Modal Trigger + Fast Barcode Search */}
        <div className="flex items-center gap-2.5 flex-1 min-w-[280px]">
          <button 
            type="button"
            onClick={() => setShowProductModal(true)}
            className="py-2.5 px-4 sm:px-5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 transition active:scale-98 shadow-md shrink-0"
            title="Abrir catálogo para agregar productos (F2)"
          >
            <Plus className="w-5 h-5 text-emerald-200" />
            <span>Agregar Producto</span>
            <span className="hidden md:inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-800/80 text-emerald-200 border border-emerald-600/50">F2</span>
          </button>

          {/* Fast Barcode / Search Box (Enter) */}
          <form onSubmit={handleBarcodeSubmit} className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-stone-400" />
            <input
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="Escanear código de barras o buscar..."
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:outline-none"
            />
            {barcodeInput && (
              <button
                type="button"
                onClick={() => setBarcodeInput('')}
                className="absolute right-2.5 top-2.5 text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
              >
                ✕
              </button>
            )}
          </form>

          {products.length === 0 && !loading && (
            <button
              type="button"
              onClick={handleSeedProducts}
              disabled={isSeeding}
              className="py-2 px-3 bg-amber-400 hover:bg-amber-300 text-stone-950 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-xs transition active:scale-95 disabled:opacity-50 shrink-0"
              title="Cargar productos de prueba colombianos"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-950" />
              <span>{isSeeding ? 'Cargando...' : 'Cargar Muestra'}</span>
            </button>
          )}
        </div>

        {/* Right: Customer Selection & Cart Actions */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-2 flex-1 sm:flex-initial">
            <span className="text-xs font-bold text-stone-500 dark:text-stone-400 flex items-center gap-1 whitespace-nowrap">
              <User className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Cliente:</span>
            </span>
            <select
              value={selectedCustomer?.id || ''}
              onChange={(e) => {
                const c = customers.find(x => x.id === e.target.value) || null;
                setSelectedCustomer(c);
              }}
              className="bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 rounded-xl px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-600 max-w-[190px] sm:max-w-[220px] truncate"
            >
              <option value="">Cliente General (Mostrador)</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.currentDebt > 0 ? `(Debe: ${formatCOP(c.currentDebt)})` : ''}
                </option>
              ))}
            </select>
          </div>

          {cart.length > 0 && (
            <button
              type="button"
              onClick={clearCart}
              title="Vaciar carrito"
              className="py-1.5 px-2.5 text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg font-semibold flex items-center gap-1 transition shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Vaciar</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {cart.length === 0 ? (
        /* Empty State: Spacious, clean, no cluttered catalog grid */
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-8 sm:p-12 shadow-xs flex flex-col items-center justify-center text-center space-y-5 min-h-[460px]">
          <div className="w-20 h-20 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shadow-inner">
            <ShoppingCart className="w-10 h-10" />
          </div>

          <div className="space-y-1.5 max-w-md">
            <h2 className="text-xl sm:text-2xl font-black text-stone-900 dark:text-stone-100">
              Caja Lista para Facturar
            </h2>
            <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400">
              Presiona el botón para abrir el catálogo y seleccionar productos para la venta sin ocupar espacio en pantalla.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowProductModal(true)}
            className="py-3.5 px-6 bg-emerald-700 hover:bg-emerald-600 text-white rounded-2xl font-black text-sm sm:text-base flex items-center gap-2.5 transition active:scale-95 shadow-lg hover:shadow-emerald-700/20"
          >
            <Plus className="w-5 h-5 text-emerald-200" />
            <span>Agregar Producto al Carrito</span>
          </button>

          {/* Quick Context & Shortcuts Indicator */}
          <div className="pt-6 border-t border-stone-100 dark:border-stone-800 flex flex-wrap items-center justify-center gap-4 text-xs text-stone-500 dark:text-stone-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>{products.length} productos en inventario</span>
            </span>
            <span>•</span>
            <span>Atajo de teclado: <strong>F2</strong></span>
            {activeShift && (
              <>
                <span>•</span>
                <span>Cajero: <strong>{activeShift.cashierName}</strong></span>
              </>
            )}
          </div>

          {/* If no products in store, offer quick Colombian sample seed */}
          {products.length === 0 && !loading && (
            <div className="mt-4 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 max-w-md space-y-2">
              <p className="font-bold text-xs text-amber-900 dark:text-amber-200">
                Tu tienda no tiene productos registrados todavía
              </p>
              <button
                type="button"
                onClick={handleSeedProducts}
                disabled={isSeeding}
                className="py-2 px-4 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition active:scale-95 inline-flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>{isSeeding ? 'Cargando muestra...' : '⚡ Cargar Catálogo de Prueba Ahora'}</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Active Cart State: Wide Items Table + Checkout Summary */
        <div className="flex flex-col lg:flex-row gap-4 items-start w-full">
          
          {/* Left/Center: Spacious Cart Items Table */}
          <div className="flex-1 w-full bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs overflow-hidden flex flex-col">
            
            {/* Items Header */}
            <div className="p-3 sm:p-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/70 dark:bg-stone-800/40">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <h3 className="font-bold text-sm sm:text-base text-stone-900 dark:text-stone-100">
                  Artículos de la Venta ({cart.length})
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setShowProductModal(true)}
                className="py-1.5 px-3 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar Producto</span>
              </button>
            </div>

            {/* Items List */}
            <div className="divide-y divide-stone-100 dark:divide-stone-800 overflow-y-auto max-h-[calc(100vh-16rem)]">
              {cart.map((item) => {
                const itemTotal = (item.product.salePrice * item.quantity) - item.discount;
                return (
                  <div key={item.product.id} className="p-3 sm:p-4 flex items-center justify-between gap-3 hover:bg-stone-50/50 dark:hover:bg-stone-800/30 transition">
                    
                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-extrabold text-sm sm:text-base text-stone-900 dark:text-white truncate">
                        {item.product.name}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                        <span className="font-bold text-emerald-700 dark:text-emerald-400">
                          {formatCOP(item.product.salePrice)}
                        </span>
                        <span>/ {item.product.unit}</span>
                        {item.product.category && (
                          <>
                            <span>•</span>
                            <span className="text-[11px] font-medium">{item.product.category}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Quantity Stepper */}
                    <div className="flex items-center gap-1.5 shrink-0 bg-stone-100 dark:bg-stone-800 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.product.id, item.quantity - (item.product.allowDecimals ? 0.25 : 1))}
                        className="w-7 h-7 rounded-lg bg-white dark:bg-stone-700 hover:bg-stone-200 dark:hover:bg-stone-600 text-stone-900 dark:text-white flex items-center justify-center font-bold transition active:scale-90 shadow-xs"
                        aria-label="Disminuir cantidad"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      
                      <span className="w-12 text-center text-xs font-black text-stone-900 dark:text-white">
                        {formatQuantity(item.quantity, item.product.allowDecimals)}
                      </span>

                      <button
                        type="button"
                        onClick={() => updateQuantity(item.product.id, item.quantity + (item.product.allowDecimals ? 0.25 : 1))}
                        className="w-7 h-7 rounded-lg bg-white dark:bg-stone-700 hover:bg-stone-200 dark:hover:bg-stone-600 text-stone-900 dark:text-white flex items-center justify-center font-bold transition active:scale-90 shadow-xs"
                        aria-label="Aumentar cantidad"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Line Total & Remove */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right w-20 sm:w-24">
                        <p className="font-black text-sm sm:text-base text-stone-900 dark:text-white font-mono">
                          {formatCOP(itemTotal)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeFromCart(item.product.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                        title="Eliminar producto de la venta"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>

            {/* Bottom: Sale Notes */}
            <div className="p-3 border-t border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-800/30">
              <input
                type="text"
                placeholder="Observaciones o notas de la venta (opcional)..."
                value={saleNotes}
                onChange={(e) => setSaleNotes(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>

          </div>

          {/* Right: Checkout & Totals Summary Panel */}
          <div className="w-full lg:w-96 shrink-0 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm p-4 sm:p-5 space-y-4">
            
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
              <h3 className="font-bold text-sm text-stone-900 dark:text-stone-100">
                Resumen de Venta
              </h3>
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                {selectedCustomer ? selectedCustomer.name : 'Cliente Mostrador'}
              </span>
            </div>

            {/* Totals Calculation */}
            <div className="space-y-2 text-xs sm:text-sm text-stone-600 dark:text-stone-300">
              <div className="flex justify-between">
                <span>Subtotal ({cart.length} líneas):</span>
                <span className="font-bold text-stone-900 dark:text-stone-100 font-mono">
                  {formatCOP(subtotal)}
                </span>
              </div>

              {/* General Discount */}
              <div className="flex items-center justify-between pt-1">
                <span className="flex items-center gap-1 font-medium">
                  <Tag className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Descuento General:</span>
                </span>
                <input
                  type="number"
                  min="0"
                  step="500"
                  placeholder="$ 0"
                  value={generalDiscount === 0 ? '' : generalDiscount}
                  onChange={(e) => setGeneralDiscount(Number(e.target.value) || 0)}
                  className="w-28 text-right px-2.5 py-1 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100 rounded-xl text-xs font-bold focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              <div className="pt-3 border-t border-stone-200 dark:border-stone-700 flex justify-between items-baseline">
                <span className="text-sm font-black text-stone-900 dark:text-stone-100 uppercase tracking-tight">
                  Total a Pagar:
                </span>
                <span className="text-2xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-400 font-mono">
                  {formatCOP(total)}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handleOpenPayment}
                disabled={cart.length === 0}
                className="w-full py-4 px-4 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-base rounded-2xl shadow-lg hover:shadow-emerald-700/20 transition active:scale-98 flex items-center justify-center gap-2"
              >
                <CreditCard className="w-5 h-5 text-emerald-200" />
                <span>Cobrar {formatCOP(total)}</span>
                <ArrowRight className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={() => setShowProductModal(true)}
                className="w-full py-2.5 px-4 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>+ Agregar más productos</span>
              </button>
            </div>

          </div>

        </div>
      )}

      {/* Product Selection Modal */}
      {showProductModal && (
        <ProductSelectionModal 
          products={products} 
          onClose={() => setShowProductModal(false)}
          onAddToCart={addToCart}
          onSeedSampleData={handleSeedProducts}
          cartItems={cart}
          cartTotal={total}
        />
      )}

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
