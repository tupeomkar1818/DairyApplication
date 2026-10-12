import type { IProductService } from '@/src/domain/products/service.interface';
import type { CreateProductRequest, ProductListResponse, ProductResponse, UpdateProductRequest } from '@/src/domain/products/dtos';
import type { Product } from '@/src/domain/products/entities';
import { legacyFieldsFromPacks, productPacks, sanitizePacks } from '@/src/domain/products/packs';
import type { Customer } from '@/src/domain/customers/entities';
import { DomainError } from '@/src/domain/shared/errors';
import { strings } from '@/src/i18n/strings';
import { readJson, writeJson } from '@/src/infrastructure/storage/storage';
import { CUSTOMERS_STORE_KEY, PRODUCTS_STORE_KEY } from '@/src/infrastructure/storage/keys';

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

/** A product as the app reads it: with its packs, derived for products saved before packs existed. */
function withPacks(p: Product): Product {
  return p.packs?.length ? p : { ...p, packs: productPacks(p) };
}

function normalizeProduct(p: Product): Product {
  return {
    ...p,
    isVisibleOfflineCounter: (p as any).isVisibleOfflineCounter ?? true,
  };
}

async function loadProducts(): Promise<Product[]> {
  const existing = await readProducts();
  if (existing.length > 0) {
    // 'Out of Stock' was removed (stock isn't tracked in this ERP): products saved with it become 'Available'.
    const normalized = existing.map((p) => {
      const n = normalizeProduct(p);
      return (n.availability as string) === 'Out of Stock' ? { ...n, availability: 'Available' as const } : n;
    });
    // Write back only when something changed — writing on every read re-triggers the storage listeners (refetch loop).
    const changed = normalized.some(
      (p, i) =>
        (existing[i] as any).isVisibleOfflineCounter !== (p as any).isVisibleOfflineCounter ||
        existing[i]!.availability !== p.availability,
    );
    if (changed) await writeProducts(normalized);
    return normalized;
  }

  // A fresh catalog stays empty: every product is added by the admin.
  return [];
}

function normalizeProductName(name: string): string {
  return name.trim().toLowerCase();
}

/** Products are referenced by name from customer subscriptions, so names must be unique (trimmed, case-insensitive). */
function assertUniqueProductName(items: Product[], name: string, excludeId?: string): void {
  const key = normalizeProductName(name);
  const clash = items.find((p) => p.id !== excludeId && normalizeProductName(p.name) === key);
  if (clash) {
    throw new DomainError('PRODUCT_NAME_DUPLICATE', strings('products').errors.duplicateName(clash.name));
  }
}

/** Number of customers whose subscriptions reference the product by name (read-only look at the customers store). */
async function countCustomersReferencingProduct(productName: string): Promise<number> {
  const key = normalizeProductName(productName);
  const customers = (await readJson<Customer[]>(CUSTOMERS_STORE_KEY)) ?? [];
  let count = 0;
  for (const c of customers) {
    const inPlans = (c.subscriptionPlans ?? []).some((pl) => normalizeProductName(pl.productName ?? '') === key);
    const inLegacy = (c.subscription ?? []).some((s) => normalizeProductName(s.productName ?? '') === key);
    if (inPlans || inLegacy) count += 1;
  }
  return count;
}

export class ProductServiceMock implements IProductService {
  async list(): Promise<ProductListResponse> {
    await sleep(DEFAULT_DELAY_MS);
    const items = (await loadProducts()).map(withPacks);
    return { items, total: items.length };
  }

  async create(data: CreateProductRequest): Promise<ProductResponse> {
    await sleep(DEFAULT_DELAY_MS);
    const items = await loadProducts();
    assertUniqueProductName(items, data.name);
    const now = nowIso();
    const id = newId('prod');
    const packs = data.packs?.length ? sanitizePacks(id, data.packs) : undefined;
    const created: Product = {
      id,
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
      ...(packs?.length ? { packs, ...legacyFieldsFromPacks(packs) } : {}),
      createdAt: now,
      updatedAt: now,
    };
    const next = [created, ...items];
    await writeProducts(next);
    return withPacks(created);
  }

  async update(id: string, data: UpdateProductRequest): Promise<ProductResponse> {
    await sleep(DEFAULT_DELAY_MS);
    const items = await loadProducts();
    const idx = items.findIndex((p) => p.id === id);
    if (idx < 0) throw new DomainError('PRODUCT_NOT_FOUND', strings('products').errors.notFound);
    if (data.name !== undefined) assertUniqueProductName(items, data.name, id);

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

    if (data.packs !== undefined) {
      const packs = sanitizePacks(id, data.packs);
      const legacyFields = legacyFieldsFromPacks(packs);
      Object.assign(updated, { packs }, legacyFields ?? {});
    }

    const next = [...items];
    next[idx] = updated;
    await writeProducts(next);
    return withPacks(updated);
  }

  async delete(id: string): Promise<void> {
    await sleep(DEFAULT_DELAY_MS);
    const items = await loadProducts();
    const target = items.find((p) => p.id === id);
    if (!target) return; // already gone — keep DELETE idempotent

    const refCount = await countCustomersReferencingProduct(target.name);
    if (refCount > 0) {
      throw new DomainError(
        'PRODUCT_IN_USE',
        strings('products').errors.inUse(target.name, refCount),
      );
    }

    const next = items.filter((p) => p.id !== id);
    await writeProducts(next);
  }
}

