import React, { useState, useEffect } from 'react';
import { useAuth } from '../firebase/authContext';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import { collection, onSnapshot, doc, setDoc, updateDoc } from 'firebase/firestore';
import { Product, CatalogOrder, Business } from '../types';
import { formatCOP } from '../utils/currency';
import { formatColombianDate } from '../utils/date';
import { 
  Globe, 
  Smartphone, 
  ShoppingBag, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  Send, 
  CheckCircle, 
  MapPin, 
  Phone, 
  Share2, 
  Copy,
  Clock,
  Truck
} from 'lucide-react';

export const OnlineCatalogView: React.FC = () => {
  const { currentBusiness } = useAuth();
  const [resolvedBusiness, setResolvedBusiness] = useState<Business | null>(currentBusiness);

  const [activeTab, setActiveTab] = useState<'CATALOG' | 'ORDERS'>('CATALOG');
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<CatalogOrder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('TODAS');

  // Customer Cart in Catalog
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<'DOMICILIO' | 'RECOGER_EN_TIENDA'>('DOMICILIO');
  const [paymentPref, setPaymentPref] = useState('Efectivo contra entrega');
  const [orderNotes, setOrderNotes] = useState('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  useEffect(() => {
    if (currentBusiness) {
      setResolvedBusiness(currentBusiness);
      return;
    }

    // Try resolving from URL param
    const param = new URLSearchParams(window.location.search).get('catalogo');
    if (param) {
      import('firebase/firestore').then(({ doc, getDoc, query, where, collection, getDocs }) => {
        getDoc(doc(db, 'businesses', param)).then(d => {
          if (d.exists()) {
            setResolvedBusiness({ id: d.id, ...d.data() } as Business);
          } else {
            // Search by slug
            const q = query(collection(db, 'businesses'), where('slug', '==', param));
            getDocs(q).then(qs => {
              if (!qs.empty) {
                const bDoc = qs.docs[0];
                setResolvedBusiness({ id: bDoc.id, ...bDoc.data() } as Business);
              }
            });
          }
        });
      });
    }
  }, [currentBusiness]);

  useEffect(() => {
    const biz = resolvedBusiness || currentBusiness;
    if (!biz) return;

    // Load active products
    const unsubProd = onSnapshot(collection(db, `businesses/${biz.id}/products`), (snap) => {
      const items: Product[] = [];
      snap.forEach(d => {
        const p = { id: d.id, ...d.data() } as Product;
        if (p.active) items.push(p);
      });
      setProducts(items);
    });

    // Load incoming catalog orders
    const unsubOrders = onSnapshot(collection(db, `businesses/${biz.id}/catalogOrders`), (snap) => {
      const items: CatalogOrder[] = [];
      snap.forEach(d => items.push({ id: d.id, ...d.data() } as CatalogOrder));
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(items);
    });

    return () => {
      unsubProd();
      unsubOrders();
    };
  }, [currentBusiness]);

  const categories = ['TODAS', ...Array.from(new Set(products.map(p => p.category || 'Otros')))];

  const filteredProducts = products.filter(p => {
    const q = searchQuery.toLowerCase();
    const matchSearch = p.name.toLowerCase().includes(q) || (p.category && p.category.toLowerCase().includes(q));
    const matchCat = selectedCategory === 'TODAS' || p.category === selectedCategory;
    return matchSearch && matchCat;
  });

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      setCart(prev => prev.filter(item => item.product.id !== productId));
      return;
    }
    setCart(prev =>
      prev.map(item =>
        item.product.id === productId ? { ...item, quantity: newQty } : item
      )
    );
  };

  const totalCart = cart.reduce((sum, item) => sum + (item.product.salePrice * item.quantity), 0);

  // Send Order via WhatsApp & Save in DB
  const handleSendWhatsAppOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const biz = resolvedBusiness || currentBusiness;
    if (!biz) return;
    if (cart.length === 0) return;
    if (!customerName.trim() || !customerPhone.trim()) {
      alert('Por favor ingrese su nombre y teléfono.');
      return;
    }

    setIsSubmittingOrder(true);
    const orderId = `order_${Date.now()}`;
    const orderNum = Date.now() % 100000;
    const nowIso = new Date().toISOString();

    const orderData: CatalogOrder = {
      id: orderId,
      orderNumber: orderNum,
      businessId: biz.id,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerAddress: deliveryMethod === 'DOMICILIO' ? customerAddress.trim() : 'Recoge en local',
      items: cart.map(it => ({
        productId: it.product.id,
        productName: it.product.name,
        quantity: it.quantity,
        unitPrice: it.product.salePrice,
        subtotal: it.product.salePrice * it.quantity,
      })),
      total: totalCart,
      deliveryMethod,
      paymentMethodPreference: paymentPref,
      notes: orderNotes.trim(),
      status: 'NUEVO',
      createdAt: nowIso,
    };

    try {
      // 1. Save order to Firestore
      await setDoc(doc(db, `businesses/${biz.id}/catalogOrders`, orderId), orderData);

      // 2. Format WhatsApp Message
      const bizPhone = biz.whatsapp || biz.phone || '';
      const cleanBizPhone = bizPhone.replace(/\D/g, '');
      const targetPhone = cleanBizPhone.startsWith('57') ? cleanBizPhone : `57${cleanBizPhone}`;

      let msg = `*NUEVO PEDIDO DESDE CATÁLOGO ONLINE - #${orderNum}*\n`;
      msg += `Hola ${biz.name}, deseo realizar el siguiente pedido:\n`;
      msg += `--------------------------------\n`;
      cart.forEach(item => {
        msg += `${item.quantity}x ${item.product.name} = ${formatCOP(item.product.salePrice * item.quantity)}\n`;
      });
      msg += `--------------------------------\n`;
      msg += `*TOTAL A PAGAR: ${formatCOP(totalCart)}*\n\n`;
      msg += `*Datos del Cliente:*\n`;
      msg += `Nombre: ${customerName}\n`;
      msg += `Teléfono: ${customerPhone}\n`;
      msg += `Método de Entrega: ${deliveryMethod === 'DOMICILIO' ? 'Domicilio' : 'Recoger en Tienda'}\n`;
      if (deliveryMethod === 'DOMICILIO' && customerAddress) {
        msg += `Dirección / Barrio: ${customerAddress}\n`;
      }
      msg += `Preferencia de Pago: ${paymentPref} (pago al recibir)\n`;
      if (orderNotes) {
        msg += `Observaciones: ${orderNotes}\n`;
      }
      msg += `\n_Nota: Pedido pendiente de confirmación por la tienda._`;

      const waUrl = targetPhone
        ? `https://wa.me/${targetPhone}?text=${encodeURIComponent(msg)}`
        : `https://wa.me/?text=${encodeURIComponent(msg)}`;

      window.open(waUrl, '_blank');

      // Clear cart
      setCart([]);
      setShowCheckout(false);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setOrderNotes('');
      alert('¡Pedido enviado a WhatsApp de la tienda y registrado en el sistema!');
    } catch (err) {
      console.error('Error saving catalog order:', err);
      alert('Error al procesar el pedido.');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: CatalogOrder['status']) => {
    const biz = resolvedBusiness || currentBusiness;
    if (!biz) return;
    try {
      await updateDoc(doc(db, `businesses/${biz.id}/catalogOrders`, orderId), {
        status: newStatus
      });
    } catch (err) {
      console.error('Error updating order:', err);
    }
  };

  const biz = resolvedBusiness || currentBusiness;
  const catalogShareLink = `${window.location.origin}/?catalogo=${biz?.slug || biz?.id}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(catalogShareLink);
    alert('¡Enlace del catálogo copiado al portapapeles!');
  };

  return (
    <div className="space-y-5 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Globe className="w-6 h-6 text-emerald-700" />
            <h1 className="text-2xl font-black text-stone-900 tracking-tight">Catálogo Online y Pedidos por WhatsApp</h1>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Tu tienda en internet para que los vecinos hagan pedidos directos a tu WhatsApp sin comisiones.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-3 py-2 rounded-xl text-xs shadow-xs transition"
          >
            <Copy className="w-3.5 h-3.5 text-emerald-600" />
            <span>Copiar Enlace Público</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-stone-200 space-x-2">
        <button
          onClick={() => setActiveTab('CATALOG')}
          className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition ${
            activeTab === 'CATALOG'
              ? 'border-emerald-700 text-emerald-800'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          Vista Previa del Catálogo Web
        </button>

        <button
          onClick={() => setActiveTab('ORDERS')}
          className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'ORDERS'
              ? 'border-emerald-700 text-emerald-800'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <span>Pedidos Recibidos</span>
          {orders.filter(o => o.status === 'NUEVO').length > 0 && (
            <span className="bg-amber-400 text-emerald-950 text-[10px] font-black px-1.5 py-0.2 rounded-full">
              {orders.filter(o => o.status === 'NUEVO').length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: Online Catalog Public Preview */}
      {activeTab === 'CATALOG' && (
        <div className="flex flex-col lg:flex-row gap-6">
          
          {/* Products Column */}
          <div className="flex-1 space-y-4">
            
            {/* Store Banner */}
            <div className="bg-linear-to-r from-emerald-800 to-teal-800 text-white rounded-2xl p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] bg-amber-400 text-emerald-950 font-black px-2 py-0.5 rounded uppercase">
                    Catálogo Oficial
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black mt-1">{currentBusiness?.name}</h2>
                  <p className="text-xs text-emerald-100 flex items-center gap-2 mt-1">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{currentBusiness?.address} - {currentBusiness?.city}</span>
                  </p>
                </div>
                <div className="text-left sm:text-right text-xs text-emerald-100">
                  <p className="font-semibold text-white">Pedidos por WhatsApp:</p>
                  <p className="font-bold text-amber-300 text-sm">{currentBusiness?.whatsapp || currentBusiness?.phone || 'No registrado'}</p>
                </div>
              </div>
            </div>

            {/* Search & Categories */}
            <div className="bg-white rounded-2xl p-3 border border-stone-200 shadow-xs space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar productos en el catálogo..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-xl"
                />
              </div>

              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                      selectedCategory === cat ? 'bg-emerald-700 text-white' : 'bg-stone-100 text-stone-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredProducts.map(p => (
                <div key={p.id} className="bg-white rounded-2xl border border-stone-200 p-3.5 shadow-xs flex flex-col justify-between hover:shadow-md transition">
                  <div>
                    <span className="text-[10px] text-stone-400 uppercase font-semibold">{p.category}</span>
                    <h3 className="font-bold text-xs sm:text-sm text-stone-900 mt-0.5 line-clamp-2">{p.name}</h3>
                  </div>

                  <div className="mt-3 pt-2 border-t border-stone-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-stone-400 block">Precio</span>
                      <span className="text-sm font-extrabold text-emerald-700">{formatCOP(p.salePrice)}</span>
                    </div>

                    <button
                      onClick={() => addToCart(p)}
                      className="p-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl shadow-xs transition active:scale-95"
                      title="Agregar al pedido"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

          </div>

          {/* Cart Column */}
          <div className="w-full lg:w-80 bg-white rounded-2xl border border-stone-200 p-4 shadow-xs flex flex-col h-fit sticky top-20">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-emerald-700" />
                <h3 className="font-bold text-stone-900 text-sm">Tu Pedido</h3>
              </div>
              <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                {cart.length}
              </span>
            </div>

            <div className="py-3 space-y-2 max-h-60 overflow-y-auto divide-y divide-stone-100">
              {cart.length === 0 ? (
                <p className="text-xs text-stone-400 text-center py-6">Tu carrito está vacío.</p>
              ) : (
                cart.map(item => (
                  <div key={item.product.id} className="pt-2 first:pt-0 flex items-center justify-between text-xs">
                    <div className="flex-1 pr-2">
                      <p className="font-bold text-stone-900 truncate">{item.product.name}</p>
                      <p className="text-stone-400 text-[10px]">{formatCOP(item.product.salePrice)} c/u</p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        className="w-5 h-5 rounded bg-stone-100 text-stone-700 flex items-center justify-center font-bold"
                      >
                        -
                      </button>
                      <span className="w-6 text-center font-bold">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        className="w-5 h-5 rounded bg-stone-100 text-stone-700 flex items-center justify-center font-bold"
                      >
                        +
                      </button>
                    </div>

                    <span className="font-bold text-stone-900 ml-2">
                      {formatCOP(item.product.salePrice * item.quantity)}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-stone-200 space-y-2">
              <div className="flex justify-between font-black text-sm text-stone-900">
                <span>Total Pedido:</span>
                <span className="text-emerald-700">{formatCOP(totalCart)}</span>
              </div>

              <button
                onClick={() => setShowCheckout(true)}
                disabled={cart.length === 0}
                className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95"
              >
                <Smartphone className="w-4 h-4 text-emerald-300" />
                <span>Pedir por WhatsApp</span>
              </button>
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: Orders Received by the Merchant */}
      {activeTab === 'ORDERS' && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-stone-200">
            <h3 className="font-bold text-stone-900 text-base">Pedidos Recibidos por Catálogo Online</h3>
          </div>

          {orders.length === 0 ? (
            <div className="p-10 text-center text-stone-400">
              <p className="font-semibold text-stone-600">No hay pedidos recibidos por catálogo aún.</p>
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {orders.map(o => (
                <div key={o.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-stone-50 transition">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-stone-900 text-sm">Pedido #{o.orderNumber}</span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                        o.status === 'NUEVO' ? 'bg-amber-400 text-emerald-950' :
                        o.status === 'CONFIRMADO' ? 'bg-blue-100 text-blue-800' :
                        o.status === 'EN_CAMINO' ? 'bg-purple-100 text-purple-800' :
                        o.status === 'ENTREGADO' ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-600'
                      }`}>
                        {o.status}
                      </span>
                      <span className="text-xs text-stone-400">{formatColombianDate(o.createdAt)}</span>
                    </div>

                    <p className="font-semibold text-stone-800 text-xs mt-1">
                      Cliente: {o.customerName} • Tel: {o.customerPhone}
                    </p>
                    <p className="text-xs text-stone-500">
                      Modalidad: {o.deliveryMethod} {o.customerAddress ? `• Dir: ${o.customerAddress}` : ''}
                    </p>
                    <div className="text-xs text-stone-600 mt-1">
                      {o.items.map((it, idx) => (
                        <span key={idx} className="mr-2">
                          {it.quantity}x {it.productName}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[10px] text-stone-400 block">Total</span>
                      <span className="text-base font-black text-emerald-700">{formatCOP(o.total)}</span>
                    </div>

                    <select
                      value={o.status}
                      onChange={(e) => handleUpdateOrderStatus(o.id, e.target.value as any)}
                      className="bg-stone-50 border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-stone-700"
                    >
                      <option value="NUEVO">NUEVO</option>
                      <option value="CONFIRMADO">CONFIRMADO</option>
                      <option value="EN_CAMINO">EN CAMINO</option>
                      <option value="ENTREGADO">ENTREGADO</option>
                      <option value="CANCELADO">CANCELADO</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Customer Checkout Modal (WhatsApp Order) */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <h3 className="font-extrabold text-stone-900 text-base">Confirmar Pedido por WhatsApp</h3>
              <button onClick={() => setShowCheckout(false)} className="text-stone-400 hover:text-stone-600 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleSendWhatsAppOrder} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Tu Nombre Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Laura Martínez"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm font-semibold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Tu Celular / WhatsApp *</label>
                <input
                  type="tel"
                  required
                  placeholder="Ej: 3123456789"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Método de Entrega</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDeliveryMethod('DOMICILIO')}
                    className={`py-2 rounded-xl border text-xs font-bold transition ${
                      deliveryMethod === 'DOMICILIO' ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-stone-50 border-stone-200 text-stone-700'
                    }`}
                  >
                    Domicilio en el barrio
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryMethod('RECOGER_EN_TIENDA')}
                    className={`py-2 rounded-xl border text-xs font-bold transition ${
                      deliveryMethod === 'RECOGER_EN_TIENDA' ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-stone-50 border-stone-200 text-stone-700'
                    }`}
                  >
                    Recoger en la tienda
                  </button>
                </div>
              </div>

              {deliveryMethod === 'DOMICILIO' && (
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Dirección y Barrio para la entrega *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Calle 20 # 5-14 Casa 3, Barrio La Floresta"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">¿Cómo pagarás al recibir?</label>
                <select
                  value={paymentPref}
                  onChange={(e) => setPaymentPref(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-semibold"
                >
                  <option value="Efectivo contra entrega">Efectivo contra entrega</option>
                  <option value="Nequi al recibir">Nequi al recibir</option>
                  <option value="Daviplata al recibir">Daviplata al recibir</option>
                  <option value="Datáfono / Tarjeta">Datáfono en domicilio</option>
                </select>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 leading-tight">
                * El pedido será enviado directamente al WhatsApp de la tienda. El pago se realiza contra entrega según tu preferencia.
              </div>

              <div className="flex gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowCheckout(false)}
                  className="flex-1 py-2.5 border border-stone-300 text-stone-700 text-xs font-semibold rounded-xl"
                >
                  Volver
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingOrder}
                  className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar Pedido WhatsApp</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
