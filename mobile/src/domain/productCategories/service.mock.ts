import type { IProductCategoryService } from '@/src/domain/productCategories/service.interface';
import type { CreateProductCategoryRequest, ProductCategoryListResponse, ProductCategoryResponse, UpdateProductCategoryRequest } from '@/src/domain/productCategories/dtos';
import type { ProductCategory } from '@/src/domain/productCategories/entities';
import { DomainError } from '@/src/domain/shared/errors';
import { strings } from '@/src/i18n/strings';
import { readJson, writeJson } from '@/src/infrastructure/storage/storage';
import { PRODUCT_CATEGORIES_STORE_KEY } from '@/src/infrastructure/storage/keys';

const DEFAULT_DELAY_MS = 200;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function nowIso(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

async function readCategories(): Promise<ProductCategory[]> {
  return (await readJson<ProductCategory[]>(PRODUCT_CATEGORIES_STORE_KEY)) ?? [];
}

async function writeCategories(items: ProductCategory[]): Promise<void> {
  await writeJson(PRODUCT_CATEGORIES_STORE_KEY, items);
}

async function ensureSeedCategories(): Promise<ProductCategory[]> {
  const existing = await readCategories();
  if (existing.length > 0) return existing;

  const now = nowIso();
  const names = ['Milk', 'Curd', 'Paneer', 'Ghee', 'Butter', 'Cheese', 'Lassi', 'Buttermilk', 'Ice Cream', 'Sweets'];
  const seeded: ProductCategory[] = names.map((name) => ({
    id: newId('cat'),
    name,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }));
  await writeCategories(seeded);
  return seeded;
}

export class ProductCategoryServiceMock implements IProductCategoryService {
  async list(): Promise<ProductCategoryListResponse> {
    await sleep(DEFAULT_DELAY_MS);
    const items = await ensureSeedCategories();
    const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name));
    return { items: sorted, total: sorted.length };
  }

  async create(data: CreateProductCategoryRequest): Promise<ProductCategoryResponse> {
    await sleep(DEFAULT_DELAY_MS);
    const items = await ensureSeedCategories();
    const now = nowIso();
    const created: ProductCategory = {
      id: newId('cat'),
      name: data.name.trim(),
      isActive: data.isActive,
      createdAt: now,
      updatedAt: now,
    };
    const next = [created, ...items];
    await writeCategories(next);
    return created;
  }

  async update(id: string, data: UpdateProductCategoryRequest): Promise<ProductCategoryResponse> {
    await sleep(DEFAULT_DELAY_MS);
    const items = await ensureSeedCategories();
    const idx = items.findIndex((c) => c.id === id);
    if (idx < 0) throw new DomainError('PRODUCT_CATEGORY_NOT_FOUND', strings('products').errors.categoryNotFound);

    const now = nowIso();
    const current = items[idx]!;
    const updated: ProductCategory = {
      ...current,
      ...data,
      name: data.name !== undefined ? data.name.trim() : current.name,
      updatedAt: now,
    };
    const next = [...items];
    next[idx] = updated;
    await writeCategories(next);
    return updated;
  }

  async delete(id: string): Promise<void> {
    await sleep(DEFAULT_DELAY_MS);
    const items = await ensureSeedCategories();
    const next = items.filter((c) => c.id !== id);
    await writeCategories(next);
  }
}

