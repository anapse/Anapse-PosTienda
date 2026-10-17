import React, { useState, useEffect } from 'react';
import { useAuth } from '../firebase/authContext';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Product, Supplier } from '../types';
import { formatCOP, formatQuantity } from '../utils/currency';
import { PRODUCT_CATEGORIES } from '../utils/sampleData';
import { downloadCSV } from '../utils/exportCsv';
import { 
  Package, 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Download, 
  Upload, 
  Scale, 
  AlertCircle, 
  Filter,
  CheckCircle2,
  X
} from 'lucide-react';

export const ProductsView: React.FC = () => {
  const { currentBusiness, currentRole } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('TODAS');

  // Modal Create/Edit
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    barcode: string;
    internalCode: string;
    category: string;
    brand: string;
    costPrice: number;
    salePrice: number;
    stock: number;
    minStock: number;
    unit: Product['unit'];
    supplierId: string;
    active: boolean;
    allowDecimals: boolean;
    expirationDate: string;
  }>({
    name: '',
    description: '',
    barcode: '',
    internalCode: '',
    category: 'Abarrotes',
    brand: '',
    costPrice: 0,
    salePrice: 0,
    stock: 0,
    minStock: 5,
    unit: 'unidad',
    supplierId: '',
    active: true,
    allowDecimals: false,
    expirationDate: '',
  });

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!currentBusiness) return;

    // Load products
    const prodRef = collection(db, `businesses/${currentBusiness.id}/products`);
    const unsubProd = onSnapshot(prodRef, (snapshot) => {
      const items: Product[] = [];
      snapshot.forEach(docSnap => {
        items.push({ id: docSnap.id, ...docSnap.data() } as Product);
      });
      items.sort((a, b) => a.name.localeCompare(b.name));
      setProducts(items);
      setLoading(false);
    }, (err) => {
      console.warn('Error loading products: ', err);
      setLoading(false);
    });

    // Load suppliers
    const suppRef = collection(db, `businesses/${currentBusiness.id}/suppliers`);
    const unsubSupp = onSnapshot(suppRef, (snapshot) => {
      const items: Supplier[] = [];
      snapshot.forEach(docSnap => {
        items.push({ id: docSnap.id, ...docSnap.data() } as Supplier);
      });
      setSuppliers(items);
    }, (err) => {
      console.warn('Error loading suppliers: ', err);
    });

    return () => {
      unsubProd();
      unsubSupp();
    };
  }, [currentBusiness]);

  const openCreateModal = () => {
    const maxLimit = currentBusiness?.maxProducts || 500;
    if (products.length >= maxLimit) {
      alert(`Has alcanzado el límite de ${maxLimit} productos de tu Plan Mensual ($40.000 COP). Para solicitar una ampliación, comunícate con nosotros por WhatsApp al +51 912391502.`);
      return;
    }

    setEditingProduct(null);
    setFormData({
      name: '',
      description: '',
      barcode: '',
      internalCode: '',
      category: 'Abarrotes',
      brand: '',
      costPrice: 0,
      salePrice: 0,
      stock: 0,
      minStock: 5,
      unit: 'unidad',
      supplierId: '',
      active: true,
      allowDecimals: false,
      expirationDate: '',
    });
    setShowModal(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      barcode: product.barcode || '',
      internalCode: product.internalCode || '',
      category: product.category || 'Abarrotes',
      brand: product.brand || '',
      costPrice: product.costPrice || 0,
      salePrice: product.salePrice,
      stock: product.stock,
      minStock: product.minStock || 5,
      unit: product.unit || 'unidad',
      supplierId: product.supplierId || '',
      active: product.active ?? true,
      allowDecimals: product.allowDecimals ?? false,
      expirationDate: product.expirationDate || '',
    });
    setShowModal(true);
  };

  // Profit margin calculation helper
  const marginPercentage = formData.salePrice > 0
    ? (((formData.salePrice - formData.costPrice) / formData.salePrice) * 100).toFixed(1)
    : '0.0';

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBusiness) return;
    if (!formData.name.trim()) {
      alert('El nombre del producto es obligatorio.');
      return;
    }
    if (formData.salePrice <= 0) {
      alert('El precio de venta debe ser mayor a $0.');
      return;
    }

    setIsSaving(true);
    const prodId = editingProduct ? editingProduct.id : `prod_${Date.now()}`;
    const nowIso = new Date().toISOString();

    const selectedSupplier = suppliers.find(s => s.id === formData.supplierId);

    const productPayload: Product = {
      id: prodId,
      businessId: currentBusiness.id,
      name: formData.name.trim(),
      description: formData.description.trim(),
      barcode: formData.barcode.trim(),
      internalCode: formData.internalCode.trim(),
      category: formData.category,
      brand: formData.brand.trim(),
      costPrice: Number(formData.costPrice) || 0,
      salePrice: Number(formData.salePrice) || 0,
      stock: Number(formData.stock) || 0,
      minStock: Number(formData.minStock) || 0,
      unit: formData.unit,
      supplierId: formData.supplierId || undefined,
      supplierName: selectedSupplier?.name || undefined,
      active: formData.active,
      allowDecimals: formData.allowDecimals,
      expirationDate: formData.expirationDate || undefined,
      createdAt: editingProduct ? editingProduct.createdAt : nowIso,
      updatedAt: nowIso,
    };

    try {
      await setDoc(doc(db, `businesses/${currentBusiness.id}/products`, prodId), productPayload);
      setShowModal(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `businesses/${currentBusiness.id}/products/${prodId}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    if (!currentBusiness) return;
    const confirmDelete = window.confirm(`¿Seguro que deseas eliminar el producto "${product.name}"?`);
    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, `businesses/${currentBusiness.id}/products`, product.id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `businesses/${currentBusiness.id}/products/${product.id}`);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const rows = products.map(p => ({
      'Código de Barras': p.barcode || '',
      'Código Interno': p.internalCode || '',
      'Nombre': p.name,
      'Categoría': p.category,
      'Marca': p.brand || '',
      'Precio Costo (COP)': p.costPrice,
      'Precio Venta (COP)': p.salePrice,
      'Existencia': p.stock,
      'Stock Mínimo': p.minStock,
      'Unidad': p.unit,
      'Permite Decimales (Peso)': p.allowDecimals ? 'SÍ' : 'NO',
      'Activo': p.active ? 'SÍ' : 'NO',
      'Proveedor': p.supplierName || ''
    }));
    downloadCSV(`productos_${currentBusiness?.name || 'tienda'}`, rows);
  };

  // Import CSV
  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentBusiness) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        const lines = text.split(/\r\n|\n/).filter(l => l.trim().length > 0);
        if (lines.length < 2) {
          alert('El archivo no contiene filas de datos.');
          return;
        }

        const maxLimit = currentBusiness.maxProducts || 500;
        const availableSlots = maxLimit - products.length;
        if (availableSlots <= 0) {
          alert(`Has alcanzado el límite de ${maxLimit} productos permitido en tu Plan Mensual ($40.000 COP). Contacta a soporte vía WhatsApp (+51 912391502) para ampliar el plan.`);
          return;
        }

        let importedCount = 0;
        // Parse CSV simple lines (respecting maxLimit)
        for (let i = 1; i < lines.length; i++) {
          if (products.length + importedCount >= maxLimit) {
            alert(`Se importaron ${importedCount} productos hasta alcanzar el límite máximo de ${maxLimit} productos de tu plan.`);
            break;
          }
          const cols = lines[i].split(',').map(c => c.replace(/^"|"$/g, '').trim());
          if (cols.length >= 4 && cols[2]) { // If name column exists
            const prodId = `prod_imp_${Date.now()}_${i}`;
            const item: Product = {
              id: prodId,
              businessId: currentBusiness.id,
              barcode: cols[0] || '',
              internalCode: cols[1] || '',
              name: cols[2] || 'Producto sin nombre',
              category: cols[3] || 'Abarrotes',
              brand: cols[4] || '',
              costPrice: parseFloat(cols[5]) || 0,
              salePrice: parseFloat(cols[6]) || 1000,
              stock: parseFloat(cols[7]) || 0,
              minStock: parseFloat(cols[8]) || 5,
              unit: 'unidad',
              active: true,
              allowDecimals: false,
              createdAt: new Date().toISOString(),
            };
            await setDoc(doc(db, `businesses/${currentBusiness.id}/products`, prodId), item);
            importedCount++;
          }
        }
        alert(`¡Se importaron ${importedCount} productos exitosamente!`);
      } catch (err) {
        console.error('Error importing CSV:', err);
        alert('Hubo un error al procesar el archivo CSV.');
      }
    };
    reader.readAsText(file);
  };

  // Filter products
  const filteredProducts = products.filter(p => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = 
      p.name.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.includes(q)) ||
      (p.internalCode && p.internalCode.toLowerCase().includes(q));

    const matchesCategory = categoryFilter === 'TODAS' || p.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-5 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Package className="w-6 h-6 text-emerald-700" />
            <h1 className="text-2xl font-black text-stone-900 tracking-tight">Catálogo de Productos</h1>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Administra precios de costo, precios de venta en COP, categorías y unidades de medida.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Import CSV input */}
          <label className="cursor-pointer flex items-center gap-1.5 bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 font-semibold px-3 py-2 rounded-xl text-xs shadow-xs transition">
            <Upload className="w-3.5 h-3.5 text-stone-500" />
            <span>Importar CSV</span>
            <input
              type="file"
              accept=".csv"
              onChange={handleImportCSV}
              className="hidden"
            />
          </label>

          <button
            onClick={handleExportCSV}
            disabled={products.length === 0}
            className="flex items-center gap-1.5 bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 font-semibold px-3 py-2 rounded-xl text-xs shadow-xs transition"
          >
            <Download className="w-3.5 h-3.5 text-stone-500" />
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 py-2 rounded-xl text-xs sm:text-sm shadow-sm transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Producto</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar por nombre, código de barras o código interno..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          <Filter className="w-4 h-4 text-stone-400" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-semibold text-stone-700 focus:outline-none"
          >
            <option value="TODAS">Todas las categorías ({products.length})</option>
            {PRODUCT_CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-stone-400 text-sm">Cargando productos...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-12 text-center text-stone-400 space-y-2">
            <Package className="w-10 h-10 mx-auto text-stone-300" />
            <p className="font-semibold text-stone-600">No hay productos que coincidan con la búsqueda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 text-xs font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3.5">Producto</th>
                  <th className="p-3.5">Categoría</th>
                  <th className="p-3.5 text-right">Costo COP</th>
                  <th className="p-3.5 text-right">Venta COP</th>
                  <th className="p-3.5 text-center">Margen %</th>
                  <th className="p-3.5 text-center">Stock</th>
                  <th className="p-3.5 text-center">Estado</th>
                  <th className="p-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredProducts.map((p) => {
                  const margin = p.salePrice > 0 ? (((p.salePrice - (p.costPrice || 0)) / p.salePrice) * 100).toFixed(0) : '0';
                  const isLow = p.stock <= p.minStock;
                  return (
                    <tr key={p.id} className="hover:bg-stone-50/80 transition">
                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="font-bold text-stone-900">{p.name}</p>
                            <p className="text-[11px] text-stone-400">
                              {p.barcode ? `Cód: ${p.barcode}` : p.internalCode || 'Sin código'}
                              {p.allowDecimals && ' • Venta por peso'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5 text-stone-600">{p.category}</td>
                      <td className="p-3.5 text-right text-stone-600 font-medium">
                        {formatCOP(p.costPrice)}
                      </td>
                      <td className="p-3.5 text-right font-extrabold text-emerald-700">
                        {formatCOP(p.salePrice)}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                          {margin}%
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`inline-block font-bold px-2 py-0.5 rounded-full text-xs ${
                          p.stock <= 0
                            ? 'bg-rose-100 text-rose-700'
                            : isLow
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-stone-100 text-stone-700'
                        }`}>
                          {formatQuantity(p.stock, p.allowDecimals)} {p.unit}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          p.active ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-600'
                        }`}>
                          {p.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="p-3.5 text-right whitespace-nowrap space-x-1">
                        <button
                          onClick={() => openEditModal(p)}
                          className="p-1.5 text-stone-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                          title="Editar producto"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(p)}
                          className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Eliminar producto"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* Product Modal (Create / Edit) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-stone-200 space-y-4 my-auto">
            
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <h3 className="font-extrabold text-stone-900 text-lg">
                {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-stone-400 hover:text-stone-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4">
              
              {/* Name & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Nombre del producto *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Arroz Diana 1000g"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm font-medium focus:ring-1 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Categoría
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm"
                  >
                    {PRODUCT_CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Marca (opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Diana, Colanta, Bimbo..."
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm"
                  />
                </div>
              </div>

              {/* Codes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Código de barras (EAN)
                  </label>
                  <input
                    type="text"
                    placeholder="7702011000018"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Código interno / Referencia
                  </label>
                  <input
                    type="text"
                    placeholder="ARR-DIA-01"
                    value={formData.internalCode}
                    onChange={(e) => setFormData({ ...formData, internalCode: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm font-mono"
                  />
                </div>
              </div>

              {/* Pricing & Profit Margin */}
              <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Precio Costo (Compra COP)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={formData.costPrice || ''}
                    onChange={(e) => setFormData({ ...formData, costPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-sm font-semibold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Precio Venta (Público COP) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    required
                    value={formData.salePrice || ''}
                    onChange={(e) => setFormData({ ...formData, salePrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 bg-white border border-emerald-400 rounded-lg text-sm font-bold text-emerald-800"
                  />
                </div>

                <div className="flex flex-col justify-center">
                  <span className="text-[11px] text-stone-500 font-semibold">Margen Bruto Calculado:</span>
                  <span className="text-lg font-black text-blue-700">
                    {marginPercentage}%
                  </span>
                  <span className="text-[10px] text-stone-400">
                    Ganancia: {formatCOP(formData.salePrice - formData.costPrice)}
                  </span>
                </div>
              </div>

              {/* Stock and Unit */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Existencia actual
                  </label>
                  <input
                    type="number"
                    step={formData.allowDecimals ? '0.01' : '1'}
                    value={formData.stock || ''}
                    onChange={(e) => setFormData({ ...formData, stock: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Stock Mínimo (Alerta)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.minStock || ''}
                    onChange={(e) => setFormData({ ...formData, minStock: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Unidad de Medida
                  </label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value as any })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm"
                  >
                    <option value="unidad">Unidad</option>
                    <option value="kg">Kilogramo (kg)</option>
                    <option value="lb">Libra (lb)</option>
                    <option value="g">Gramo (g)</option>
                    <option value="litro">Litro (L)</option>
                    <option value="paquete">Paquete</option>
                    <option value="caja">Caja</option>
                  </select>
                </div>
              </div>

              {/* Toggles: Allow decimals (weight) & Active */}
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-stone-800">
                  <input
                    type="checkbox"
                    checked={formData.allowDecimals}
                    onChange={(e) => setFormData({ ...formData, allowDecimals: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                  <span>Permite cantidades decimales (Venta por peso en balanza, ej. 1.25 kg de queso o papa)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-semibold text-stone-800">
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                  <span>Producto disponible para la venta</span>
                </label>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={isSaving}
                  className="flex-1 py-2.5 border border-stone-300 text-stone-700 text-xs font-semibold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  {isSaving ? 'Guardando...' : 'Guardar Producto'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
