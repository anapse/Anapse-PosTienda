import React, { useState } from 'react';
import { useAuth } from '../firebase/authContext';
import { BUSINESS_TYPES, COMMERCIAL_PLANS, SERVICE_WHATSAPP_NUMBER } from '../utils/subscription';
import { formatCOP } from '../utils/currency';
import { Store, CheckCircle, Smartphone, AlertCircle, Zap, Boxes } from 'lucide-react';

interface NewStoreRequestModalProps {
  onClose?: () => void;
  isInitialSetup?: boolean;
}

export const NewStoreRequestModal: React.FC<NewStoreRequestModalProps> = ({ onClose, isInitialSetup = false }) => {
  const { createBusinessRequest, user, signOutUser } = useAuth();

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      signOutUser().catch(() => window.location.reload());
    }
  };

  const [selectedPlanId, setSelectedPlanId] = useState<'tienda' | 'almacen' | 'comercial'>('tienda');
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
      await createBusinessRequest({
        ...form,
        planId: selectedPlanId,
      });
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
              Ingresa los datos del negocio y selecciona tu plan comercial en Anapse PosTienda.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleClose} 
              className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 rounded-xl text-stone-700 font-black text-xs transition flex items-center gap-1 shadow-xs"
              title="Cerrar / Volver"
            >
              <span>✕ Cerrar</span>
            </button>
          </div>
        </div>

        {/* Plan selection selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-stone-800 flex items-center justify-between">
            <span>Selecciona tu Plan Comercial:</span>
            <span className="text-[10px] text-stone-500 font-normal">Renovable cada 30 días</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {COMMERCIAL_PLANS.map((plan) => {
              const isSelected = selectedPlanId === plan.id;
              return (
                <button
                  type="button"
                  key={plan.id}
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`p-2.5 rounded-2xl text-left border transition-all ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-50/80 ring-2 ring-emerald-600/20'
                      : 'border-stone-200 bg-stone-50 hover:bg-white hover:border-stone-300'
                  }`}
                >
                  <p className={`font-black text-xs ${isSelected ? 'text-emerald-900' : 'text-stone-800'}`}>
                    {plan.name}
                  </p>
                  <p className="text-[11px] font-black text-stone-900 mt-0.5">
                    {formatCOP(plan.priceCOP)}
                  </p>
                  <p className="text-[10px] text-stone-500 mt-0.5 leading-tight font-medium">
                    {plan.maxProducts === 500 ? 'Hasta 500 prod.' : plan.maxProducts === 2000 ? 'Hasta 2.000 prod.' : '+2.000 prod.'}
                  </p>
                </button>
              );
            })}
          </div>
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
