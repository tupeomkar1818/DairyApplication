import type { IProductService } from '@/src/domain/products/service.interface';
import type { CreateProductRequest, ProductListResponse, ProductResponse, UpdateProductRequest } from '@/src/domain/products/dtos';
import type { Product } from '@/src/domain/products/entities';
import { readJson, writeJson } from '@/src/infrastructure/storage/storage';
import { PRODUCTS_STORE_KEY } from '@/src/infrastructure/storage/keys';

const DEFAULT_DELAY_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function nowIso(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

async function readProducts(): Promise<Product[]> {
  return (await readJson<Product[]>(PRODUCTS_STORE_KEY)) ?? [];
}

async function writeProducts(items: Product[]): Promise<void> {
  await writeJson(PRODUCTS_STORE_KEY, items);
}

function normalizeProduct(p: Product): Product {
  return {
    ...p,
    isVisibleOfflineCounter: (p as any).isVisibleOfflineCounter ?? true,
  };
}

async function ensureSeedProducts(): Promise<Product[]> {
  const existing = await readProducts();
  if (existing.length > 0) {
    const normalized = existing.map(normalizeProduct);
    const changed = normalized.some((p, i) => (existing[i] as any).isVisibleOfflineCounter !== (p as any).isVisibleOfflineCounter);
    if (changed) await writeProducts(normalized);
    return normalized;
  }

  const now = nowIso();
  const seeded: Product[] = [
    {
      id: newId('prod'),
      name: 'Cow Milk',
      category: 'Milk',
      productType: 'Milk',
      price: 56,
      discountPrice: 52,
      unit: 'Litre',
      variants: ['500 ml', '1 Litre'],
      customVariantLabel: '',
      description: 'Fresh cow milk for daily delivery',
      availableStock: 120,
      minStockAlert: 20,
      availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      deliveryTimeSlots: ['Morning', 'Evening'],
      availability: 'Available',
      sku: 'AD-COW-1L',
      imageUri: '',
      features: ['Fresh Product', 'Home Delivery Available', 'Subscription Available'],
      taxApplicable: false,
      taxPercentage: '0%',
      isVisibleToCustomer: true,
      isVisibleOfflineCounter: true,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: newId('prod'),
      name: 'Buffalo Milk',
      category: 'Milk',
      productType: 'Milk',
      price: 64,
      discountPrice: 0,
      unit: 'Litre',
      variants: ['500 ml', '1 Litre'],
      customVariantLabel: '',
      description: 'Rich buffalo milk with higher fat content',
      availableStock: 75,
      minStockAlert: 15,
      availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      deliveryTimeSlots: ['Morning', 'Evening'],
      availability: 'Available',
      sku: 'AD-BUF-1L',
      imageUri: '',
      features: ['Fresh Product', 'Home Delivery Available'],
      taxApplicable: false,
      taxPercentage: '0%',
      isVisibleToCustomer: true,
      isVisibleOfflineCounter: true,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: newId('prod'),
      name: 'Paneer',
      category: 'Paneer',
      productType: 'Milk Product',
      price: 90,
      discountPrice: 0,
      unit: 'Packet',
      variants: ['250 ml'],
      customVariantLabel: '',
      description: 'Soft fresh paneer',
      availableStock: 35,
      minStockAlert: 10,
      availableDays: ['Monday', 'Wednesday', 'Friday', 'Saturday'],
      deliveryTimeSlots: ['Morning'],
      availability: 'Available',
      sku: 'AD-PAN-200G',
      imageUri: '',
      features: ['Fresh Product', 'Refrigeration Required'],
      taxApplicable: true,
      taxPercentage: '5%',
      isVisibleToCustomer: true,
      isVisibleOfflineCounter: true,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: newId('prod'),
      name: 'Ghee',
      category: 'Ghee',
      productType: 'Milk Product',
      price: 620,
      discountPrice: 599,
      unit: 'Bottle',
      variants: ['Custom Size'],
      customVariantLabel: '500 ml',
      description: 'Pure cow ghee',
      availableStock: 12,
      minStockAlert: 5,
      availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      deliveryTimeSlots: ['Morning', 'Afternoon', 'Evening'],
      availability: 'Available',
      sku: 'AD-GHE-500',
      imageUri: '',
      features: ['Best Seller'],
      taxApplicable: true,
      taxPercentage: '12%',
      isVisibleToCustomer: true,
      isVisibleOfflineCounter: true,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: newId('prod'),
      name: 'Curd',
      category: 'Curd',
      productType: 'Milk Product',
      price: 40,
      discountPrice: 0,
      unit: 'Packet',
      variants: ['500 ml'],
      customVariantLabel: '',
      description: 'Thick and creamy curd',
      availableStock: 0,
      minStockAlert: 10,
      availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      deliveryTimeSlots: ['Morning'],
      availability: 'Out of Stock',
      sku: 'AD-CUR-500',
      imageUri: '',
      features: ['Refrigeration Required'],
      taxApplicable: false,
      taxPercentage: '0%',
      isVisibleToCustomer: true,
      isVisibleOfflineCounter: true,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: newId('prod'),
      name: 'Butter',
      category: 'Butter',
      productType: 'Milk Product',
      price: 55,
      discountPrice: 0,
      unit: 'Packet',
      variants: ['250 ml'],
      customVariantLabel: '',
      description: 'Creamy butter',
      availableStock: 28,
      minStockAlert: 8,
      availableDays: ['Monday', 'Wednesday', 'Friday', 'Saturday'],
      deliveryTimeSlots: ['Morning'],
      availability: 'Available',
      sku: 'AD-BUT-100',
      imageUri: '',
      features: ['Refrigeration Required'],
      taxApplicable: false,
      taxPercentage: '0%',
      isVisibleToCustomer: true,
      isVisibleOfflineCounter: true,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: newId('prod'),
      name: 'Cheese',
      category: 'Cheese',
      productType: 'Milk Product',
      price: 120,
      discountPrice: 0,
      unit: 'Packet',
      variants: ['250 ml'],
      customVariantLabel: '',
      description: 'Cheddar cheese slices',
      availableStock: 18,
      minStockAlert: 6,
      availableDays: ['Tuesday', 'Thursday', 'Saturday'],
      deliveryTimeSlots: ['Morning'],
      availability: 'Available',
      sku: 'AD-CHE-200',
      imageUri: '',
      features: ['Refrigeration Required'],
      taxApplicable: true,
      taxPercentage: '12%',
      isVisibleToCustomer: true,
      isVisibleOfflineCounter: true,
      isActive: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: newId('prod'),
      name: 'Lassi',
      category: 'Lassi',
      productType: 'Milk Product',
      price: 25,
      discountPrice: 0,
      unit: 'Bottle',
      variants: ['250 ml', '500 ml'],
      customVariantLabel: '',
      description: 'Refreshing sweet lassi',
      availableStock: 60,
      minStockAlert: 15,
      availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      deliveryTimeSlots: ['Afternoon', 'Evening'],
      availability: 'Available',
      sku: 'AD-LAS-200',
      imageUri: '',
      features: ['Best Seller', 'Home Delivery Available'],
      taxApplicable: false,
      taxPercentage: '0%',
      isVisibleToCustomer: true,
      isVisibleOfflineCounter: true,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  ];

  await writeProducts(seeded);
  return seeded;
}

export class ProductServiceMock implements IProductService {
  async list(): Promise<ProductListResponse> {
    await sleep(DEFAULT_DELAY_MS);
    const items = await ensureSeedProducts();
    return { items, total: items.length };
  }

  async create(data: CreateProductRequest): Promise<ProductResponse> {
    await sleep(DEFAULT_DELAY_MS);
    const items = await ensureSeedProducts();
    const now = nowIso();
    const created: Product = {
      id: newId('prod'),
      name: data.name.trim(),
      category: data.category.trim(),
      productType: data.productType,
      price: data.price,
      discountPrice: data.discountPrice,
      unit: data.unit,
      variants: data.variants ?? [],
      customVariantLabel: data.customVariantLabel?.trim() ? data.customVariantLabel.trim() : '',
      description: (data.description ?? '').trim(),
      availableStock: data.availableStock,
      minStockAlert: data.minStockAlert,
      availableDays: data.availableDays ?? [],
      deliveryTimeSlots: data.deliveryTimeSlots ?? [],
      availability: data.availability,
      sku: data.sku?.trim() ? data.sku.trim() : '',
      imageUri: data.imageUri?.trim() ? data.imageUri.trim() : '',
      features: data.features ?? [],
      taxApplicable: data.taxApplicable,
      taxPercentage: data.taxPercentage,
      isVisibleToCustomer: data.isVisibleToCustomer,
      isVisibleOfflineCounter: data.isVisibleOfflineCounter,
      isActive: data.isActive,
      createdAt: now,
      updatedAt: now,
    };
    const next = [created, ...items];
    await writeProducts(next);
    return created;
  }

  async update(id: string, data: UpdateProductRequest): Promise<ProductResponse> {
    await sleep(DEFAULT_DELAY_MS);
    const items = await ensureSeedProducts();
    const idx = items.findIndex((p) => p.id === id);
    if (idx < 0) return items[0] as ProductResponse;

    const now = nowIso();
    const current = items[idx]!;
    const updated: Product = {
      ...current,
      ...data,
      name: data.name !== undefined ? data.name.trim() : current.name,
      category: data.category !== undefined ? data.category.trim() : current.category,
      description: data.description !== undefined ? data.description.trim() : current.description,
      imageUri: data.imageUri !== undefined ? (data.imageUri.trim() ? data.imageUri.trim() : '') : current.imageUri,
      sku: data.sku !== undefined ? (data.sku.trim() ? data.sku.trim() : '') : current.sku,
      customVariantLabel: data.customVariantLabel !== undefined ? (data.customVariantLabel.trim() ? data.customVariantLabel.trim() : '') : current.customVariantLabel,
      updatedAt: now,
    };

    const next = [...items];
    next[idx] = updated;
    await writeProducts(next);
    return updated;
  }

  async delete(id: string): Promise<void> {
    await sleep(DEFAULT_DELAY_MS);
    const items = await ensureSeedProducts();
    const next = items.filter((p) => p.id !== id);
    await writeProducts(next);
  }
}

