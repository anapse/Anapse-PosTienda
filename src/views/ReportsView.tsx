import React, { useState, useEffect } from 'react';
import { useAuth } from '../firebase/authContext';
import { db } from '../firebase/config';
import { collection, onSnapshot } from 'firebase/firestore';
import { Sale, CashShift, CashMovement, Purchase, Customer } from '../types';
import { formatCOP } from '../utils/currency';
import { downloadCSV } from '../utils/exportCsv';
import { 
  BarChart3, 
  Download, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  PieChart, 
  CreditCard, 
  Smartphone, 
  ShoppingBag,
  Users
} from 'lucide-react';

export const ReportsView: React.FC = () => {
  const { currentBusiness } = useAuth();

  const [sales, setSales] = useState<Sale[]>([]);
  const [shifts, setShifts] = useState<CashShift[]>([]);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  // Date Range filter
  const [period, setPeriod] = useState<'TODAY' | 'WEEK' | 'MONTH' | 'ALL'>('MONTH');

  useEffect(() => {
    if (!currentBusiness) return;

    // Load sales
    const unsubSales = onSnapshot(collection(db, `businesses/${currentBusiness.id}/sales`), (snap) => {
      const items: Sale[] = [];
      snap.forEach(d => items.push({ id: d.id, ...d.data() } as Sale));
      setSales(items);
      setLoading(false);
    });

    // Load cash movements
    const unsubMov = onSnapshot(collection(db, `businesses/${currentBusiness.id}/cashMovements`), (snap) => {
      const items: CashMovement[] = [];
      snap.forEach(d => items.push({ id: d.id, ...d.data() } as CashMovement));
      setMovements(items);
    });

    // Load purchases
    const unsubPurch = onSnapshot(collection(db, `businesses/${currentBusiness.id}/purchases`), (snap) => {
      const items: Purchase[] = [];
      snap.forEach(d => items.push({ id: d.id, ...d.data() } as Purchase));
      setPurchases(items);
    });

    // Load customers
    const unsubCust = onSnapshot(collection(db, `businesses/${currentBusiness.id}/customers`), (snap) => {
      const items: Customer[] = [];
      snap.forEach(d => items.push({ id: d.id, ...d.data() } as Customer));
      setCustomers(items);
    });

    return () => {
      unsubSales();
      unsubMov();
      unsubPurch();
      unsubCust();
    };
  }, [currentBusiness]);

  // Date Filtering
  const getFilterTimestamp = () => {
    const now = new Date();
    if (period === 'TODAY') {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    }
    if (period === 'WEEK') {
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).getTime();
    }
    if (period === 'MONTH') {
      return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    }
    return 0; // ALL
  };

  const minTime = getFilterTimestamp();

  // Valid Sales in Period
  const periodSales = sales.filter(s => {
    if (s.status === 'CANCELLED') return false;
    return new Date(s.createdAt).getTime() >= minTime;
  });

  // KPI Calculations
  const totalRevenue = periodSales.reduce((sum, s) => sum + s.total, 0);
  const totalCost = periodSales.reduce((sum, s) => sum + (s.costTotal || 0), 0);
  const grossProfit = totalRevenue - totalCost;
  const marginPercent = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : '0.0';

  // Payment Breakdown
  let cashTotal = 0;
  let nequiTotal = 0;
  let daviplataTotal = 0;
  let transferTotal = 0;
  let cardTotal = 0;
  let creditTotal = 0;

  periodSales.forEach(s => {
    s.payments.forEach(p => {
      if (p.method === 'cash') cashTotal += p.amount;
      else if (p.method === 'nequi') nequiTotal += p.amount;
      else if (p.method === 'daviplata') daviplataTotal += p.amount;
      else if (p.method === 'transfer') transferTotal += p.amount;
      else if (p.method === 'card') cardTotal += p.amount;
      else if (p.method === 'credit') creditTotal += p.amount;
    });
    if (s.pendingAmount > 0) {
      creditTotal += s.pendingAmount;
    }
  });

  // Expenses in period
  const periodExpenses = movements
    .filter(m => m.type === 'OUT' && new Date(m.createdAt).getTime() >= minTime)
    .reduce((sum, m) => sum + m.amount, 0);

  // Net Profit estimated (Gross profit - cash expenses)
  const netEstimatedProfit = grossProfit - periodExpenses;

  // Purchases in period
  const periodPurchases = purchases
    .filter(p => p.status !== 'CANCELLED' && new Date(p.createdAt).getTime() >= minTime)
    .reduce((sum, p) => sum + p.total, 0);

  // Total Outstanding fiados
  const totalCustomerDebt = customers.reduce((sum, c) => sum + (c.currentDebt || 0), 0);

  // Sales by Cashier
  const cashierMap = new Map<string, { count: number; total: number }>();
  periodSales.forEach(s => {
    const name = s.cashierName || 'Cajero';
    const cur = cashierMap.get(name) || { count: 0, total: 0 };
    cashierMap.set(name, { count: cur.count + 1, total: cur.total + s.total });
  });

  // Top Products in period
  const prodMap = new Map<string, { qty: number; total: number; profit: number }>();
  periodSales.forEach(s => {
    s.items.forEach(it => {
      const cur = prodMap.get(it.name) || { qty: 0, total: 0, profit: 0 };
      const itemProfit = it.total - ((it.costPrice || 0) * it.quantity);
      prodMap.set(it.name, {
        qty: cur.qty + it.quantity,
        total: cur.total + it.total,
        profit: cur.profit + itemProfit
      });
    });
  });

  const topProductsList = Array.from(prodMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  // Export Summary Report CSV
  const handleExportSummaryCSV = () => {
    const rows = [
      { 'Métrica': 'Período', 'Valor COP / Dato': period },
      { 'Métrica': 'Ventas Totales Brutas', 'Valor COP / Dato': totalRevenue },
      { 'Métrica': 'Costo de Mercancía Vendida', 'Valor COP / Dato': totalCost },
      { 'Métrica': 'Ganancia Bruta Real', 'Valor COP / Dato': grossProfit },
      { 'Métrica': 'Margen Bruto Porcentual', 'Valor COP / Dato': `${marginPercent}%` },
      { 'Métrica': 'Gastos Operativos Pagados', 'Valor COP / Dato': periodExpenses },
      { 'Métrica': 'Utilidad Operativa Estimada', 'Valor COP / Dato': netEstimatedProfit },
      { 'Métrica': 'Compras a Proveedores en el Período', 'Valor COP / Dato': periodPurchases },
      { 'Métrica': 'Total Cuentas por Cobrar (Fiados Activos)', 'Valor COP / Dato': totalCustomerDebt },
      { 'Métrica': 'Recaudado Efectivo Físico', 'Valor COP / Dato': cashTotal },
      { 'Métrica': 'Recaudado Nequi', 'Valor COP / Dato': nequiTotal },
      { 'Métrica': 'Recaudado Daviplata', 'Valor COP / Dato': daviplataTotal },
      { 'Métrica': 'Recaudado Transferencias', 'Valor COP / Dato': transferTotal },
      { 'Métrica': 'Recaudado Datáfono / Tarjetas', 'Valor COP / Dato': cardTotal },
      { 'Métrica': 'Ventas a Crédito (Fiado)', 'Valor COP / Dato': creditTotal },
    ];
    downloadCSV(`informe_financiero_${period.toLowerCase()}_${currentBusiness?.name || 'tienda'}`, rows);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-emerald-700" />
            <h1 className="text-2xl font-black text-stone-900 tracking-tight">Reportes Financieros y Ganancias</h1>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Informes detallados por fecha, medios de pago, ganancias brutas estimadas y gastos de caja en COP.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Period selector */}
          <div className="bg-white border border-stone-200 rounded-xl p-1 flex shadow-xs">
            {[
              { id: 'TODAY', label: 'Hoy' },
              { id: 'WEEK', label: 'Semana' },
              { id: 'MONTH', label: 'Este Mes' },
              { id: 'ALL', label: 'Histórico' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setPeriod(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  period === tab.id
                    ? 'bg-emerald-700 text-white'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportSummaryCSV}
            className="flex items-center gap-1.5 bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 font-semibold px-3 py-2 rounded-xl text-xs shadow-xs transition"
          >
            <Download className="w-3.5 h-3.5 text-stone-500" />
            <span>Exportar Informe</span>
          </button>
        </div>
      </div>

      {/* Main Financial KPI Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs">
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Ventas Realizadas</span>
          <p className="text-2xl font-black text-stone-900 mt-1">{formatCOP(totalRevenue)}</p>
          <p className="text-[11px] text-stone-400 mt-1">{periodSales.length} comprobantes de venta</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs">
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Costo Mercancía</span>
          <p className="text-2xl font-black text-stone-600 mt-1">{formatCOP(totalCost)}</p>
          <p className="text-[11px] text-stone-400 mt-1">Precio de compra a proveedores</p>
        </div>

        <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-200 shadow-xs">
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Ganancia Bruta Real</span>
          <p className="text-2xl font-black text-emerald-800 mt-1">{formatCOP(grossProfit)}</p>
          <p className="text-[11px] text-emerald-900 mt-1 font-semibold">Margen comercial: {marginPercent}%</p>
        </div>

        <div className="bg-blue-50 rounded-2xl p-5 border border-blue-200 shadow-xs">
          <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">Utilidad Neta Estimada</span>
          <p className="text-2xl font-black text-blue-800 mt-1">{formatCOP(netEstimatedProfit)}</p>
          <p className="text-[11px] text-blue-900 mt-1">Descontando gastos de caja ({formatCOP(periodExpenses)})</p>
        </div>
      </div>

      {/* Breakdown by Payment Method */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs">
        <div className="flex items-center gap-2 pb-3 border-b border-stone-100">
          <PieChart className="w-5 h-5 text-emerald-700" />
          <h2 className="font-extrabold text-stone-900 text-base">Ventas por Medio de Pago en el Período</h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-center">
            <span className="text-[11px] font-bold text-stone-500 block uppercase">Efectivo Físico</span>
            <p className="text-base font-black text-stone-900 mt-1">{formatCOP(cashTotal)}</p>
          </div>

          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-center">
            <span className="text-[11px] font-bold text-teal-700 block uppercase">Nequi</span>
            <p className="text-base font-black text-stone-900 mt-1">{formatCOP(nequiTotal)}</p>
          </div>

          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-center">
            <span className="text-[11px] font-bold text-rose-700 block uppercase">Daviplata</span>
            <p className="text-base font-black text-stone-900 mt-1">{formatCOP(daviplataTotal)}</p>
          </div>

          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-center">
            <span className="text-[11px] font-bold text-amber-700 block uppercase">Transferencias</span>
            <p className="text-base font-black text-stone-900 mt-1">{formatCOP(transferTotal)}</p>
          </div>

          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-center">
            <span className="text-[11px] font-bold text-blue-700 block uppercase">Datáfono</span>
            <p className="text-base font-black text-stone-900 mt-1">{formatCOP(cardTotal)}</p>
          </div>

          <div className="p-3 bg-amber-50 rounded-xl border border-amber-300 text-center">
            <span className="text-[11px] font-bold text-amber-800 block uppercase">Fiado (Crédito)</span>
            <p className="text-base font-black text-amber-700 mt-1">{formatCOP(creditTotal)}</p>
          </div>
        </div>
      </div>

      {/* Grid: Top Products & Sales by Cashier */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Top Products */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs">
          <div className="flex items-center gap-2 pb-3 border-b border-stone-100">
            <ShoppingBag className="w-5 h-5 text-emerald-700" />
            <h2 className="font-extrabold text-stone-900 text-base">Top 10 Productos Más Rentables</h2>
          </div>

          <div className="mt-4 divide-y divide-stone-100">
            {topProductsList.length === 0 ? (
              <p className="text-xs text-stone-400 text-center py-6">No hay datos en este período.</p>
            ) : (
              topProductsList.map((item, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-stone-100 text-stone-600 font-bold text-[11px] flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="font-bold text-stone-900">{item.name}</p>
                      <p className="text-stone-400 text-[10px]">{item.qty} vendidos</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-stone-900">{formatCOP(item.total)}</p>
                    <p className="text-emerald-700 font-semibold text-[10px]">Ganancia: +{formatCOP(item.profit)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Sales by Cashier & Debt Summary */}
        <div className="space-y-6">
          
          {/* Sales by Cashier */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs">
            <div className="flex items-center gap-2 pb-3 border-b border-stone-100">
              <Users className="w-5 h-5 text-emerald-700" />
              <h2 className="font-extrabold text-stone-900 text-base">Ventas por Cajero / Vendedor</h2>
            </div>

            <div className="mt-4 space-y-2">
              {Array.from(cashierMap.entries()).length === 0 ? (
                <p className="text-xs text-stone-400 text-center py-6">No hay ventas registradas.</p>
              ) : (
                Array.from(cashierMap.entries()).map(([name, data], idx) => (
                  <div key={idx} className="p-3 bg-stone-50 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-stone-900">{name}</p>
                      <p className="text-[10px] text-stone-500">{data.count} ventas atendidas</p>
                    </div>
                    <span className="text-sm font-extrabold text-emerald-700">{formatCOP(data.total)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Pending Receivables & Outflow info */}
          <div className="bg-amber-50/70 rounded-2xl p-5 border border-amber-200 space-y-2 text-xs">
            <h3 className="font-bold text-amber-900 text-sm">Resumen de Cuentas Pendientes</h3>
            <div className="flex justify-between text-stone-700">
              <span>Total Cuentas por Cobrar (Fiados activos):</span>
              <span className="font-extrabold text-amber-800">{formatCOP(totalCustomerDebt)}</span>
            </div>
            <div className="flex justify-between text-stone-700">
              <span>Compras de inventario en este período:</span>
              <span className="font-bold text-stone-900">{formatCOP(periodPurchases)}</span>
            </div>
            <div className="flex justify-between text-stone-700">
              <span>Gastos de caja en este período:</span>
              <span className="font-bold text-rose-700">{formatCOP(periodExpenses)}</span>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
