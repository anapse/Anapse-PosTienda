import React, { useState } from 'react';
import { useAuth } from '../firebase/authContext';
import { BUSINESS_TYPES, PLAN_MONTHLY_PRICE_COP, PLAN_MAX_PRODUCTS, SERVICE_WHATSAPP_NUMBER } from '../utils/subscription';
import { formatCOP } from '../utils/currency';
import { Store, CheckCircle, Smartphone, AlertCircle } from 'lucide-react';

interface NewStoreRequestModalProps {
  onClose?: () => void;
  isInitialSetup?: boolean;
}

export const NewStoreRequestModal: React.FC<NewStoreRequestModalProps> = ({ onClose, isInitialSetup = false }) => {
  const { createBusinessRequest, user } = useAuth();

  const [form, setForm] = useState({
    name: '',
    businessType: BUSINESS_TYPES[0],
    contactName: user?.displayName || '',
    phone: '',
    nit: '',
    address: '',
    city: 'Bogotá',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !form.contactName.trim()) {
      alert('Por favor complete los campos obligatorios: Nombre de la tienda, Nombre de contacto y Teléfono.');
      return;
    }

    setIsSubmitting(true);
    try {
      await createBusinessRequest(form);
      if (onClose) onClose();
    } catch (err: any) {
      alert('Error al enviar la solicitud: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-stone-200 space-y-4 my-auto">
        
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-stone-200">
          <div>
            <div className="flex items-center gap-2">
              <Store className="w-5 h-5 text-emerald-700" />
              <h2 className="text-lg sm:text-xl font-black text-stone-900 tracking-tight">
                {isInitialSetup ? 'Registra tu Comercio' : 'Solicitar Nueva Tienda'}
              </h2>
            </div>
            <p className="text-xs text-stone-500 mt-1">
              Ingresa los datos del negocio para crear tu tienda en Anapse PosTienda.
            </p>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-stone-400 hover:text-stone-600 font-bold text-lg">
              ✕
            </button>
          )}
        </div>

        {/* Pricing notice */}
        <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-between text-xs">
          <div>
            <span className="font-bold text-emerald-900 block">Plan Mensual Seleccionado:</span>
            <span className="text-stone-600">Hasta {PLAN_MAX_PRODUCTS} productos • Acceso total</span>
          </div>
          <span className="text-base font-black text-emerald-800">{formatCOP(PLAN_MONTHLY_PRICE_COP)} / mes</span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-bold text-stone-700 block mb-1">
              Nombre de la Tienda o Comercio *
            </label>
            <input
              type="text"
              required
              placeholder="Ej: Minimarket El Buen Vecino"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm font-semibold focus:ring-1 focus:ring-emerald-600"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-stone-700 block mb-1">
              Tipo de Negocio *
            </label>
            <select
              value={form.businessType}
              onChange={(e) => setForm({ ...form, businessType: e.target.value })}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm font-semibold"
            >
              {BUSINESS_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">
                Tu Nombre o Contacto *
              </label>
              <input
                type="text"
                required
                placeholder="Ej: Don Carlos Pérez"
                value={form.contactName}
                onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">
                Celular / WhatsApp *
              </label>
              <input
                type="tel"
                required
                placeholder="Ej: 3101234567"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs font-semibold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">
                Ciudad / Municipio *
              </label>
              <input
                type="text"
                required
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">
                NIT o Cédula (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ej: 900.123.456-7"
                value={form.nit}
                onChange={(e) => setForm({ ...form, nit: e.target.value })}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-stone-700 block mb-1">
              Dirección del Local
            </label>
            <input
              type="text"
              placeholder="Ej: Calle 15 # 4-20, Barrio El Porvenir"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs"
            />
          </div>

          {/* Activation warning note */}
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
            <span className="font-bold">Nota de activación:</span> Tu solicitud será enviada al Administrador para su pre-aprobación y habilitación de los 30 días de servicio. Contacto de atención directa: <strong>{SERVICE_WHATSAPP_NUMBER}</strong> (Solo WhatsApp).
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-extrabold rounded-2xl text-sm shadow-md transition active:scale-98 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <span>Enviando solicitud...</span>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Enviar Solicitud de Tienda</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
