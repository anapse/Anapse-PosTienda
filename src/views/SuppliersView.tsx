import React, { useState, useEffect } from 'react';
import { useAuth } from '../firebase/authContext';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { Supplier } from '../types';
import { downloadCSV } from '../utils/exportCsv';
import { Building2, Plus, Search, Download, Phone, MapPin, Mail, Edit, Trash2 } from 'lucide-react';

export const SuppliersView: React.FC = () => {
  const { currentBusiness } = useAuth();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [form, setForm] = useState({
    name: '',
    nit: '',
    contactName: '',
    phone: '',
    email: '',
    address: '',
    city: 'Bogotá',
    notes: '',
  });

  useEffect(() => {
    if (!currentBusiness) return;

    const sRef = collection(db, `businesses/${currentBusiness.id}/suppliers`);
    const unsub = onSnapshot(sRef, (snap) => {
      const items: Supplier[] = [];
      snap.forEach(d => items.push({ id: d.id, ...d.data() } as Supplier));
      items.sort((a, b) => a.name.localeCompare(b.name));
      setSuppliers(items);
      setLoading(false);
    }, (err) => {
      console.warn('Error loading suppliers: ', err);
      setLoading(false);
    });

    return () => unsub();
  }, [currentBusiness]);

  const openCreateModal = () => {
    setEditingSupplier(null);
    setForm({
      name: '',
      nit: '',
      contactName: '',
      phone: '',
      email: '',
      address: '',
      city: currentBusiness?.city || 'Bogotá',
      notes: '',
    });
    setShowModal(true);
  };

  const openEditModal = (s: Supplier) => {
    setEditingSupplier(s);
    setForm({
      name: s.name,
      nit: s.nit || '',
      contactName: s.contactName || '',
      phone: s.phone || '',
      email: s.email || '',
      address: s.address || '',
      city: s.city || currentBusiness?.city || 'Bogotá',
      notes: s.notes || '',
    });
    setShowModal(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBusiness) return;
    if (!form.name.trim()) {
      alert('El nombre del proveedor es obligatorio.');
      return;
    }

    const suppId = editingSupplier ? editingSupplier.id : `supp_${Date.now()}`;
    const payload: Supplier = {
      id: suppId,
      businessId: currentBusiness.id,
      name: form.name.trim(),
      nit: form.nit.trim(),
      contactName: form.contactName.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      notes: form.notes.trim(),
      createdAt: editingSupplier ? editingSupplier.createdAt : new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, `businesses/${currentBusiness.id}/suppliers`, suppId), payload);
      setShowModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `businesses/${currentBusiness.id}/suppliers/${suppId}`);
    }
  };

  const handleDelete = async (s: Supplier) => {
    if (!currentBusiness) return;
    if (!window.confirm(`¿Desea eliminar al proveedor "${s.name}"?`)) return;

    try {
      await deleteDoc(doc(db, `businesses/${currentBusiness.id}/suppliers`, s.id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `businesses/${currentBusiness.id}/suppliers/${s.id}`);
    }
  };

  const filteredSuppliers = suppliers.filter(s => {
    const q = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.nit && s.nit.includes(q)) ||
      (s.contactName && s.contactName.toLowerCase().includes(q))
    );
  });

  const handleExportCSV = () => {
    const rows = filteredSuppliers.map(s => ({
      'Proveedor': s.name,
      'NIT': s.nit || '',
      'Contacto': s.contactName || '',
      'Teléfono': s.phone || '',
      'Email': s.email || '',
      'Ciudad': s.city || '',
      'Dirección': s.address || '',
      'Notas': s.notes || ''
    }));
    downloadCSV(`proveedores_${currentBusiness?.name || 'tienda'}`, rows);
  };

  return (
    <div className="space-y-5 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-6 h-6 text-emerald-700" />
            <h1 className="text-2xl font-black text-stone-900 tracking-tight">Directorio de Proveedores</h1>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Empresas distribuidoras, asesores comerciales y contactos de abastecimiento.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            disabled={suppliers.length === 0}
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
            <span>Nuevo Proveedor</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar por razón social, NIT o nombre del asesor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none"
          />
        </div>
      </div>

      {/* Suppliers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full p-8 text-center text-stone-400 text-sm">Cargando proveedores...</div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="col-span-full p-12 text-center text-stone-400">
            <Building2 className="w-10 h-10 mx-auto text-stone-300 mb-2" />
            <p className="font-semibold text-stone-600">No hay proveedores registrados.</p>
          </div>
        ) : (
          filteredSuppliers.map(s => (
            <div key={s.id} className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-start justify-between">
                  <h3 className="font-extrabold text-base text-stone-900 line-clamp-1">{s.name}</h3>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEditModal(s)}
                      className="p-1 text-stone-400 hover:text-emerald-700 rounded"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(s)}
                      className="p-1 text-stone-400 hover:text-rose-600 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {s.nit && <p className="text-xs text-stone-400 mt-0.5">NIT: {s.nit}</p>}
                {s.contactName && <p className="text-xs font-semibold text-stone-700 mt-2">Contacto: {s.contactName}</p>}
              </div>

              <div className="space-y-1.5 text-xs text-stone-600 pt-2 border-t border-stone-100">
                {s.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{s.phone}</span>
                  </div>
                )}
                {s.email && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-stone-400" />
                    <span className="truncate">{s.email}</span>
                  </div>
                )}
                {s.address && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-stone-400" />
                    <span className="truncate">{s.address} ({s.city})</span>
                  </div>
                )}
                {s.notes && (
                  <p className="text-[11px] text-stone-500 italic pt-1">{s.notes}</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <h3 className="font-extrabold text-stone-900 text-lg">
                {editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-stone-400 hover:text-stone-600 text-base font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Nombre o Razón Social *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Distribuidora Bavaria S.A."
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">NIT / Identificación</label>
                  <input
                    type="text"
                    placeholder="860.005.224-6"
                    value={form.nit}
                    onChange={(e) => setForm({ ...form, nit: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Ciudad</label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Nombre del Asesor / Contacto</label>
                <input
                  type="text"
                  placeholder="Ej: Carlos Montoya"
                  value={form.contactName}
                  onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Teléfono / WhatsApp</label>
                  <input
                    type="tel"
                    placeholder="3101234567"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    placeholder="pedidos@empresa.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Dirección / Bodega</label>
                <input
                  type="text"
                  placeholder="Zona Industrial Calle 13"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Días de visita / Notas</label>
                <input
                  type="text"
                  placeholder="Ej: Visita los martes, entrega los jueves..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2 border border-stone-300 text-stone-700 text-xs font-semibold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl"
                >
                  Guardar Proveedor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
