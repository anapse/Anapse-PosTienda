export type UserRole = 'owner' | 'admin' | 'cashier';

export interface Business {
  id: string;
  name: string;
  ownerId: string;
  nit: string;
  phone: string;
  address: string;
  city: string;
  currency: 'COP';
  slug: string;
  whatsapp: string;
  catalogActive: boolean;
  receiptFooter: string;
  createdAt: string;
  updatedAt?: string;
}

export interface BusinessMember {
  id: string;
  userId: string;
  email: string;
  displayName: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
}

export interface Product {
  id: string;
  businessId: string;
  name: string;
  description?: string;
  barcode?: string;
  internalCode?: string;
  category: string;
  brand?: string;
  costPrice: number; // Precio de costo en COP
  salePrice: number; // Precio de venta en COP
  stock: number;
  minStock: number;
  unit: 'unidad' | 'kg' | 'lb' | 'g' | 'litro' | 'paquete' | 'caja';
  imageUrl?: string;
  supplierId?: string;
  supplierName?: string;
  active: boolean;
  allowDecimals: boolean; // para pesar en balanza: ej. 1.25 kg
  expirationDate?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  discount: number;
}

export type MovementType = 'IN' | 'OUT' | 'ADJUST' | 'SALE' | 'PURCHASE' | 'RETURN';

export interface StockMovement {
  id: string;
  businessId: string;
  productId: string;
  productName: string;
  type: MovementType;
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  cost?: number;
  referenceId?: string;
  userId: string;
  userName: string;
  createdAt: string;
}

export type PaymentMethod = 'cash' | 'nequi' | 'daviplata' | 'transfer' | 'card' | 'credit';

export interface PaymentRecord {
  method: PaymentMethod;
  amount: number;
  reference?: string;
}

export interface SaleItem {
  productId: string;
  name: string;
  barcode?: string;
  unit: string;
  quantity: number;
  costPrice: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
  total: number;
}

export type SaleStatus = 'PAID' | 'PARTIAL' | 'CREDIT' | 'CANCELLED' | 'RETURNED';

export interface Sale {
  id: string;
  saleNumber: number;
  businessId: string;
  cashierId: string;
  cashierName: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerNit?: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  costTotal: number;
  grossProfit: number; // total - costTotal
  status: SaleStatus;
  payments: PaymentRecord[];
  amountPaid: number;
  pendingAmount: number; // Fiado
  cashReceived?: number;
  changeGiven?: number;
  notes?: string;
  createdAt: string;
  cancelledAt?: string;
  cancelReason?: string;
}

export interface Customer {
  id: string;
  businessId: string;
  name: string;
  documentType?: 'CC' | 'NIT' | 'CE' | 'Pasaporte';
  documentNumber?: string;
  phone?: string;
  address?: string;
  neighborhood?: string;
  creditLimit: number;
  currentDebt: number;
  notes?: string;
  createdAt: string;
}

export interface CustomerMovement {
  id: string;
  businessId: string;
  customerId: string;
  saleId?: string;
  type: 'DEBT' | 'PAYMENT';
  amount: number;
  previousDebt: number;
  newDebt: number;
  paymentMethod?: PaymentMethod;
  notes?: string;
  userId: string;
  userName: string;
  createdAt: string;
}

export interface CashShift {
  id: string;
  businessId: string;
  cashierId: string;
  cashierName: string;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt?: string;
  initialCash: number;
  cashSales: number;
  nequiSales: number;
  daviplataSales: number;
  transferSales: number;
  cardSales: number;
  creditSales: number;
  cashIn: number;
  cashOut: number;
  expectedCash: number; // initialCash + cashSales + cashIn - cashOut
  countedCash?: number;
  difference?: number; // countedCash - expectedCash
  closingNotes?: string;
}

export interface CashMovement {
  id: string;
  businessId: string;
  shiftId: string;
  type: 'IN' | 'OUT';
  category: string;
  amount: number;
  description: string;
  userId: string;
  userName: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  businessId: string;
  name: string;
  nit?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  notes?: string;
  createdAt: string;
}

export interface PurchaseItem {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  subtotal: number;
}

export interface Purchase {
  id: string;
  purchaseNumber: number;
  businessId: string;
  supplierId: string;
  supplierName: string;
  invoiceNumber?: string;
  items: PurchaseItem[];
  total: number;
  status: 'RECEIVED' | 'PENDING' | 'CANCELLED';
  paymentStatus: 'PAID' | 'CREDIT' | 'PARTIAL';
  paidAmount: number;
  notes?: string;
  userId: string;
  createdAt: string;
}

export interface CatalogOrder {
  id: string;
  orderNumber: number;
  businessId: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }[];
  total: number;
  deliveryMethod: 'DOMICILIO' | 'RECOGER_EN_TIENDA';
  paymentMethodPreference: string;
  notes?: string;
  status: 'NUEVO' | 'CONFIRMADO' | 'EN_CAMINO' | 'ENTREGADO' | 'CANCELADO';
  createdAt: string;
}
