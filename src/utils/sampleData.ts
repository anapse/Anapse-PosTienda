import { Product, Supplier } from '../types';
import { db } from '../firebase/config';
import { doc, setDoc } from 'firebase/firestore';

export async function seedBusinessSampleData(businessId: string): Promise<number> {
  // 1. Add sample suppliers
  for (let i = 0; i < SAMPLE_SUPPLIERS.length; i++) {
    const supp = SAMPLE_SUPPLIERS[i];
    const suppId = supp.nit ? `supp_${supp.nit.replace(/[^a-zA-Z0-9]/g, '')}` : `supp_${i + 1}`;
    await setDoc(doc(db, `businesses/${businessId}/suppliers`, suppId), {
      id: suppId,
      businessId,
      ...supp,
      createdAt: new Date().toISOString(),
    }, { merge: true });
  }

  // 2. Add sample products
  for (let i = 0; i < SAMPLE_PRODUCTS.length; i++) {
    const prod = SAMPLE_PRODUCTS[i];
    const prodId = prod.barcode ? `prod_${prod.barcode}` : `prod_${i + 1}`;
    await setDoc(doc(db, `businesses/${businessId}/products`, prodId), {
      id: prodId,
      businessId,
      ...prod,
      createdAt: new Date().toISOString(),
    }, { merge: true });
  }

  // 3. Add sample customer with initial fiado record
  const custId = `cust_dona_gloria`;
  await setDoc(doc(db, `businesses/${businessId}/customers`, custId), {
    id: custId,
    businessId,
    name: 'Doña Gloria Ramírez (Vecina Cra 12)',
    phone: '3145678901',
    documentType: 'CC',
    documentNumber: '52.345.678',
    address: 'Cra 12 # 4-18 Casa 2',
    neighborhood: 'El Poblado',
    creditLimit: 150000,
    currentDebt: 32000,
    notes: 'Cliente de confianza del barrio. Cancela cada quincena.',
    createdAt: new Date().toISOString(),
  }, { merge: true });

  return SAMPLE_PRODUCTS.length;
}

export const SAMPLE_SUPPLIERS: Omit<Supplier, 'id' | 'businessId' | 'createdAt'>[] = [
  {
    name: 'Distribuidora Bavaria S.A.',
    nit: '860.005.224-6',
    contactName: 'Carlos Montoya (Asesor Comercial)',
    phone: '3104509821',
    email: 'pedidos@bavaria.com.co',
    address: 'Zona Industrial Calle 13',
    city: 'Bogotá',
    notes: 'Despacho de cervezas y maltas los martes y viernes.'
  },
  {
    name: 'Postobón S.A.',
    nit: '890.903.939-5',
    contactName: 'Adriana Silva',
    phone: '3157821034',
    email: 'servicioalcliente@postobon.com.co',
    address: 'Av. Las Américas # 68-80',
    city: 'Bogotá',
    notes: 'Gaseosas, jugos Hit, aguas Cristal y Bretaña.'
  },
  {
    name: 'Cooperativa Colanta',
    nit: '890.900.589-3',
    contactName: 'Javier Ramírez',
    phone: '3129084422',
    email: 'ventas@colanta.com.co',
    address: 'Autopista Norte Km 15',
    city: 'Medellín',
    notes: 'Leche, quesos, mantequillas y yogures. Entrega diaria en la mañana.'
  },
  {
    name: 'Grupo Nutresa / Zenú / Noel',
    nit: '890.900.050-1',
    contactName: 'Paola Gómez',
    phone: '3203491820',
    email: 'contacto@nutresa.com',
    address: 'Carrera 52 # 2-38',
    city: 'Medellín',
    notes: 'Embutidos Zenú, galletas Noel, café Sello Rojo y pastas Doria.'
  }
];

