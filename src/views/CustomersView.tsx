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
import { Customer, CustomerMovement, PaymentMethod } from '../types';
import { formatCOP } from '../utils/currency';
import { formatColombianDate } from '../utils/date';
import { downloadCSV } from '../utils/exportCsv';
import { 
  Users, 
  Search, 
  Plus, 
  Smartphone, 
  DollarSign, 
  CreditCard, 
  FileText, 
  CheckCircle, 
  AlertCircle,
  Download,
  Share2
} from 'lucide-react';

export const CustomersView: React.FC = () => {
  const { currentBusiness, user, activeShift } = useAuth();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDebtOnly, setFilterDebtOnly] = useState(false);

  // Selected customer for Statement modal
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [movements, setMovements] = useState<CustomerMovement[]>([]);

  // Modals
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerForm, setCustomerForm] = useState({
    name: '',
    documentType: 'CC',
    documentNumber: '',
    phone: '',
    address: '',
    neighborhood: '',
    creditLimit: 100000,
    notes: '',
  });

  const [showAbonoModal, setShowAbonoModal] = useState(false);
  const [abonoAmount, setAbonoAmount] = useState<number>(0);
  const [abonoMethod, setAbonoMethod] = useState<PaymentMethod>('cash');
  const [abonoNotes, setAbonoNotes] = useState('');
  const [isSubmittingAbono, setIsSubmittingAbono] = useState(false);

  useEffect(() => {
    if (!currentBusiness) return;

    const custRef = collection(db, `businesses/${currentBusiness.id}/customers`);
    const unsub = onSnapshot(custRef, (snapshot) => {
      const items: Customer[] = [];
      snapshot.forEach(docSnap => {
        items.push({ id: docSnap.id, ...docSnap.data() } as Customer);
      });
      items.sort((a, b) => b.currentDebt - a.currentDebt);
      setCustomers(items);
      setLoading(false);
    }, (err) => {
      console.warn('Error loading customers:', err);
      setLoading(false);
    });

    return () => unsub();
  }, [currentBusiness]);

  // Load movements for selected customer
  useEffect(() => {
    if (!currentBusiness || !selectedCustomer) {
      setMovements([]);
      return;
    }

    const movRef = collection(db, `businesses/${currentBusiness.id}/customerMovements`);
    const unsub = onSnapshot(movRef, (snapshot) => {
      const items: CustomerMovement[] = [];
      snapshot.forEach(docSnap => {
        const d = { id: docSnap.id, ...docSnap.data() } as CustomerMovement;
        if (d.customerId === selectedCustomer.id) {
          items.push(d);
        }
      });
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setMovements(items);
    }, (err) => {
      console.warn('Error loading customer movements:', err);
    });

    return () => unsub();
  }, [currentBusiness, selectedCustomer]);

  // Total debt across all customers
  const totalFiados = customers.reduce((sum, c) => sum + (c.currentDebt || 0), 0);
  const debtorCount = customers.filter(c => c.currentDebt > 0).length;

  const filteredCustomers = customers.filter(c => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = 
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.includes(q)) ||
      (c.documentNumber && c.documentNumber.includes(q)) ||
      (c.neighborhood && c.neighborhood.toLowerCase().includes(q));

    const matchesDebt = !filterDebtOnly || c.currentDebt > 0;
    return matchesSearch && matchesDebt;
  });

  const openCreateModal = () => {
    setEditingCustomer(null);
    setCustomerForm({
      name: '',
      documentType: 'CC',
      documentNumber: '',
      phone: '',
      address: '',
      neighborhood: '',
      creditLimit: 100000,
      notes: '',
    });
    setShowCustomerModal(true);
  };

  const openEditModal = (c: Customer) => {
    setEditingCustomer(c);
    setCustomerForm({
      name: c.name,
      documentType: c.documentType || 'CC',
      documentNumber: c.documentNumber || '',
      phone: c.phone || '',
      address: c.address || '',
      neighborhood: c.neighborhood || '',
      creditLimit: c.creditLimit || 100000,
      notes: c.notes || '',
    });
    setShowCustomerModal(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBusiness) return;
    if (!customerForm.name.trim()) {
      alert('El nombre del cliente es obligatorio.');
      return;
    }

    const custId = editingCustomer ? editingCustomer.id : `cust_${Date.now()}`;
    const nowIso = new Date().toISOString();

    const payload: Customer = {
      id: custId,
      businessId: currentBusiness.id,
      name: customerForm.name.trim(),
      documentType: customerForm.documentType as any,
      documentNumber: customerForm.documentNumber.trim(),
      phone: customerForm.phone.trim(),
      address: customerForm.address.trim(),
      neighborhood: customerForm.neighborhood.trim(),
      creditLimit: Number(customerForm.creditLimit) || 0,
      currentDebt: editingCustomer ? editingCustomer.currentDebt : 0,
      notes: customerForm.notes.trim(),
      createdAt: editingCustomer ? editingCustomer.createdAt : nowIso,
    };

    try {
      await setDoc(doc(db, `businesses/${currentBusiness.id}/customers`, custId), payload);
      setShowCustomerModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `businesses/${currentBusiness.id}/customers/${custId}`);
    }
  };

  // Register Abono (Debt payment)
  const handleRegisterAbono = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !currentBusiness || !user) return;
    if (abonoAmount <= 0) {
      alert('El monto del abono debe ser mayor a $0.');
      return;
    }

    setIsSubmittingAbono(true);
    const nowIso = new Date().toISOString();
    const movId = `cmov_${Date.now()}`;

    try {
      await runTransaction(db, async (transaction) => {
        const custRef = doc(db, `businesses/${currentBusiness.id}/customers`, selectedCustomer.id);
        const custSnap = await transaction.get(custRef);
        if (!custSnap.exists()) throw new Error('Cliente no encontrado');

        const prevDebt = custSnap.data().currentDebt || 0;
        const newDebt = Math.max(0, prevDebt - abonoAmount);

        transaction.update(custRef, { currentDebt: newDebt });

        // Record customer debt movement
        const movRef = doc(db, `businesses/${currentBusiness.id}/customerMovements`, movId);
        transaction.set(movRef, {
          id: movId,
          businessId: currentBusiness.id,
          customerId: selectedCustomer.id,
          type: 'PAYMENT',
          amount: abonoAmount,
          previousDebt: prevDebt,
          newDebt,
          paymentMethod: abonoMethod,
          notes: abonoNotes.trim() || 'Abono a la cuenta de fiado',
          userId: user.uid,
          userName: user.displayName || 'Cajero',
          createdAt: nowIso,
        });

        // If shift is open, update cash shift
        if (activeShift) {
          const shiftRef = doc(db, `businesses/${currentBusiness.id}/cashShifts`, activeShift.id);
          const shiftSnap = await transaction.get(shiftRef);
          if (shiftSnap.exists()) {
            const shiftData = shiftSnap.data();
            if (abonoMethod === 'cash') {
              const newCashIn = (shiftData.cashIn || 0) + abonoAmount;
              const newExpected = (shiftData.expectedCash || 0) + abonoAmount;
              transaction.update(shiftRef, { cashIn: newCashIn, expectedCash: newExpected });
            }
          }
        }
      });

      setShowAbonoModal(false);
      setAbonoAmount(0);
      setAbonoNotes('');
      // Update selectedCustomer local state
      setSelectedCustomer(prev => prev ? { ...prev, currentDebt: Math.max(0, prev.currentDebt - abonoAmount) } : null);
      alert('¡Abono registrado con éxito!');
    } catch (err: any) {
      console.error('Error registering abono:', err);
      alert('Error al registrar el abono.');
    } finally {
      setIsSubmittingAbono(false);
    }
  };

  // WhatsApp statement share
  const handleShareWhatsAppStatement = (c: Customer) => {
    const phone = c.phone ? c.phone.replace(/\D/g, '') : '';
    const cleanPhone = phone.startsWith('57') ? phone : `57${phone}`;

    let msg = `*ESTADO DE CUENTA - ${currentBusiness?.name}*\n`;
    msg += `Estimado(a) ${c.name},\n`;
    msg += `Le enviamos un cordial saludo. Le recordamos el resumen de su cuenta de fiado:\n`;
    msg += `--------------------------------\n`;
    msg += `*SALDO PENDIENTE ACTUAL: ${formatCOP(c.currentDebt)}*\n`;
    msg += `Cupo asignado: ${formatCOP(c.creditLimit)}\n`;
    msg += `--------------------------------\n`;
    msg += `Agradecemos su puntual abono. Puede cancelar en el local en efectivo o por Nequi/Daviplata.\n`;
    msg += `¡Muchas gracias por su preferencia!`;

    const url = phone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const handleExportCustomersCSV = () => {
    const rows = filteredCustomers.map(c => ({
      'Nombre': c.name,
      'Tipo Doc': c.documentType || 'CC',
      'Documento': c.documentNumber || '',
      'Teléfono': c.phone || '',
      'Barrio': c.neighborhood || '',
      'Dirección': c.address || '',
      'Cupo de Crédito (COP)': c.creditLimit,
      'Saldo Pendiente Fiado (COP)': c.currentDebt,
      'Observaciones': c.notes || ''
    }));
    downloadCSV(`clientes_fiado_${currentBusiness?.name || 'tienda'}`, rows);
  };

  return (
    <div className="space-y-5 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-700" />
            <h1 className="text-2xl font-black text-stone-900 tracking-tight">El Cuaderno de Fiados y Clientes</h1>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Gestión de clientes, cupos de crédito, deudas acumuladas y registro de abonos parciales.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCustomersCSV}
            disabled={customers.length === 0}
            className="flex items-center gap-1.5 bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 font-semibold px-3 py-2 rounded-xl text-xs shadow-xs transition"
          >
            <Download className="w-3.5 h-3.5 text-stone-500" />
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 py-2 rounded-xl text-xs sm:text-sm shadow-sm transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Cliente</span>
          </button>
        </div>
      </div>

      {/* KPI Banners */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 shadow-xs">
          <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Total por Cobrar (Fiado)</span>
          <p className="text-2xl sm:text-3xl font-extrabold text-amber-700 mt-1">{formatCOP(totalFiados)}</p>
          <p className="text-[11px] text-amber-900 mt-1">{debtorCount} clientes tienen saldo pendiente</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Total Clientes Registrados</span>
          <p className="text-2xl sm:text-3xl font-extrabold text-stone-900 mt-1">{customers.length}</p>
          <p className="text-[11px] text-stone-400 mt-1">Directorio de vecinos y compradores</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-center">
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Recordatorio por WhatsApp</span>
          <p className="text-xs text-stone-600 mt-1">
            Puedes enviar el extracto de cuenta al WhatsApp del cliente con un solo clic.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar por nombre, teléfono, barrio o cédula..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterDebtOnly(!filterDebtOnly)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              filterDebtOnly
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Solo con Deuda ({debtorCount})</span>
          </button>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-stone-400 text-sm">Cargando clientes...</div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-12 text-center text-stone-400 space-y-2">
            <Users className="w-10 h-10 mx-auto text-stone-300" />
            <p className="font-semibold text-stone-600">No hay clientes que coincidan con la búsqueda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 text-xs font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3.5">Cliente</th>
                  <th className="p-3.5">Teléfono / WhatsApp</th>
                  <th className="p-3.5">Barrio / Dirección</th>
                  <th className="p-3.5 text-right">Cupo Límite</th>
                  <th className="p-3.5 text-right">Deuda Pendiente</th>
                  <th className="p-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredCustomers.map(c => {
                  const hasDebt = c.currentDebt > 0;
                  return (
                    <tr key={c.id} className={`hover:bg-stone-50 transition ${hasDebt ? 'bg-amber-50/20' : ''}`}>
                      <td className="p-3.5">
                        <p className="font-bold text-stone-900">{c.name}</p>
                        <p className="text-[11px] text-stone-400">
                          {c.documentType || 'CC'}: {c.documentNumber || 'Sin registrar'}
                        </p>
                      </td>
                      <td className="p-3.5 text-stone-600 font-medium">
                        {c.phone ? (
                          <span className="flex items-center gap-1">
                            <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                            {c.phone}
                          </span>
                        ) : (
                          <span className="text-stone-300">No registrado</span>
                        )}
                      </td>
                      <td className="p-3.5 text-stone-600">
                        <p className="truncate max-w-xs">{c.address || c.neighborhood || 'Local'}</p>
                        {c.neighborhood && <p className="text-[10px] text-stone-400">Barrio: {c.neighborhood}</p>}
                      </td>
                      <td className="p-3.5 text-right font-medium text-stone-500">
                        {formatCOP(c.creditLimit)}
                      </td>
                      <td className="p-3.5 text-right">
                        <span className={`inline-block font-black text-sm ${
                          hasDebt ? 'text-amber-600' : 'text-stone-400'
                        }`}>
                          {formatCOP(c.currentDebt)}
                        </span>
                      </td>
                      <td className="p-3.5 text-right whitespace-nowrap space-x-1.5">
                        <button
                          onClick={() => setSelectedCustomer(c)}
                          className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold"
                          title="Ver estado de cuenta"
                        >
                          Cuenta
                        </button>

                        {hasDebt && (
                          <button
                            onClick={() => {
                              setSelectedCustomer(c);
                              setAbonoAmount(c.currentDebt);
                              setShowAbonoModal(true);
                            }}
                            className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-2xs"
                            title="Registrar abono de dinero"
                          >
                            Abonar
                          </button>
                        )}

                        {c.phone && hasDebt && (
                          <button
                            onClick={() => handleShareWhatsAppStatement(c)}
                            className="p-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition"
                            title="Cobrar / Enviar recordatorio por WhatsApp"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          onClick={() => openEditModal(c)}
                          className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg"
                        >
                          ✎
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Customer Create/Edit Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <h3 className="font-extrabold text-stone-900 text-lg">
                {editingCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}
              </h3>
              <button
                onClick={() => setShowCustomerModal(false)}
                className="text-stone-400 hover:text-stone-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Nombre y Apellidos *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Doña Carmen Rosas"
                  value={customerForm.name}
                  onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm font-medium"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Tipo Doc</label>
                  <select
                    value={customerForm.documentType}
                    onChange={(e) => setCustomerForm({ ...customerForm, documentType: e.target.value })}
                    className="w-full px-2 py-2 border border-stone-300 rounded-xl text-xs"
                  >
                    <option value="CC">CC</option>
                    <option value="NIT">NIT</option>
                    <option value="CE">CE</option>
                    <option value="Pasaporte">Pasaporte</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-bold text-stone-700 block mb-1">Número de Documento</label>
                  <input
                    type="text"
                    placeholder="Ej: 52.123.456"
                    value={customerForm.documentNumber}
                    onChange={(e) => setCustomerForm({ ...customerForm, documentNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Celular / WhatsApp</label>
                  <input
                    type="tel"
                    placeholder="3101234567"
                    value={customerForm.phone}
                    onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Cupo Máximo Fiado</label>
                  <input
                    type="number"
                    step="5000"
                    value={customerForm.creditLimit}
                    onChange={(e) => setCustomerForm({ ...customerForm, creditLimit: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-bold text-emerald-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Barrio</label>
                  <input
                    type="text"
                    placeholder="Ej: San Antonio"
                    value={customerForm.neighborhood}
                    onChange={(e) => setCustomerForm({ ...customerForm, neighborhood: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Dirección / Casa</label>
                  <input
                    type="text"
                    placeholder="Ej: Calle 15 # 4-20"
                    value={customerForm.address}
                    onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Notas internas</label>
                <input
                  type="text"
                  placeholder="Ej: Paga quincenas, familiar de Don Jorge..."
                  value={customerForm.notes}
                  onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowCustomerModal(false)}
                  className="flex-1 py-2 border border-stone-300 text-stone-700 text-xs font-semibold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl"
                >
                  Guardar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Account Statement Modal */}
      {selectedCustomer && !showAbonoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 space-y-4 max-h-[90vh] flex flex-col">
            
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div>
                <h3 className="font-extrabold text-stone-900 text-base sm:text-lg">
                  Estado de Cuenta: {selectedCustomer.name}
                </h3>
                <p className="text-xs text-stone-500">
                  {selectedCustomer.phone && `Tel: ${selectedCustomer.phone} • `} 
                  Cupo asignado: {formatCOP(selectedCustomer.creditLimit)}
                </p>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-stone-400 hover:text-stone-600 text-base font-bold"
              >
                ✕
              </button>
            </div>

            {/* Current Debt Highlight */}
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-amber-800 uppercase">Saldo Pendiente (Deuda Actual):</span>
                <p className="text-2xl font-black text-amber-700">{formatCOP(selectedCustomer.currentDebt)}</p>
              </div>
              {selectedCustomer.currentDebt > 0 && (
                <button
                  onClick={() => {
                    setAbonoAmount(selectedCustomer.currentDebt);
                    setShowAbonoModal(true);
                  }}
                  className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs"
                >
                  Registrar Abono
                </button>
              )}
            </div>

            {/* Movements history */}
            <div className="flex-1 overflow-y-auto space-y-2 border border-stone-200 rounded-xl p-3 bg-stone-50">
              <span className="text-xs font-bold text-stone-700 uppercase block mb-1">
                Historial de Deudas y Abonos:
              </span>

              {movements.length === 0 ? (
                <p className="text-xs text-stone-400 text-center py-4">No hay movimientos registrados.</p>
              ) : (
                movements.map(m => {
                  const isPayment = m.type === 'PAYMENT';
                  return (
                    <div key={m.id} className="p-2.5 bg-white rounded-lg border border-stone-200 flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className={`font-bold px-1.5 py-0.2 rounded text-[10px] ${
                            isPayment ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {isPayment ? 'ABONO (-)' : 'FIADO (+)'}
                          </span>
                          <span className="text-stone-500">{formatColombianDate(m.createdAt)}</span>
                        </div>
                        <p className="text-stone-700 mt-0.5">{m.notes}</p>
                        <p className="text-[10px] text-stone-400">
                          Saldo antes: {formatCOP(m.previousDebt)} &rarr; Nuevo saldo: {formatCOP(m.newDebt)}
                        </p>
                      </div>
                      <span className={`text-sm font-extrabold ${isPayment ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {isPayment ? `-${formatCOP(m.amount)}` : `+${formatCOP(m.amount)}`}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex gap-2 pt-2 border-t border-stone-200">
              {selectedCustomer.phone && selectedCustomer.currentDebt > 0 && (
                <button
                  onClick={() => handleShareWhatsAppStatement(selectedCustomer)}
                  className="flex-1 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Enviar por WhatsApp</span>
                </button>
              )}
              <button
                onClick={() => setSelectedCustomer(null)}
                className="py-2 px-4 border border-stone-300 text-stone-700 text-xs font-semibold rounded-xl"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Abono Modal */}
      {showAbonoModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <h3 className="font-extrabold text-stone-900 text-base">Registrar Abono a Fiado</h3>
              <button
                onClick={() => setShowAbonoModal(false)}
                className="text-stone-400 hover:text-stone-600 text-base font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegisterAbono} className="space-y-3">
              <div>
                <span className="text-xs text-stone-500">Cliente:</span>
                <p className="font-bold text-stone-900">{selectedCustomer.name}</p>
                <p className="text-xs text-amber-700 font-semibold">
                  Deuda pendiente actual: {formatCOP(selectedCustomer.currentDebt)}
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Monto del Abono en COP *</label>
                <input
                  type="number"
                  min="500"
                  step="500"
                  required
                  value={abonoAmount || ''}
                  onChange={(e) => setAbonoAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border-2 border-emerald-600 rounded-xl text-lg font-black text-emerald-800 text-center"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Medio de Pago</label>
                <select
                  value={abonoMethod}
                  onChange={(e) => setAbonoMethod(e.target.value as any)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-semibold"
                >
                  <option value="cash">Efectivo en caja</option>
                  <option value="nequi">Nequi</option>
                  <option value="daviplata">Daviplata</option>
                  <option value="transfer">Transferencia Bancaria</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Observación (opcional)</label>
                <input
                  type="text"
                  placeholder="Ej: Abono de quincena..."
                  value={abonoNotes}
                  onChange={(e) => setAbonoNotes(e.target.value)}
                  className="w-full px-3 py-1.5 border border-stone-300 rounded-xl text-xs"
                />
              </div>

              <div className="text-center text-xs text-stone-500 pt-1">
                Nuevo saldo tras este abono: <strong>{formatCOP(Math.max(0, selectedCustomer.currentDebt - abonoAmount))}</strong>
              </div>

              <div className="flex gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowAbonoModal(false)}
                  disabled={isSubmittingAbono}
                  className="flex-1 py-2 border border-stone-300 text-stone-700 text-xs font-semibold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAbono}
                  className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  {isSubmittingAbono ? 'Registrando...' : 'Confirmar Abono'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
