import React, { useState, useMemo } from 'react';
import { Product } from '../types';
import { formatCOP } from '../utils/currency';
import { Search, ShoppingCart } from 'lucide-react';

interface ProductSelectionModalProps {
  products: Product[];
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number) => void;
}

export const ProductSelectionModal: React.FC<ProductSelectionModalProps> = ({ products, onClose, onAddToCart }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('TODAS');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [weight, setWeight] = useState<string>('1.0');

  const categories = useMemo(() => {
    return ['TODAS', ...Array.from(new Set(products.map(p => p.category || 'Otros')))];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.active && (
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.barcode && p.barcode.includes(searchQuery))
      ) && (
        selectedCategory === 'TODAS' || p.category === selectedCategory
      )
    );
  }, [products, searchQuery, selectedCategory]);

  const handleAdd = (product: Product) => {
    if (product.allowDecimals) {
      setSelectedProduct(product);
      setWeight('1.0');
    } else {
      onAddToCart(product, 1);
      onClose();
    }
  };

  const handleConfirmWeight = () => {
    if (selectedProduct) {
      onAddToCart(selectedProduct, parseFloat(weight) || 0);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-2 sm:p-4">
      <div className="bg-white dark:bg-stone-900 rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-stone-200 dark:border-stone-700">
        <div className="p-4 border-b border-stone-200 dark:border-stone-700 flex items-center justify-between">
          <h2 className="font-bold text-stone-900 dark:text-stone-100">Seleccionar Producto</h2>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200">✕</button>
        </div>

        {!selectedProduct ? (
          <>
            <div className="p-3 border-b border-stone-200 dark:border-stone-700 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-stone-400" />
                <input
                  type="text"
                  placeholder="Buscar producto..."
                  className="w-full pl-9 pr-3 py-2 border border-stone-300 dark:border-stone-600 rounded-xl text-sm bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap transition ${
                      selectedCategory === cat
                        ? 'bg-emerald-700 text-white'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredProducts.map(p => (
                <button
                  key={p.id}
                  onClick={() => handleAdd(p)}
                  className="w-full text-left p-3 border-b border-stone-100 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800 flex items-center justify-between rounded-lg transition"
                >
                  <div>
                    <p className="font-bold text-sm text-stone-900 dark:text-stone-100">{p.name}</p>
                    <p className="text-xs text-stone-500 dark:text-stone-400">{formatCOP(p.salePrice)} / {p.unit}</p>
                  </div>
                  <ShoppingCart className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="p-6 space-y-4">
            <h3 className="font-bold text-lg text-stone-900 dark:text-stone-100">{selectedProduct.name}</h3>
            <p className="text-sm text-stone-600 dark:text-stone-300">Ingrese el peso en {selectedProduct.unit}:</p>
            <input
              type="number"
              step="0.05"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full p-3 border-2 border-emerald-600 dark:border-emerald-500 rounded-xl text-2xl font-black text-center bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none"
            />
            <div className="flex gap-2">
              <button onClick={() => setSelectedProduct(null)} className="flex-1 py-3 bg-stone-100 dark:bg-stone-700 text-stone-700 dark:text-stone-200 rounded-xl font-bold hover:bg-stone-200 dark:hover:bg-stone-600">Cancelar</button>
              <button onClick={handleConfirmWeight} className="flex-1 py-3 bg-emerald-700 text-white rounded-xl font-bold hover:bg-emerald-800">Agregar al Carrito</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
