import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Product } from '../types';
import { formatCOP, formatQuantity } from '../utils/currency';
import { Search, ShoppingCart, Plus, Check, Scale, Sparkles, X, Package } from 'lucide-react';

interface ProductSelectionModalProps {
  products: Product[];
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number, skipPrompt?: boolean) => void;
  onSeedSampleData?: () => void;
  cartItems?: { product: Product; quantity: number }[];
  cartTotal?: number;
}

export const ProductSelectionModal: React.FC<ProductSelectionModalProps> = ({ 
  products, 
  onClose, 
  onAddToCart,
  onSeedSampleData,
  cartItems = [],
  cartTotal = 0
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('TODAS');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [weight, setWeight] = useState<string>('1.0');
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus search on open
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  }, []);

  const categories = useMemo(() => {
    return ['TODAS', ...Array.from(new Set(products.map(p => p.category || 'Otros')))];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return products.filter(p => 
      p.active && (
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q))
      ) && (
        selectedCategory === 'TODAS' || p.category === selectedCategory
      )
    );
  }, [products, searchQuery, selectedCategory]);

  // Map product id to current cart quantity
  const cartQuantities = useMemo(() => {
    const map = new Map<string, number>();
    cartItems.forEach(item => {
      map.set(item.product.id, item.quantity);
    });
    return map;
  }, [cartItems]);

  const totalCartCount = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.quantity, 0);
  }, [cartItems]);

  const handleAdd = (product: Product) => {
    if (product.allowDecimals) {
      setSelectedProduct(product);
      setWeight('1.0');
    } else {
      onAddToCart(product, 1, true);
      onClose();
    }
  };

  const handleConfirmWeight = () => {
    if (selectedProduct) {
      const val = parseFloat(weight) || 1;
      onAddToCart(selectedProduct, val, true);
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-stone-900 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-stone-200 dark:border-stone-800 my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="p-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/70 dark:bg-stone-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 flex items-center justify-center font-bold">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-stone-900 dark:text-stone-100">
                Seleccionar Producto
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Haz clic en el producto para agregarlo al carrito de venta
              </p>
            </div>
          </div>

          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-800 transition"
            title="Cerrar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!selectedProduct ? (
          <>
            {/* Search & Category Filter Section */}
            <div className="p-3 sm:p-4 border-b border-stone-200 dark:border-stone-800 space-y-2.5 bg-white dark:bg-stone-900">
              <div className="relative">
                <Search className="absolute left-3.5 top-3 w-4 h-4 text-stone-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Buscar por nombre, código de barras o categoría..."
                  className="w-full pl-10 pr-4 py-2.5 border border-stone-300 dark:border-stone-700 rounded-xl text-sm bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-emerald-600 focus:outline-none transition"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-2.5 text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Categories */}
              {categories.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                        selectedCategory === cat
                          ? 'bg-emerald-700 text-white shadow-xs'
                          : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product List Content */}
            <div className="flex-1 overflow-y-auto p-2 sm:p-3 divide-y divide-stone-100 dark:divide-stone-800/80">
              {products.length === 0 ? (
                <div className="p-8 text-center space-y-3.5 my-auto">
                  <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 flex items-center justify-center mx-auto text-3xl shadow-inner">
                    🏪
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-base text-stone-900 dark:text-stone-100">
                      No hay productos registrados
                    </p>
                    <p className="text-xs text-stone-500 dark:text-stone-400 max-w-sm mx-auto">
                      Esta tienda no tiene productos en el inventario. Puedes cargar el catálogo colombiano de prueba para comenzar de inmediato.
                    </p>
                  </div>
                  {onSeedSampleData && (
                    <button
                      onClick={onSeedSampleData}
                      className="bg-emerald-700 hover:bg-emerald-600 text-white font-black px-5 py-2.5 rounded-xl text-xs shadow-md transition active:scale-95 inline-flex items-center gap-2 mx-auto"
                    >
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>Cargar Catálogo de Prueba</span>
                    </button>
                  )}
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="p-10 text-center space-y-2">
                  <p className="font-bold text-sm text-stone-700 dark:text-stone-300">
                    No se encontraron productos
                  </p>
                  <p className="text-xs text-stone-400">
                    No hay resultados para &quot;{searchQuery}&quot; en la categoría seleccionada.
                  </p>
                  <button
                    onClick={() => { setSearchQuery(''); setSelectedCategory('TODAS'); }}
                    className="text-xs text-emerald-700 dark:text-emerald-400 font-bold hover:underline"
                  >
                    Restablecer búsqueda
                  </button>
                </div>
              ) : (
                filteredProducts.map((p) => {
                  const inCartQty = cartQuantities.get(p.id) || 0;
                  const isJustAdded = justAddedId === p.id;

                  return (
                    <div
                      key={p.id}
                      onClick={() => handleAdd(p)}
                      className={`p-3 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition select-none ${
                        isJustAdded 
                          ? 'bg-emerald-100/70 dark:bg-emerald-950/70 border border-emerald-400' 
                          : inCartQty > 0
                          ? 'bg-emerald-50/40 dark:bg-emerald-950/20 hover:bg-emerald-50/80 dark:hover:bg-emerald-950/40'
                          : 'hover:bg-stone-50 dark:hover:bg-stone-800/60'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-sm sm:text-base text-stone-900 dark:text-stone-100">
                            {p.name}
                          </p>
                          {p.allowDecimals && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 flex items-center gap-0.5">
                              <Scale className="w-2.5 h-2.5" />
                              <span>Balanza</span>
                            </span>
                          )}
                          {inCartQty > 0 && (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-600 text-white flex items-center gap-1 shadow-xs">
                              <Check className="w-3 h-3" />
                              <span>{formatQuantity(inCartQty, p.allowDecimals)} en carrito</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-1 text-xs text-stone-500 dark:text-stone-400 flex-wrap">
                          <span className="font-semibold text-stone-600 dark:text-stone-300">
                            {p.category}
                          </span>
                          <span>•</span>
                          <span>Stock: {p.stock} {p.unit}</span>
                          {p.barcode && (
                            <>
                              <span>•</span>
                              <span className="font-mono text-[11px] text-stone-400">{p.barcode}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className="font-black text-sm sm:text-base text-emerald-700 dark:text-emerald-400 font-mono">
                            {formatCOP(p.salePrice)}
                          </p>
                          <p className="text-[10px] text-stone-400 dark:text-stone-500">
                            por {p.unit}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAdd(p);
                          }}
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold transition active:scale-95 shadow-xs ${
                            isJustAdded
                              ? 'bg-emerald-600 text-white'
                              : 'bg-emerald-700 hover:bg-emerald-600 text-white'
                          }`}
                          title={`Agregar ${p.name}`}
                        >
                          {isJustAdded ? (
                            <Check className="w-4 h-4 animate-bounce" />
                          ) : (
                            <Plus className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer with Live Cart Counter & Done Button */}
            <div className="p-3 sm:p-4 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/80 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <span className="text-xs sm:text-sm font-bold text-stone-700 dark:text-stone-200">
                  {totalCartCount === 0 ? 'Carrito vacío' : `${formatQuantity(totalCartCount, false)} articulos`}
                </span>
                {cartTotal > 0 && (
                  <span className="text-xs sm:text-sm font-black text-emerald-700 dark:text-emerald-400 font-mono">
                    ({formatCOP(cartTotal)})
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="py-2 px-5 bg-emerald-700 hover:bg-emerald-600 text-white font-black text-xs sm:text-sm rounded-xl transition active:scale-95 shadow-md flex items-center gap-1.5"
              >
                <span>Listo / Volver a Caja</span>
                <Check className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          /* Decimal / Weight Selection Sub-view */
          <div className="p-6 space-y-4 my-auto">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-base">
              <Scale className="w-5 h-5" />
              <span>Venta por Balanza / Peso</span>
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-stone-900 dark:text-stone-100">
                {selectedProduct.name}
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Precio: {formatCOP(selectedProduct.salePrice)} por {selectedProduct.unit}
              </p>
            </div>

            <div className="p-4 bg-stone-50 dark:bg-stone-800/50 rounded-2xl border border-stone-200 dark:border-stone-700 space-y-3">
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block">
                Ingrese el peso / cantidad en {selectedProduct.unit}:
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.05"
                  min="0.01"
                  autoFocus
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmWeight();
                  }}
                  className="w-full p-3 border-2 border-emerald-600 dark:border-emerald-500 rounded-xl text-3xl font-black text-center bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 focus:outline-none shadow-inner"
                />
                <span className="absolute right-4 top-4 text-xs font-bold text-stone-400">
                  {selectedProduct.unit}
                </span>
              </div>

              {/* Quick weight shortcuts */}
              <div className="flex items-center justify-center gap-2 pt-1">
                {['0.25', '0.5', '1.0', '1.5', '2.0'].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setWeight(val)}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 hover:border-emerald-500 transition text-stone-700 dark:text-stone-300"
                  >
                    {val} {selectedProduct.unit}
                  </button>
                ))}
              </div>

              <div className="text-center pt-2 border-t border-stone-200 dark:border-stone-700">
                <span className="text-xs text-stone-500 dark:text-stone-400">Subtotal del producto: </span>
                <span className="font-black text-base text-emerald-700 dark:text-emerald-400">
                  {formatCOP(selectedProduct.salePrice * (parseFloat(weight) || 0))}
                </span>
              </div>
            </div>

            <div className="flex gap-2.5">
              <button 
                type="button"
                onClick={() => setSelectedProduct(null)} 
                className="flex-1 py-3 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-xl font-bold hover:bg-stone-200 dark:hover:bg-stone-700 transition"
              >
                Volver
              </button>
              <button 
                type="button"
                onClick={handleConfirmWeight} 
                className="flex-1 py-3 bg-emerald-700 text-white rounded-xl font-bold hover:bg-emerald-600 shadow-md transition active:scale-98 flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar al Carrito</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