export const SAMPLE_PRODUCTS: Omit<Product, 'id' | 'businessId' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Arroz Diana 1000g',
    description: 'Arroz blanco seleccionado de primera calidad',
    barcode: '7702011000018',
    internalCode: 'ARR-DIA-01',
    category: 'Abarrotes',
    brand: 'Diana',
    costPrice: 3800,
    salePrice: 4800,
    stock: 45,
    minStock: 10,
    unit: 'unidad',
    active: true,
    allowDecimals: false
  },
  {
    name: 'Aceite Premier Girasol 1000ml',
    description: 'Aceite vegetal de girasol libre de colesterol',
    barcode: '7702011000025',
    internalCode: 'ACE-PRE-01',
    category: 'Abarrotes',
    brand: 'Premier',
    costPrice: 9200,
    salePrice: 11500,
    stock: 24,
    minStock: 6,
    unit: 'unidad',
    active: true,
    allowDecimals: false
  },
  {
    name: 'Leche Entera Colanta 1000ml',
    description: 'Bolsa de leche entera pasteurizada ultra fresca',
    barcode: '7702011000032',
    internalCode: 'LEC-COL-01',
    category: 'Lácteos y Huevos',
    brand: 'Colanta',
    costPrice: 3400,
    salePrice: 4200,
    stock: 35,
    minStock: 12,
    unit: 'unidad',
    active: true,
    allowDecimals: false
  },
  {
    name: 'Huevos Rojos AA x 30 unidades',
    description: 'Cubeta de 30 huevos campesinos frescos',
    barcode: '7702011000049',
    internalCode: 'HUE-AA-30',
    category: 'Lácteos y Huevos',
    brand: 'Granja San Luis',
    costPrice: 15500,
    salePrice: 19000,
    stock: 18,
    minStock: 5,
    unit: 'paquete',
    active: true,
    allowDecimals: false
  },
  {
    name: 'Café Molido Sello Rojo 500g',
    description: 'Café tostado y molido tradicional colombiano',
    barcode: '7702011000056',
    internalCode: 'CAF-SEL-01',
    category: 'Abarrotes',
    brand: 'Sello Rojo',
    costPrice: 14200,
    salePrice: 17500,
    stock: 16,
    minStock: 4,
    unit: 'unidad',
    active: true,
    allowDecimals: false
  },
  {
    name: 'Pan Tajado Bimbo Blanco 450g',
    description: 'Pan tajado suave tradicional para sándwich',
    barcode: '7702011000063',
    internalCode: 'PAN-BIM-01',
    category: 'Panadería',
    brand: 'Bimbo',
    costPrice: 5600,
    salePrice: 7200,
    stock: 12,
    minStock: 4,
    unit: 'unidad',
    active: true,
    allowDecimals: false
  },
  {
    name: 'Gaseosa Postobón Manzana 1.5L',
    description: 'Bebida gaseosa sabor a manzana tradicional',
    barcode: '7702011000070',
    internalCode: 'GAS-POS-MAN',
    category: 'Bebidas y Licores',
    brand: 'Postobón',
    costPrice: 3600,
    salePrice: 4700,
    stock: 30,
    minStock: 8,
    unit: 'unidad',
    active: true,
    allowDecimals: false
  },
  {
    name: 'Cerveza Poker Lata 330ml',
    description: 'Cerveza rubia tradicional colombiana',
    barcode: '7702011000087',
    internalCode: 'CER-POK-LAT',
    category: 'Bebidas y Licores',
    brand: 'Bavaria',
    costPrice: 2400,
    salePrice: 3200,
    stock: 72,
    minStock: 24,
    unit: 'unidad',
    active: true,
    allowDecimals: false
  },
  {
    name: 'Papas Margarita Pollo 110g',
    description: 'Papas fritas crocantes sabor a pollo',
    barcode: '7702011000094',
    internalCode: 'SNK-MAR-POL',
    category: 'Snacks y Dulcería',
    brand: 'Margarita',
    costPrice: 3200,
    salePrice: 4200,
    stock: 28,
    minStock: 10,
    unit: 'paquete',
    active: true,
    allowDecimals: false
  },
  {
    name: 'Salchichón Zenú Tradicional 450g',
    description: 'Salchichón manguera de cerdo y res',
    barcode: '7702011000100',
    internalCode: 'CAR-ZEN-SAL',
    category: 'Carnes y Embutidos',
    brand: 'Zenú',
    costPrice: 8500,
    salePrice: 10800,
    stock: 15,
    minStock: 5,
    unit: 'unidad',
    active: true,
    allowDecimals: false
  },
  {
    name: 'Queso Costeño Fresco (por Kilo)',
    description: 'Queso costeño salado para picar o arepas, vendido por peso',
    barcode: '7702011000117',
    internalCode: 'LAC-QUE-COS',
    category: 'Lácteos y Huevos',
    brand: 'La Sabana',
    costPrice: 18000,
    salePrice: 24000,
    stock: 12.5,
    minStock: 3.0,
    unit: 'kg',
    active: true,
    allowDecimals: true
  },
  {
    name: 'Jabón Rey Barra 300g',
    description: 'Jabón azul multiusos tradicional colombiano',
    barcode: '7702011000124',
    internalCode: 'ASE-JAB-REY',
    category: 'Aseo y Hogar',
    brand: 'Dersa',
    costPrice: 2200,
    salePrice: 2900,
    stock: 40,
    minStock: 10,
    unit: 'unidad',
    active: true,
    allowDecimals: false
  }
];

export const PRODUCT_CATEGORIES = [
  'Abarrotes',
  'Lácteos y Huevos',
  'Bebidas y Licores',
  'Snacks y Dulcería',
  'Panadería',
  'Carnes y Embutidos',
  'Frutas y Verduras',
  'Aseo y Hogar',
  'Cuidado Personal',
  'Otros'
];
