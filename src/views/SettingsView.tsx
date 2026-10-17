import React, { useState, useEffect } from 'react';
import { useAuth } from '../firebase/authContext';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import { doc, updateDoc, collection, onSnapshot, setDoc } from 'firebase/firestore';
import { Business, BusinessMember, UserRole } from '../types';
import { 
  Settings, 
  Store, 
  ShieldCheck, 
  FileCheck2, 
  Users, 
  CreditCard, 
  CheckCircle2, 
  AlertTriangle,
  Info,
  Plus
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { currentBusiness, businesses, selectBusiness, createBusiness, currentRole, refreshBusiness } = useAuth();

  const [activeTab, setActiveTab] = useState<'BUSINESS' | 'DIAN' | 'STORES' | 'USERS' | 'SUBSCRIPTION'>('BUSINESS');
  const [isSaving, setIsSaving] = useState(false);

  // Business form state
  const [bizForm, setBizForm] = useState({
    name: '',
    nit: '',
    phone: '',
    whatsapp: '',
    address: '',
    city: 'Bogotá',
    receiptFooter: '',
    catalogActive: true,
  });

  // New store modal
  const [showNewStoreModal, setShowNewStoreModal] = useState(false);
  const [newStoreForm, setNewStoreForm] = useState({
    name: '',
    nit: '',
    phone: '',
    address: '',
    city: 'Bogotá',
  });

  // Members list
  const [members, setMembers] = useState<BusinessMember[]>([]);

  useEffect(() => {
    if (currentBusiness) {
      setBizForm({
        name: currentBusiness.name || '',
        nit: currentBusiness.nit || '',
        phone: currentBusiness.phone || '',
        whatsapp: currentBusiness.whatsapp || '',
        address: currentBusiness.address || '',
        city: currentBusiness.city || 'Bogotá',
        receiptFooter: currentBusiness.receiptFooter || '',
        catalogActive: currentBusiness.catalogActive ?? true,
      });

      // Load members
      const unsub = onSnapshot(collection(db, `businesses/${currentBusiness.id}/members`), (snap) => {
        const items: BusinessMember[] = [];
        snap.forEach(d => items.push({ id: d.id, ...d.data() } as BusinessMember));
        setMembers(items);
      });

      return () => unsub();
    }
  }, [currentBusiness]);

  const handleSaveBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBusiness) return;

    setIsSaving(true);
    try {
      const bizRef = doc(db, 'businesses', currentBusiness.id);
      await updateDoc(bizRef, {
        name: bizForm.name.trim(),
        nit: bizForm.nit.trim(),
        phone: bizForm.phone.trim(),
        whatsapp: bizForm.whatsapp.trim(),
        address: bizForm.address.trim(),
        city: bizForm.city.trim(),
        receiptFooter: bizForm.receiptFooter.trim(),
        catalogActive: bizForm.catalogActive,
        updatedAt: new Date().toISOString(),
      });
      await refreshBusiness();
      alert('¡Datos del comercio actualizados correctamente!');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `businesses/${currentBusiness.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateNewStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreForm.name.trim()) {
      alert('El nombre del comercio es obligatorio.');
      return;
    }

    try {
      await createBusiness(
        newStoreForm.name,
        newStoreForm.nit,
        newStoreForm.phone,
        newStoreForm.address,
        newStoreForm.city
      );
      setShowNewStoreModal(false);
      setNewStoreForm({ name: '', nit: '', phone: '', address: '', city: 'Bogotá' });
      alert('¡Nuevo comercio creado con éxito!');
    } catch (err: any) {
      alert(err.message || 'Error al crear el comercio.');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="w-6 h-6 text-emerald-700" />
            <h1 className="text-2xl font-black text-stone-900 tracking-tight">Configuración y Normativa</h1>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Datos fiscales de Colombia, comprobantes internos, gestión de sucursales, roles y módulo DIAN.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-stone-200 space-x-2 overflow-x-auto">
        {[
          { id: 'BUSINESS', label: 'Datos del Comercio' },
          { id: 'DIAN', label: 'Facturación DIAN Colombia' },
          { id: 'STORES', label: `Mis Comercios (${businesses.length})` },
          { id: 'USERS', label: `Usuarios y Roles (${members.length})` },
          { id: 'SUBSCRIPTION', label: 'Planes y Suscripción' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition ${
              activeTab === tab.id
                ? 'border-emerald-700 text-emerald-800'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: Business Profile */}
      {activeTab === 'BUSINESS' && (
        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs max-w-2xl">
          <form onSubmit={handleSaveBusiness} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">Nombre Comercial de la Tienda *</label>
              <input
                type="text"
                required
                value={bizForm.name}
                onChange={(e) => setBizForm({ ...bizForm, name: e.target.value })}
                className="w-full px-3 py-2 border border-stone-300 rounded-xl text-sm font-semibold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">NIT o Cédula Fiscal</label>
                <input
                  type="text"
                  placeholder="900.123.456-7"
                  value={bizForm.nit}
                  onChange={(e) => setBizForm({ ...bizForm, nit: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Ciudad / Municipio</label>
                <input
                  type="text"
                  value={bizForm.city}
                  onChange={(e) => setBizForm({ ...bizForm, city: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Teléfono Local</label>
                <input
                  type="tel"
                  value={bizForm.phone}
                  onChange={(e) => setBizForm({ ...bizForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">WhatsApp para Pedidos (con 57)</label>
                <input
                  type="tel"
                  placeholder="573101234567"
                  value={bizForm.whatsapp}
                  onChange={(e) => setBizForm({ ...bizForm, whatsapp: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">Dirección del Local</label>
              <input
                type="text"
                value={bizForm.address}
                onChange={(e) => setBizForm({ ...bizForm, address: e.target.value })}
                className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">
                Pie de Ticket / Mensaje en Comprobante
              </label>
              <textarea
                rows={2}
                value={bizForm.receiptFooter}
                onChange={(e) => setBizForm({ ...bizForm, receiptFooter: e.target.value })}
                placeholder="¡Gracias por su compra en nuestra tienda!"
                className="w-full p-2.5 border border-stone-300 rounded-xl text-xs"
              />
            </div>

            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-stone-800">
                <input
                  type="checkbox"
                  checked={bizForm.catalogActive}
                  onChange={(e) => setBizForm({ ...bizForm, catalogActive: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <span>Catálogo Online público activo para recibir pedidos por WhatsApp</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-xl text-xs sm:text-sm shadow-xs"
            >
              {isSaving ? 'Guardando...' : 'Guardar Información del Comercio'}
            </button>
          </form>
        </div>
      )}

      {/* TAB 2: DIAN Module */}
      {activeTab === 'DIAN' && (
        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs max-w-2xl space-y-5">
          <div className="flex items-center gap-2 text-emerald-800 pb-2 border-b border-stone-200">
            <FileCheck2 className="w-5 h-5 text-emerald-700" />
            <h2 className="text-lg font-black text-stone-900">Módulo de Facturación Electrónica DIAN</h2>
          </div>

          {/* Legal Transparency Notice */}
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-300 space-y-2">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Transparencia y Normativa Fiscal Colombiana</span>
            </div>
            <p className="text-xs text-amber-900 leading-relaxed">
              Actualmente, Anapse PosTienda Colombia emite <strong>Comprobantes Internos de Venta</strong> y documentos equivalentes simplificados para control interno de tiendas de barrio y minimarkets del régimen no responsable de IVA.
            </p>
            <p className="text-xs text-amber-900 leading-relaxed">
              <strong>Aviso legal:</strong> El sistema no genera números de autorización CUFE ni certificados fiscales ficticios. La conexión formal con la Dirección de Impuestos y Aduanas Nacionales (DIAN) requiere la firma digital de la persona jurídica o natural y un proveedor tecnológico autorizado (PTA).
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="font-bold text-stone-900 text-sm">Arquitectura de Integración Preparada</h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              El esquema de base de datos y eventos de venta está preparado modularmente para conectarse mediante webhook seguro de servidor a proveedores tecnológicos autorizados colombianos:
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                <span className="font-bold text-xs text-stone-800 block">Proveedores Compatibles:</span>
                <span className="text-xs text-stone-500 mt-1 block">Factus API, The Factory HKA, Siigo Cloud, Carvajal T&S.</span>
              </div>
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                <span className="font-bold text-xs text-stone-800 block">Seguridad DIAN:</span>
                <span className="text-xs text-stone-500 mt-1 block">Credenciales y certificados .p12 protegidos estrictamente en servidor.</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-stone-200">
            <button
              onClick={() => alert('La integración oficial con el proveedor tecnológico de la DIAN se configurará en la fase de certificación fiscal con las credenciales de producción del comerciante.')}
              className="py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold rounded-xl transition"
            >
              Consultar Guía de Habilitación DIAN
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: Multi-Store Switcher & Management */}
      {activeTab === 'STORES' && (
        <div className="space-y-4 max-w-2xl">
          <div className="flex justify-between items-center">
            <h2 className="font-bold text-stone-900 text-base">Comercios Asociados a tu Cuenta</h2>
            <button
              onClick={() => setShowNewStoreModal(true)}
              className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-3 py-1.5 rounded-xl text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Crear Otro Comercio</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {businesses.map(b => {
              const isSelected = b.id === currentBusiness?.id;
              return (
                <div
                  key={b.id}
                  onClick={() => selectBusiness(b)}
                  className={`p-4 rounded-2xl border cursor-pointer transition ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-50/60 shadow-sm'
                      : 'border-stone-200 bg-white hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-stone-900">{b.name}</h3>
                    {isSelected && (
                      <span className="text-[10px] font-black bg-emerald-700 text-white px-2 py-0.5 rounded-full uppercase">
                        Activo
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-500 mt-1">NIT: {b.nit || 'No registrado'}</p>
                  <p className="text-xs text-stone-500">{b.address || b.city}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: Users and Roles */}
      {activeTab === 'USERS' && (
        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs max-w-2xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-200">
            <div>
              <h2 className="font-extrabold text-stone-900 text-base">Usuarios y Roles de este Comercio</h2>
              <p className="text-xs text-stone-500">Control de permisos por rol: Propietario, Administrador y Cajero.</p>
            </div>
          </div>

          <div className="divide-y divide-stone-100 border rounded-xl overflow-hidden">
            {members.map(m => (
              <div key={m.id} className="p-3.5 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-stone-900">{m.displayName || m.email}</p>
                  <p className="text-stone-400">{m.email}</p>
                </div>
                <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-lg uppercase">
                  {m.role === 'owner' ? 'Propietario' : m.role === 'admin' ? 'Administrador' : 'Cajero'}
                </span>
              </div>
            ))}
          </div>

          <div className="p-3.5 bg-stone-50 rounded-xl text-xs text-stone-600 space-y-1">
            <p className="font-bold text-stone-800">Privilegios por Rol:</p>
            <p>• <strong>Cajero:</strong> Acceso a Punto de Venta (POS), Historial de Ventas, Consulta de Fiados y Caja Diaria.</p>
            <p>• <strong>Administrador:</strong> Acceso a Inventario, Productos, Compras, Proveedores y Reportes.</p>
            <p>• <strong>Propietario:</strong> Control total, eliminación de registros, configuración de la tienda y roles.</p>
          </div>
        </div>
      )}

      {/* TAB 5: Subscriptions */}
      {activeTab === 'SUBSCRIPTION' && (
        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs max-w-2xl space-y-4">
          <h2 className="font-extrabold text-stone-900 text-base">Plan de Suscripción</h2>
          
          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-between">
            <div>
              <span className="text-[10px] bg-emerald-700 text-white font-bold px-2 py-0.5 rounded-full uppercase">
                Plan Activo
              </span>
              <h3 className="text-xl font-black text-emerald-950 mt-1">Plan Tienda Emprendedor</h3>
              <p className="text-xs text-emerald-800 mt-0.5">Ventas, inventario, caja diaria y catálogo online ilimitados.</p>
            </div>
            <span className="text-2xl font-black text-emerald-800">$ 0 / mes</span>
          </div>

          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-500">
            * Conforme a los lineamientos del proyecto, no se simulan cobros bancarios reales ni se activan pasarelas de pago antes de la integración con proveedor autorizado.
          </div>
        </div>
      )}

      {/* Modal: New Business */}
      {showNewStoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            <h3 className="font-extrabold text-stone-900 text-base">Crear Nuevo Comercio o Sucursal</h3>

            <form onSubmit={handleCreateNewStore} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Nombre del Comercio *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Minimarket La 80"
                  value={newStoreForm.name}
                  onChange={(e) => setNewStoreForm({ ...newStoreForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">NIT / Cédula</label>
                  <input
                    type="text"
                    placeholder="900.000.000-1"
                    value={newStoreForm.nit}
                    onChange={(e) => setNewStoreForm({ ...newStoreForm, nit: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Ciudad</label>
                  <input
                    type="text"
                    value={newStoreForm.city}
                    onChange={(e) => setNewStoreForm({ ...newStoreForm, city: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Teléfono / WhatsApp</label>
                <input
                  type="tel"
                  placeholder="3101234567"
                  value={newStoreForm.phone}
                  onChange={(e) => setNewStoreForm({ ...newStoreForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Dirección</label>
                <input
                  type="text"
                  placeholder="Calle 80 # 45-12"
                  value={newStoreForm.address}
                  onChange={(e) => setNewStoreForm({ ...newStoreForm, address: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowNewStoreModal(false)}
                  className="flex-1 py-2 border border-stone-300 text-stone-700 text-xs font-semibold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl"
                >
                  Crear Comercio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
