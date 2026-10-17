import React, { useState, useEffect } from 'react';
import { useAuth } from '../firebase/authContext';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc, 
  runTransaction 
} from 'firebase/firestore';
import { CashShift, CashMovement } from '../types';
import { formatCOP } from '../utils/currency';
import { formatColombianDate } from '../utils/date';
import { downloadCSV } from '../utils/exportCsv';
import { 
  CircleDollarSign, 
  Lock, 
  Unlock, 
  PlusCircle, 
  MinusCircle, 
  History, 
  AlertTriangle, 
  CheckCircle2,
  DollarSign,
  Smartphone,
  CreditCard,
  Download
} from 'lucide-react';

export const CashShiftView: React.FC = () => {
  const { currentBusiness, user, activeShift, setActiveShift } = useAuth();

  const [shifts, setShifts] = useState<CashShift[]>([]);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [loading, setLoading] = useState(true);

  // Open Shift Form
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [initialCashInput, setInitialCashInput] = useState<number>(50000); // 50k COP typical base
  const [isOpenSubmitting, setIsOpenSubmitting] = useState(false);

  // Close Shift Form
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [countedCashInput, setCountedCashInput] = useState<number>(0);
  const [closingNotes, setClosingNotes] = useState('');
  const [isCloseSubmitting, setIsCloseSubmitting] = useState(false);

  // Cash In/Out Movement Form
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [movementType, setMovementType] = useState<'IN' | 'OUT'>('OUT');
  const [movementCategory, setMovementCategory] = useState('Gastos menores / Aseo');
  const [movementAmount, setMovementAmount] = useState<number>(5000);
  const [movementDesc, setMovementDesc] = useState('');
  const [isMovementSubmitting, setIsMovementSubmitting] = useState(false);

  useEffect(() => {
    if (!currentBusiness) return;

    // Load shifts
    const shiftsRef = collection(db, `businesses/${currentBusiness.id}/cashShifts`);
    const unsubShifts = onSnapshot(shiftsRef, (snapshot) => {
      const items: CashShift[] = [];
      snapshot.forEach(docSnap => {
        items.push({ id: docSnap.id, ...docSnap.data() } as CashShift);
      });
      items.sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());
      setShifts(items);
      setLoading(false);
    }, (err) => {
      console.warn('Error loading shifts:', err);
      setLoading(false);
    });

    // Load cash movements if active shift
    if (activeShift) {
      const movRef = collection(db, `businesses/${currentBusiness.id}/cashMovements`);
      const unsubMov = onSnapshot(movRef, (snapshot) => {
        const items: CashMovement[] = [];
        snapshot.forEach(docSnap => {
          const m = { id: docSnap.id, ...docSnap.data() } as CashMovement;
          if (m.shiftId === activeShift.id) items.push(m);
        });
        items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setMovements(items);
      }, (err) => {
        console.warn('Error loading cash movements:', err);
      });

      return () => {
        unsubShifts();
        unsubMov();
      };
    }

    return () => unsubShifts();
  }, [currentBusiness, activeShift]);

  // Open Shift
  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBusiness || !user) return;

    setIsOpenSubmitting(true);
    const shiftId = `shift_${Date.now()}`;
    const nowIso = new Date().toISOString();

    const newShift: CashShift = {
      id: shiftId,
      businessId: currentBusiness.id,
      cashierId: user.uid,
      cashierName: user.displayName || 'Cajero',
      status: 'OPEN',
      openedAt: nowIso,
      initialCash: Number(initialCashInput) || 0,
      cashSales: 0,
      nequiSales: 0,
      daviplataSales: 0,
      transferSales: 0,
      cardSales: 0,
      creditSales: 0,
      cashIn: 0,
      cashOut: 0,
      expectedCash: Number(initialCashInput) || 0,
    };

    try {
      await setDoc(doc(db, `businesses/${currentBusiness.id}/cashShifts`, shiftId), newShift);
      setActiveShift(newShift);
      setShowOpenModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `businesses/${currentBusiness.id}/cashShifts/${shiftId}`);
    } finally {
      setIsOpenSubmitting(false);
    }
  };

  // Add Movement (Gasto / Ingreso)
  const handleAddMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBusiness || !user || !activeShift) return;
    if (movementAmount <= 0) {
      alert('El valor debe ser superior a $0.');
      return;
    }

    setIsMovementSubmitting(true);
    const movId = `cmov_${Date.now()}`;
    const nowIso = new Date().toISOString();

    try {
      await runTransaction(db, async (transaction) => {
        const shiftRef = doc(db, `businesses/${currentBusiness.id}/cashShifts`, activeShift.id);
        const shiftSnap = await transaction.get(shiftRef);
        if (!shiftSnap.exists()) throw new Error('Turno no encontrado.');

        const sData = shiftSnap.data();
        let newCashIn = sData.cashIn || 0;
        let newCashOut = sData.cashOut || 0;

        if (movementType === 'IN') {
          newCashIn += movementAmount;
        } else {
          newCashOut += movementAmount;
        }

        const newExpected = (sData.initialCash || 0) + (sData.cashSales || 0) + newCashIn - newCashOut;

        transaction.update(shiftRef, {
          cashIn: newCashIn,
          cashOut: newCashOut,
          expectedCash: newExpected,
        });

        const movDocRef = doc(db, `businesses/${currentBusiness.id}/cashMovements`, movId);
        transaction.set(movDocRef, {
          id: movId,
          businessId: currentBusiness.id,
          shiftId: activeShift.id,
          type: movementType,
          category: movementCategory,
          amount: movementAmount,
          description: movementDesc.trim() || movementCategory,
          userId: user.uid,
          userName: user.displayName || 'Cajero',
          createdAt: nowIso,
        });
      });

      setShowMovementModal(false);
      setMovementAmount(5000);
      setMovementDesc('');
    } catch (err: any) {
      console.error('Error recording cash movement:', err);
      alert('Error al registrar el movimiento.');
    } finally {
      setIsMovementSubmitting(false);
    }
  };

  // Close Shift
  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBusiness || !activeShift) return;

    setIsCloseSubmitting(true);
    const nowIso = new Date().toISOString();
    const counted = Number(countedCashInput) || 0;
    const diff = counted - activeShift.expectedCash;

    try {
      await updateDoc(doc(db, `businesses/${currentBusiness.id}/cashShifts`, activeShift.id), {
        status: 'CLOSED',
        closedAt: nowIso,
        countedCash: counted,
        difference: diff,
        closingNotes: closingNotes.trim(),
      });

      setActiveShift(null);
      setShowCloseModal(false);
      alert(`¡Caja cerrada exitosamente! Diferencia: ${formatCOP(diff)}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `businesses/${currentBusiness.id}/cashShifts/${activeShift.id}`);
    } finally {
      setIsCloseSubmitting(false);
    }
  };

  const handleExportShiftsCSV = () => {
    const rows = shifts.map(s => ({
      'ID Turno': s.id,
      'Cajero': s.cashierName,
      'Estado': s.status,
      'Apertura': formatColombianDate(s.openedAt),
      'Cierre': formatColombianDate(s.closedAt),
      'Base Inicial (COP)': s.initialCash,
      'Ventas Efectivo (COP)': s.cashSales,
      'Ventas Nequi (COP)': s.nequiSales,
      'Ventas Daviplata (COP)': s.daviplataSales,
      'Ventas Transferencias (COP)': s.transferSales,
      'Ventas Tarjeta (COP)': s.cardSales,
      'Ventas Fiadas (COP)': s.creditSales,
      'Entradas Extras (COP)': s.cashIn,
      'Gastos / Salidas (COP)': s.cashOut,
      'Efectivo Esperado (COP)': s.expectedCash,
      'Efectivo Contado (COP)': s.countedCash ?? '',
      'Diferencia (COP)': s.difference ?? '',
      'Notas': s.closingNotes || ''
    }));
    downloadCSV(`cierres_caja_${currentBusiness?.name || 'tienda'}`, rows);
  };

  return (
    <div className="space-y-5 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CircleDollarSign className="w-6 h-6 text-emerald-700" />
            <h1 className="text-2xl font-black text-stone-900 tracking-tight">Caja Diaria y Arqueo</h1>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Apertura de turno, control de gastos, arqueo discriminando efectivo de dinero digital y cierre de caja.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportShiftsCSV}
            disabled={shifts.length === 0}
            className="flex items-center gap-1.5 bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 font-semibold px-3 py-2 rounded-xl text-xs shadow-xs transition"
          >
            <Download className="w-3.5 h-3.5 text-stone-500" />
            <span>Exportar Cierres</span>
          </button>

          {!activeShift ? (
            <button
              onClick={() => {
                setInitialCashInput(50000);
                setShowOpenModal(true);
              }}
              className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 py-2 rounded-xl text-xs sm:text-sm shadow-sm transition active:scale-95"
            >
              <Unlock className="w-4 h-4" />
              <span>Abrir Turno de Caja</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setCountedCashInput(activeShift.expectedCash);
                setClosingNotes('');
                setShowCloseModal(true);
              }}
              className="flex items-center gap-1.5 bg-stone-900 hover:bg-stone-800 text-white font-bold px-4 py-2 rounded-xl text-xs sm:text-sm shadow-sm transition active:scale-95"
            >
              <Lock className="w-4 h-4 text-amber-400" />
              <span>Cerrar Turno de Caja</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Shift Panel */}
      {activeShift ? (
        <div className="bg-white rounded-2xl border-2 border-emerald-600 shadow-sm overflow-hidden">
          
          {/* Banner */}
          <div className="p-4 bg-emerald-700 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-800 rounded-xl">
                <Unlock className="w-5 h-5 text-emerald-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-base">Turno de Caja Activo</h3>
                  <span className="text-[10px] bg-amber-400 text-emerald-950 font-black px-2 py-0.5 rounded-full uppercase">
                    En curso
                  </span>
                </div>
                <p className="text-xs text-emerald-100 mt-0.5">
                  Abierto por: {activeShift.cashierName} • {formatColombianDate(activeShift.openedAt)}
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowMovementModal(true)}
              className="flex items-center justify-center gap-1.5 bg-white text-emerald-900 hover:bg-emerald-50 font-bold px-3 py-2 rounded-xl text-xs shadow-xs transition"
            >
              <PlusCircle className="w-4 h-4 text-emerald-700" />
              <span>Registrar Gasto o Ingreso</span>
            </button>
          </div>

          {/* Cash vs Digital Breakdown */}
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Left: Dinero Físico en Cajón */}
            <div className="space-y-3 p-4 bg-emerald-50/60 rounded-xl border border-emerald-200">
              <div className="flex items-center gap-2 text-emerald-900 font-extrabold text-sm pb-2 border-b border-emerald-200">
                <DollarSign className="w-4 h-4 text-emerald-700" />
                <span>Efectivo Físico en Cajón (Billetes y Monedas)</span>
              </div>

              <div className="space-y-2 text-xs text-stone-700">
                <div className="flex justify-between">
                  <span>(+) Base inicial de caja:</span>
                  <span className="font-bold">{formatCOP(activeShift.initialCash)}</span>
                </div>
                <div className="flex justify-between">
                  <span>(+) Ventas cobradas en efectivo:</span>
                  <span className="font-bold text-emerald-800">+{formatCOP(activeShift.cashSales)}</span>
                </div>
                <div className="flex justify-between">
                  <span>(+) Entradas extras de efectivo:</span>
                  <span className="font-bold text-emerald-800">+{formatCOP(activeShift.cashIn)}</span>
                </div>
                <div className="flex justify-between text-rose-700">
                  <span>(-) Gastos / Salidas pagadas en efectivo:</span>
                  <span className="font-bold">-{formatCOP(activeShift.cashOut)}</span>
                </div>

                <div className="pt-2 border-t border-emerald-300 flex justify-between items-baseline text-emerald-950">
                  <span className="font-black text-sm uppercase">Efectivo Físico Esperado:</span>
                  <span className="text-xl font-black text-emerald-800">
                    {formatCOP(activeShift.expectedCash)}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Pagos Digitales Recibidos (NO son efectivo físico) */}
            <div className="space-y-3 p-4 bg-stone-50 rounded-xl border border-stone-200">
              <div className="flex items-center justify-between pb-2 border-b border-stone-200">
                <div className="flex items-center gap-2 text-stone-900 font-extrabold text-sm">
                  <Smartphone className="w-4 h-4 text-teal-700" />
                  <span>Dinero Digital y Cuentas Bancarias</span>
                </div>
                <span className="text-[10px] text-stone-500 font-medium">No sumar al cajón</span>
              </div>

              <div className="space-y-2 text-xs text-stone-700">
                <div className="flex justify-between">
                  <span>Nequi:</span>
                  <span className="font-bold">{formatCOP(activeShift.nequiSales)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Daviplata:</span>
                  <span className="font-bold">{formatCOP(activeShift.daviplataSales)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Transferencia Bancaria:</span>
                  <span className="font-bold">{formatCOP(activeShift.transferSales)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tarjetas / Datáfono:</span>
                  <span className="font-bold">{formatCOP(activeShift.cardSales)}</span>
                </div>
                <div className="flex justify-between text-amber-700">
                  <span>Fiado en este turno:</span>
                  <span className="font-bold">{formatCOP(activeShift.creditSales)}</span>
                </div>

                <div className="pt-2 border-t border-stone-200 flex justify-between items-baseline">
                  <span className="font-bold text-stone-800">Total Recaudado Digital:</span>
                  <span className="text-base font-extrabold text-teal-700">
                    {formatCOP(
                      activeShift.nequiSales + 
                      activeShift.daviplataSales + 
                      activeShift.transferSales + 
                      activeShift.cardSales
                    )}
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* Movements table during this shift */}
          <div className="p-5 border-t border-stone-100 bg-stone-50/50">
            <h4 className="font-bold text-stone-800 text-xs uppercase mb-2">
              Gastos y Entradas Menores de este Turno ({movements.length}):
            </h4>

            {movements.length === 0 ? (
              <p className="text-xs text-stone-400 py-2">No se han registrado gastos menores o ingresos extras en este turno.</p>
            ) : (
              <div className="divide-y divide-stone-200 border rounded-xl bg-white overflow-hidden">
                {movements.map(m => (
                  <div key={m.id} className="p-3 flex items-center justify-between text-xs">
                    <div>
                      <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] mr-2 ${
                        m.type === 'IN' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'
                      }`}>
                        {m.type === 'IN' ? 'INGRESO' : 'GASTO'}
                      </span>
                      <span className="font-semibold text-stone-800">{m.category}</span>
                      <p className="text-stone-500 mt-0.5">{m.description}</p>
                    </div>
                    <span className={`text-sm font-extrabold ${m.type === 'IN' ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {m.type === 'IN' ? `+${formatCOP(m.amount)}` : `-${formatCOP(m.amount)}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-6 text-center space-y-3">
          <Lock className="w-10 h-10 mx-auto text-amber-600" />
          <h2 className="text-lg font-bold text-amber-900">Actualmente no hay turno de caja abierto</h2>
          <p className="text-xs text-amber-800 max-w-md mx-auto">
            Abre un turno registrando el saldo inicial en efectivo (base) para habilitar el control estricto de arqueo diario.
          </p>
          <button
            onClick={() => {
              setInitialCashInput(50000);
              setShowOpenModal(true);
            }}
            className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-5 py-2.5 rounded-xl text-sm shadow-md transition active:scale-95"
          >
            <Unlock className="w-4 h-4" />
            <span>Abrir Caja con Base</span>
          </button>
        </div>
      )}

      {/* Shifts History */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-stone-200 flex items-center gap-2">
          <History className="w-5 h-5 text-emerald-700" />
          <h3 className="font-bold text-stone-900 text-base">Historial de Cierres Anteriores</h3>
        </div>

        {shifts.length === 0 ? (
          <div className="p-8 text-center text-stone-400 text-sm">No hay registros de caja aún.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 text-xs font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3">Apertura</th>
                  <th className="p-3">Cierre</th>
                  <th className="p-3">Cajero</th>
                  <th className="p-3 text-right">Base Inicial</th>
                  <th className="p-3 text-right">Efectivo Ventas</th>
                  <th className="p-3 text-right">Gastos</th>
                  <th className="p-3 text-right">Efectivo Esperado</th>
                  <th className="p-3 text-right">Efectivo Contado</th>
                  <th className="p-3 text-center">Diferencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {shifts.map(s => {
                  const diff = s.difference ?? 0;
                  return (
                    <tr key={s.id} className="hover:bg-stone-50 transition">
                      <td className="p-3 text-stone-600 whitespace-nowrap">{formatColombianDate(s.openedAt)}</td>
                      <td className="p-3 text-stone-600 whitespace-nowrap">
                        {s.closedAt ? formatColombianDate(s.closedAt) : (
                          <span className="text-emerald-700 font-bold">En curso</span>
                        )}
                      </td>
                      <td className="p-3 font-semibold text-stone-800">{s.cashierName}</td>
                      <td className="p-3 text-right font-medium">{formatCOP(s.initialCash)}</td>
                      <td className="p-3 text-right text-emerald-700 font-bold">+{formatCOP(s.cashSales)}</td>
                      <td className="p-3 text-right text-rose-600 font-medium">-{formatCOP(s.cashOut)}</td>
                      <td className="p-3 text-right font-bold text-stone-900">{formatCOP(s.expectedCash)}</td>
                      <td className="p-3 text-right font-bold">{s.countedCash !== undefined ? formatCOP(s.countedCash) : '-'}</td>
                      <td className="p-3 text-center">
                        {s.difference !== undefined ? (
                          <span className={`inline-block font-extrabold px-2 py-0.5 rounded-full text-xs ${
                            diff === 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : diff < 0
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {diff === 0 ? 'CUADRADO ($0)' : diff < 0 ? `Faltante: ${formatCOP(diff)}` : `Sobrante: +${formatCOP(diff)}`}
                          </span>
                        ) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Open Shift */}
      {showOpenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center gap-2 text-emerald-800 font-bold text-base">
              <Unlock className="w-5 h-5" />
              <span>Apertura de Caja Diaria</span>
            </div>

            <form onSubmit={handleOpenShift} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Saldo Base Inicial en Efectivo (COP):
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  required
                  value={initialCashInput}
                  onChange={(e) => setInitialCashInput(parseFloat(e.target.value) || 0)}
                  className="w-full text-center text-2xl font-bold py-2 border-2 border-emerald-600 rounded-xl focus:outline-none"
                />
                <p className="text-[11px] text-stone-400 mt-1 text-center">
                  Billetes y monedas disponibles para dar cambio al comenzar la jornada.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowOpenModal(false)}
                  className="flex-1 py-2 rounded-xl border border-stone-300 text-stone-700 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isOpenSubmitting}
                  className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl"
                >
                  {isOpenSubmitting ? 'Abriendo...' : 'Confirmar Apertura'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Add Cash Movement (Gasto / Ingreso) */}
      {showMovementModal && activeShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            <h3 className="font-extrabold text-stone-900 text-base">Registrar Gasto o Ingreso en Caja</h3>

            <form onSubmit={handleAddMovement} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Tipo de Movimiento:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMovementType('OUT')}
                    className={`py-2 rounded-xl border text-xs font-bold transition ${
                      movementType === 'OUT' ? 'bg-rose-600 text-white border-rose-600' : 'bg-stone-50 border-stone-200 text-stone-700'
                    }`}
                  >
                    Gasto / Salida (-)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovementType('IN')}
                    className={`py-2 rounded-xl border text-xs font-bold transition ${
                      movementType === 'IN' ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-stone-50 border-stone-200 text-stone-700'
                    }`}
                  >
                    Ingreso Extra (+)
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Monto en COP:</label>
                <input
                  type="number"
                  min="500"
                  step="500"
                  required
                  value={movementAmount}
                  onChange={(e) => setMovementAmount(parseFloat(e.target.value) || 0)}
                  className="w-full text-center text-xl font-bold py-1.5 border border-stone-300 rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Categoría:</label>
                <select
                  value={movementCategory}
                  onChange={(e) => setMovementCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs"
                >
                  <option value="Gastos menores / Aseo">Gastos menores / Aseo</option>
                  <option value="Pago a proveedor de contado">Pago a proveedor de contado</option>
                  <option value="Servicios públicos / Recargas">Servicios públicos / Recargas</option>
                  <option value="Domicilios y fletes">Domicilios y fletes</option>
                  <option value="Retiro de dueño / Ganancias">Retiro de dueño / Ganancias</option>
                  <option value="Otros ingresos">Otros ingresos</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Descripción / Detalle:</label>
                <input
                  type="text"
                  placeholder="Ej: Pago de bolsa de hielo, tinto y panela..."
                  value={movementDesc}
                  onChange={(e) => setMovementDesc(e.target.value)}
                  className="w-full px-3 py-1.5 border border-stone-300 rounded-xl text-xs"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMovementModal(false)}
                  className="flex-1 py-2 border border-stone-300 text-stone-700 text-xs font-semibold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isMovementSubmitting}
                  className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl"
                >
                  {isMovementSubmitting ? 'Guardando...' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Close Shift */}
      {showCloseModal && activeShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center gap-2 text-stone-900 font-extrabold text-base">
              <Lock className="w-5 h-5 text-amber-600" />
              <span>Arqueo y Cierre de Caja</span>
            </div>

            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Efectivo esperado por el sistema:</span>
                <span className="font-bold text-stone-900">{formatCOP(activeShift.expectedCash)}</span>
              </div>
              <div className="flex justify-between text-stone-500">
                <span>Total ventas digitales (Nequi/etc):</span>
                <span>{formatCOP(activeShift.nequiSales + activeShift.daviplataSales + activeShift.transferSales + activeShift.cardSales)}</span>
              </div>
            </div>

            <form onSubmit={handleCloseShift} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Efectivo Físico Contado en el Cajón (COP) *:
                </label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  required
                  value={countedCashInput}
                  onChange={(e) => setCountedCashInput(parseFloat(e.target.value) || 0)}
                  className="w-full text-center text-2xl font-black text-emerald-800 py-2 border-2 border-emerald-600 rounded-xl focus:outline-none"
                />
              </div>

              {/* Difference highlight */}
              <div className="p-3 rounded-xl bg-stone-100 flex items-center justify-between text-xs font-bold">
                <span>Diferencia de Caja:</span>
                <span className={countedCashInput - activeShift.expectedCash < 0 ? 'text-rose-600' : 'text-emerald-700'}>
                  {countedCashInput - activeShift.expectedCash === 0
                    ? 'CUADRADO EXACTO ($0)'
                    : countedCashInput - activeShift.expectedCash < 0
                    ? `FALTANTE: ${formatCOP(countedCashInput - activeShift.expectedCash)}`
                    : `SOBRANTE: +${formatCOP(countedCashInput - activeShift.expectedCash)}`}
                </span>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Observaciones de Cierre (opcional):
                </label>
                <textarea
                  rows={2}
                  placeholder="Ej: Turno sin novedades, se dejaron $50.000 de base para mañana..."
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  className="w-full p-2 border border-stone-300 rounded-xl text-xs"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCloseModal(false)}
                  className="flex-1 py-2.5 border border-stone-300 text-stone-700 text-xs font-semibold rounded-xl"
                >
                  Volver
                </button>
                <button
                  type="submit"
                  disabled={isCloseSubmitting}
                  className="flex-1 py-2.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl"
                >
                  {isCloseSubmitting ? 'Cerrando...' : 'Confirmar Cierre de Turno'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
