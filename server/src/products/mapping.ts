import { boolToDb, dbToBool, detailsOf, newId, parseJson } from '@/db';

/**
 * Products as the apps know them (`mobile/src/domain/products/entities.ts`) ↔ the `products` / `product_packs`
 * rows. The columns are what the server queries by; every other field the app sends rides in `details_json` and
 * comes back unchanged.
 */

export type Pack = {
  id: string;
  label: string;
  unit: string;
  quantity: number;
  price: number;
  discountPrice?: number;
  sku?: string;
  availableStock?: number;
  isActive?: boolean;
  needsPricing?: boolean;
};

export type Product = Record<string, unknown> & {
  id: string;
  name: string;
  price: number;
  packs?: Pack[];
  createdAt: string;
  updatedAt: string;
};

export type ProductRow = {
  id: string;
  name: string;
  category: string;
  product_type: string;
  unit: string;
  description: string;
  image_key: string | null;
  availability: string;
  features_json: string;
  is_visible_to_customer: number;
  is_active: number;
  sort_order: number;
  price: number;
  discount_price: number | null;
  details_json: string;
  created_at: string;
  updated_at: string;
};

export type PackRow = {
  id: string;
  product_id: string;
  label: string;
  unit: string;
  quantity: number;
  price: number;
  discount_price: number | null;
  sku: string | null;
  is_active: number;
  sort_order: number;
};

/** Fields with a column of their own; the rest go to `details_json`. */
const PRODUCT_COLUMN_KEYS = [
  'id',
  'name',
  'category',
  'productType',
  'unit',
  'description',
  'imageUri',
  'availability',
  'features',
  'isVisibleToCustomer',
  'isActive',
  'price',
  'discountPrice',
  'packs',
  'createdAt',
  'updatedAt',
] as const;

export function packFromRow(row: PackRow): Pack {
  return {
    id: row.id,
    label: row.label,
    unit: row.unit,
    quantity: row.quantity,
    price: row.price,
    ...(row.discount_price == null ? {} : { discountPrice: row.discount_price }),
    ...(row.sku ? { sku: row.sku } : {}),
    isActive: dbToBool(row.is_active),
  };
}

export function productFromRow(row: ProductRow, packRows: readonly PackRow[]): Product {
  const details = parseJson<Record<string, unknown>>(row.details_json, {});
  return {
    ...details,
    id: row.id,
    name: row.name,
    category: row.category,
    productType: row.product_type,
    unit: row.unit,
    description: row.description,
    ...(row.image_key ? { imageUri: row.image_key } : {}),
    availability: row.availability,
    features: parseJson<string[]>(row.features_json, []),
    isVisibleToCustomer: dbToBool(row.is_visible_to_customer),
    isActive: dbToBool(row.is_active),
    price: row.price,
    ...(row.discount_price == null ? {} : { discountPrice: row.discount_price }),
    packs: packRows.map(packFromRow),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** The columns and the leftover details for a product being written. */
export function productToRow(product: Product): Omit<ProductRow, 'created_at' | 'updated_at'> {
  return {
    id: product.id,
    name: String(product.name).trim(),
    category: String(product.category ?? '').trim(),
    product_type: String(product.productType ?? 'Milk'),
    unit: String(product.unit ?? 'ml'),
    description: String(product.description ?? ''),
    image_key: typeof product.imageUri === 'string' && product.imageUri ? product.imageUri : null,
    availability: String(product.availability ?? 'Available'),
    features_json: JSON.stringify(Array.isArray(product.features) ? product.features : []),
    is_visible_to_customer: boolToDb(product.isVisibleToCustomer as boolean | undefined, true),
    is_active: boolToDb(product.isActive as boolean | undefined, true),
    sort_order: Number(product.sortOrder ?? 0) || 0,
    price: Math.round(Number(product.price) || 0),
    discount_price: product.discountPrice == null ? null : Math.round(Number(product.discountPrice)),
    details_json: JSON.stringify(detailsOf(product, PRODUCT_COLUMN_KEYS)),
  };
}

/** A product's packs as rows, numbered so they come back in the order the admin arranged them. */
export function packsToRows(productId: string, packs: readonly Pack[] | undefined): PackRow[] {
  return (packs ?? []).map((pack, index) => ({
    id: pack.id || newId('pack'),
    product_id: productId,
    label: String(pack.label ?? '').trim(),
    unit: String(pack.unit ?? ''),
    quantity: Math.round(Number(pack.quantity) || 0),
    price: Math.round(Number(pack.price) || 0),
    discount_price: pack.discountPrice == null ? null : Math.round(Number(pack.discountPrice)),
    sku: pack.sku ?? null,
    is_active: boolToDb(pack.isActive, true),
    sort_order: index,
  }));
}
