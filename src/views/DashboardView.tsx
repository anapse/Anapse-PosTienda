import React, { useEffect, useState } from 'react';
import { useAuth } from '../firebase/authContext';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import { collection, query, where, getDocs, onSnapshot, setDoc, doc } from 'firebase/firestore';
import { Sale, Product, Customer, CashShift } from '../types';
import { formatCOP } from '../utils/currency';
import { seedBusinessSampleData } from '../utils/sampleData';
import { 
  DollarSign, 
  TrendingUp, 
  ShoppingBag, 
  AlertTriangle, 
  Users, 
  CircleDollarSign, 
  PlusCircle, 
  Boxes, 
  ArrowUpRight, 
  Sparkles,
  PackageCheck
} from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (view: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { currentBusiness, activeShift } = useAuth();

  const [loading, setLoading] = useState(true);
  const [salesToday, setSalesToday] = useState<number>(0);
  const [salesMonth, setSalesMonth] = useState<number>(0);
  const [transactionsCount, setTransactionsCount] = useState<number>(0);
  const [grossProfit, setGrossProfit] = useState<number>(0);
  const [totalDebts, setTotalDebts] = useState<number>(0);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; quantity: number; revenue: number }[]>([]);
  const [productsCount, setProductsCount] = useState<number>(0);
  const [isSeeding, setIsSeeding] = useState(false);

  useEffect(() => {
    if (!currentBusiness) return;

    setLoading(true);

    // 1. Fetch sales
    const salesRef = collection(db, `businesses/${currentBusiness.id}/sales`);
    const unsubSales = onSnapshot(salesRef, (snapshot) => {
      const allSales: Sale[] = [];
      snapshot.forEach(docSnap => {
        allSales.push({ id: docSnap.id, ...docSnap.data() } as Sale);
      });

      calculateSalesMetrics(allSales);
    }, (error) => {
      console.warn('Sales listener error:', error);
    });

    // 2. Fetch products & inventory alerts
    const productsRef = collection(db, `businesses/${currentBusiness.id}/products`);
    const unsubProducts = onSnapshot(productsRef, (snapshot) => {
      const products: Product[] = [];
      snapshot.forEach(docSnap => {
        products.push({ id: docSnap.id, ...docSnap.data() } as Product);
      });

      setProductsCount(products.length);
      const lowStock = products.filter(p => p.active && p.stock <= p.minStock);
      setLowStockProducts(lowStock);
      setLoading(false);
    }, (error) => {
      console.warn('Products listener error:', error);
      setLoading(false);
    });

    // 3. Fetch customers and pending debts
    const customersRef = collection(db, `businesses/${currentBusiness.id}/customers`);
    const unsubCustomers = onSnapshot(customersRef, (snapshot) => {
      let pendingDebtSum = 0;
      snapshot.forEach(docSnap => {
        const c = docSnap.data() as Customer;
        if (c.currentDebt > 0) {
          pendingDebtSum += c.currentDebt;
        }
      });
      setTotalDebts(pendingDebtSum);
    }, (error) => {
      console.warn('Customers listener error:', error);
    });

    return () => {
      unsubSales();
      unsubProducts();
      unsubCustomers();
    };
  }, [currentBusiness]);

  const calculateSalesMetrics = (sales: Sale[]) => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    let todayTotal = 0;
    let monthTotal = 0;
    let totalProfit = 0;
    let validTxCount = 0;

    const productSalesMap = new Map<string, { quantity: number; revenue: number }>();

    sales.forEach(sale => {
      if (sale.status === 'CANCELLED') return;

      const saleTime = new Date(sale.createdAt).getTime();

      if (saleTime >= startOfToday) {
        todayTotal += sale.total;
        validTxCount += 1;
      }

      if (saleTime >= startOfMonth) {
        monthTotal += sale.total;
        totalProfit += (sale.grossProfit || 0);
      }

      // Aggregate top products
      if (sale.items) {
        sale.items.forEach(item => {
          const current = productSalesMap.get(item.name) || { quantity: 0, revenue: 0 };
          productSalesMap.set(item.name, {
            quantity: current.quantity + item.quantity,
            revenue: current.revenue + item.total,
          });
        });
      }
    });

    setSalesToday(todayTotal);
    setSalesMonth(monthTotal);
    setTransactionsCount(validTxCount);
    setGrossProfit(totalProfit);

    const sortedTop = Array.from(productSalesMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    setTopProducts(sortedTop);
  };

  const handleSeedDemoData = async () => {
    if (!currentBusiness) return;
    setIsSeeding(true);
    try {
      await seedBusinessSampleData(currentBusiness.id);
      alert('¡Catálogo inicial de Colombia y proveedores cargados con éxito!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `businesses/${currentBusiness.id}/products`);
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner / Welcome */}
      <div className="bg-linear-to-r from-emerald-800 to-teal-800 text-white rounded-2xl p-5 sm:p-7 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs bg-amber-400 text-emerald-950 font-bold px-2 py-0.5 rounded-full uppercase">
                Panel de Control
              </span>
              <span className="text-xs text-emerald-200">Moneda: Peso Colombiano (COP)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {currentBusiness?.name || 'Mi Comercio'}
            </h1>
            <p className="text-sm text-emerald-100 mt-1">
              NIT: {currentBusiness?.nit || 'No registrado'} • {currentBusiness?.city || 'Colombia'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => onNavigate('pos')}
              className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-emerald-950 font-bold px-4 py-2.5 rounded-xl shadow-md transition active:scale-95"
            >
              <PlusCircle className="w-5 h-5" />
              <span>Nueva Venta</span>
            </button>
            <button
              onClick={() => onNavigate('cash')}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-medium px-4 py-2.5 rounded-xl backdrop-blur-xs transition"
            >
              <CircleDollarSign className="w-5 h-5 text-amber-300" />
              <span>{activeShift ? 'Caja Diaria' : 'Abrir Caja'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* First-time setup banner if 0 products */}
      {productsCount === 0 && !loading && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-amber-100 rounded-xl text-amber-800">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-amber-900 text-base">¿Comenzando tu tienda en Colombia?</h3>
              <p className="text-xs sm:text-sm text-amber-800 mt-0.5">
                Puedes cargar productos populares colombianos (Arroz Diana, Leche Colanta, Café Sello Rojo, Huevos AA, Pan Bimbo, Gaseosas y Proveedores) con un solo clic.
              </p>
            </div>
          </div>
          <button
            onClick={handleSeedDemoData}
            disabled={isSeeding}
            className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold px-4 py-2.5 rounded-xl whitespace-nowrap shadow-sm transition active:scale-95"
          >
            <PackageCheck className="w-4 h-4" />
            <span>{isSeeding ? 'Cargando...' : 'Cargar Productos de Ejemplo'}</span>
          </button>
        </div>
      )}

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Ventas Hoy */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Ventas de Hoy</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-stone-900 mt-2">
            {formatCOP(salesToday)}
          </p>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-stone-500">
            <span className="font-medium text-emerald-700">{transactionsCount}</span>
            <span>transacciones registradas hoy</span>
          </div>
        </div>

        {/* Ventas del Mes */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Ventas del Mes</span>
            <div className="p-2 rounded-xl bg-teal-50 text-teal-700">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-stone-900 mt-2">
            {formatCOP(salesMonth)}
          </p>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-stone-500">
            <span>Mes actual en curso</span>
          </div>
        </div>

        {/* Ganancia Bruta Estimada */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Ganancia Bruta Real</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-700">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-blue-700 mt-2">
            {formatCOP(grossProfit)}
          </p>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-stone-500">
            <span>Ventas menos costo de compra</span>
          </div>
        </div>

        {/* Fiados / Cuentas por Cobrar */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Cuentas Fiadas (Deudas)</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-amber-600 mt-2">
            {formatCOP(totalDebts)}
          </p>
          <div className="flex items-center justify-between mt-2 text-xs">
            <span className="text-stone-500">Pendiente de cobro</span>
            <button
              onClick={() => onNavigate('customers')}
              className="text-amber-700 font-semibold hover:underline"
            >
              Ver clientes &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* Secondary Metrics & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Productos con poco inventario & Top Productos */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Alertas de Poco Stock */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <AlertTriangle className={`w-5 h-5 ${lowStockProducts.length > 0 ? 'text-amber-500' : 'text-stone-400'}`} />
                <h2 className="font-bold text-stone-900 text-base">Alertas de Inventario Bajo</h2>
                {lowStockProducts.length > 0 && (
                  <span className="text-xs bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                    {lowStockProducts.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => onNavigate('inventory')}
                className="text-xs text-emerald-700 font-semibold hover:underline"
              >
                Ir a Inventario &rarr;
              </button>
            </div>

            <div className="mt-4">
              {lowStockProducts.length === 0 ? (
                <div className="py-6 text-center text-stone-400 text-sm">
                  <Boxes className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Todos los productos tienen existencias suficientes.</p>
                </div>
              ) : (
                <div className="divide-y divide-stone-100">
                  {lowStockProducts.slice(0, 5).map(prod => (
                    <div key={prod.id} className="py-2.5 flex items-center justify-between text-sm">
                      <div>
                        <p className="font-semibold text-stone-800">{prod.name}</p>
                        <p className="text-xs text-stone-500">Categoría: {prod.category} • Mínimo: {prod.minStock}</p>
                      </div>
                      <div className="text-right">
                        <span className={`inline-block font-bold px-2.5 py-1 rounded-lg text-xs ${
                          prod.stock <= 0 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {prod.stock <= 0 ? 'AGOTADO' : `${prod.stock} ${prod.unit}s`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Productos Más Vendidos */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-emerald-600" />
                <h2 className="font-bold text-stone-900 text-base">Productos Más Vendidos</h2>
              </div>
              <button
                onClick={() => onNavigate('reports')}
                className="text-xs text-emerald-700 font-semibold hover:underline"
              >
                Ver reportes completos &rarr;
              </button>
            </div>

            <div className="mt-4">
              {topProducts.length === 0 ? (
                <div className="py-6 text-center text-stone-400 text-sm">
                  <p>No hay ventas registradas aún para calcular estadísticas.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {topProducts.map((item, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-stone-100 text-stone-700 font-bold text-xs flex items-center justify-center">
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-medium text-stone-800">{item.name}</p>
                          <p className="text-xs text-stone-400">{item.quantity} unidades vendidas</p>
                        </div>
                      </div>
                      <span className="font-bold text-emerald-700">{formatCOP(item.revenue)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Estado de Caja Diaria & Enlaces Rápidos */}
        <div className="space-y-6">
          {/* Caja Diaria Card */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <span className="font-bold text-stone-900 text-base">Caja Diaria</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                activeShift ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-600'
              }`}>
                {activeShift ? 'ABIERTA' : 'CERRADA'}
              </span>
            </div>

            <div className="py-4 space-y-3 text-sm">
              <div className="flex justify-between text-stone-600">
                <span>Base inicial:</span>
                <span className="font-medium">{formatCOP(activeShift?.initialCash || 0)}</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>Ventas en efectivo hoy:</span>
                <span className="font-medium">{formatCOP(activeShift?.cashSales || 0)}</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>Ventas digitales (Nequi/etc):</span>
                <span className="font-medium">
                  {formatCOP(
                    (activeShift?.nequiSales || 0) +
                    (activeShift?.daviplataSales || 0) +
                    (activeShift?.transferSales || 0) +
                    (activeShift?.cardSales || 0)
                  )}
                </span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>Gastos menores pagados:</span>
                <span className="font-medium text-rose-600">-{formatCOP(activeShift?.cashOut || 0)}</span>
              </div>
              <div className="pt-2 border-t border-stone-200 flex justify-between font-bold text-base text-stone-900">
                <span>Efectivo esperado en caja:</span>
                <span className="text-emerald-700">
                  {formatCOP(activeShift ? activeShift.expectedCash : 0)}
                </span>
              </div>
            </div>

            <button
              onClick={() => onNavigate('cash')}
              className="w-full mt-2 py-2.5 px-4 bg-stone-900 hover:bg-stone-800 text-white font-medium rounded-xl text-xs sm:text-sm text-center transition"
            >
              {activeShift ? 'Gestionar Caja y Cierre' : 'Abrir Turno de Caja'}
            </button>
          </div>

          {/* Acciones Rápidas */}
          <div className="bg-stone-50 rounded-2xl p-5 border border-stone-200">
            <h3 className="font-bold text-stone-800 text-sm mb-3">Acciones Rápidas</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onNavigate('pos')}
                className="p-3 bg-white hover:bg-emerald-50 border border-stone-200 rounded-xl text-left transition"
              >
                <ShoppingBag className="w-5 h-5 text-emerald-600 mb-1" />
                <p className="font-bold text-xs text-stone-900">Vender (POS)</p>
                <p className="text-[10px] text-stone-500">Caja rápida</p>
              </button>

              <button
                onClick={() => onNavigate('products')}
                className="p-3 bg-white hover:bg-emerald-50 border border-stone-200 rounded-xl text-left transition"
              >
                <Boxes className="w-5 h-5 text-emerald-600 mb-1" />
                <p className="font-bold text-xs text-stone-900">Productos</p>
                <p className="text-[10px] text-stone-500">Nuevo / Editar</p>
              </button>

              <button
                onClick={() => onNavigate('customers')}
                className="p-3 bg-white hover:bg-amber-50 border border-stone-200 rounded-xl text-left transition"
              >
                <Users className="w-5 h-5 text-amber-600 mb-1" />
                <p className="font-bold text-xs text-stone-900">Fiados</p>
                <p className="text-[10px] text-stone-500">Registrar abono</p>
              </button>

              <button
                onClick={() => onNavigate('catalog')}
                className="p-3 bg-white hover:bg-teal-50 border border-stone-200 rounded-xl text-left transition"
              >
                <ArrowUpRight className="w-5 h-5 text-teal-600 mb-1" />
                <p className="font-bold text-xs text-stone-900">Catálogo Web</p>
                <p className="text-[10px] text-stone-500">Ver tienda pública</p>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
