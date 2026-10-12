import type { ProductResponse, UpdateProductRequest } from '@/src/domain/products/dtos';
import type {
  DayOfWeek,
  DeliveryTimeSlot,
  ProductAvailability,
  ProductFeature,
  ProductType,
  ProductUnit,
  TaxPercentage,
} from '@/src/domain/products/enums';
import type { ProductPack } from '@/src/domain/products/entities';
import { parsePackQuantity, productPacks } from '@/src/domain/products/packs';
import { CreateProductRequestSchema } from '@/src/domain/products/validations';
import { strings } from '@/src/i18n/strings';

export const GRAM_OPTIONS = [250, 500, 750, 1000] as const;
export const ML_OPTIONS = [150, 250, 500, 1000] as const;
export const COUNT_OPTIONS = [1, 2, 5] as const;

export const PRODUCT_TYPE_OPTIONS: readonly ProductType[] = ['Milk', 'Milk Product', 'Sweet Product', 'Grocery Product'];
export const AVAILABILITY_OPTIONS: readonly ProductAvailability[] = ['Available', 'Seasonal Product', 'Discontinued'];
export const WEEK_DAYS: readonly DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const DELIVERY_SLOT_OPTIONS: readonly DeliveryTimeSlot[] = ['Morning', 'Afternoon', 'Evening'];
export const TAX_OPTIONS: readonly TaxPercentage[] = ['0%', '5%', '12%', '18%'];
export const FEATURE_OPTIONS: readonly ProductFeature[] = [
  'Fresh Product',
  'Organic',
  'Best Seller',
  'Subscription Available',
  'Home Delivery Available',
  'Returnable Bottle',
  'Refrigeration Required',
];
/** Mirrors `description` max length in the product schema. */
export const DESCRIPTION_MAX_LENGTH = 240;

/** Every field shown on the Product Details screen except stock (not tracked in this ERP) and record dates. */
/**
 * A pack size beyond the first, edited as its own row ("1 L - Pouch" at ₹59).
 *
 * The first pack is the form's main price and size fields; these rows add the other sizes of the same product.
 */
export type ExtraPackDraft = {
  /** Stored pack id; blank for a row added in this form. */
  id: string;
  /** What the customer picks, e.g. "1 L - Pouch". The size is read from it. */
  label: string;
  price: string;
  /** Blank = no offer price. */
  discountPrice: string;
  isActive: boolean;
  /** Carried over from a product listed before packs had their own prices: the price shown is a copy to check. */
  needsPricing?: boolean;
};

export function emptyExtraPack(): ExtraPackDraft {
  return { id: '', label: '', price: '', discountPrice: '', isActive: true };
}

export type ProductFormState = {
  name: string;
  imageUrl: string;
  productType: ProductType;
  /** Blank = same as the product type. */
  category: string;
  price: string;
  /** Blank = no discount. */
  discountPrice: string;
  taxApplicable: boolean;
  taxPercentage: TaxPercentage | '';
  unit: ProductUnit;
  unitQuantity: string;
  sku: string;
  availability: ProductAvailability;
  availableDays: DayOfWeek[];
  deliveryTimeSlots: DeliveryTimeSlot[];
  availableForOnline: boolean;
  availableForOffline: boolean;
  isActive: boolean;
  features: ProductFeature[];
  description: string;
  /** Id and label of the first pack in edit mode, so an unchanged size keeps its own name ("1 L - Pouch"). */
  firstPackId: string;
  firstPackLabel: string;
  /** The product's other pack sizes, each with its own price. */
  extraPacks: ExtraPackDraft[];
};

export function emptyProductForm(): ProductFormState {
  return {
    name: '',
    imageUrl: '',
    productType: 'Milk',
    category: '',
    price: '',
    discountPrice: '',
    taxApplicable: false,
    taxPercentage: '',
    unit: 'ml',
    unitQuantity: '150',
    sku: '',
    availability: 'Available',
    availableDays: [...WEEK_DAYS],
    deliveryTimeSlots: ['Morning'],
    availableForOnline: true,
    availableForOffline: true,
    isActive: true,
    features: [],
    description: '',
    firstPackId: '',
    firstPackLabel: '',
    extraPacks: [],
  };
}

export function quantityOptionsForUnit(unit: ProductUnit): readonly number[] {
  switch (unit) {
    case 'Gram':
      return GRAM_OPTIONS;
    case 'ml':
      return ML_OPTIONS;
    default:
      return COUNT_OPTIONS;
  }
}

export function unitSuffix(unit: ProductUnit): string {
  switch (unit) {
    case 'Gram':
      return 'gram';
    case 'ml':
      return 'ml';
    default:
      return unit;
  }
}

export function chipLabel(unit: ProductUnit, n: number): string {
  if (unit === 'ml') return `${n} ml`;
  if (unit === 'Gram') return `${n} gram`;
  return `${n} ${unitSuffix(unit)}`;
}

/** Toggles `item` in `list`, keeping the order of `order` (e.g. weekdays stay Mon → Sun). */
export function toggleInOrder<T>(list: readonly T[], item: T, order: readonly T[]): T[] {
  const set = new Set(list);
  if (set.has(item)) set.delete(item);
  else set.add(item);
  return order.filter((x) => set.has(x));
}

type SizeFamily = 'ml' | 'Gram' | 'count';

function unitFamily(unit: ProductUnit): SizeFamily {
  if (unit === 'ml' || unit === 'Litre') return 'ml';
  if (unit === 'Gram' || unit === 'Kg') return 'Gram';
  return 'count';
}

function roundQty(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Parses "500 ml", "1 Litre", "250 gram", "1 Kg", "2" into a quantity in the form's base unit (ml / gram / count). */
function parseSizeText(text: string, productUnit: ProductUnit): { qty: number; family: SizeFamily } | null {
  const m = text.trim().match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]*)/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const token = (m[2] ?? '').toLowerCase();
  if (token === 'ml') return { qty: roundQty(n), family: 'ml' };
  if (token === 'l' || token.startsWith('lit') || token.startsWith('ltr')) return { qty: roundQty(n * 1000), family: 'ml' };
  if (token === 'g' || token === 'gm' || token === 'gms' || token.startsWith('gram')) return { qty: roundQty(n), family: 'Gram' };
  if (token === 'kg' || token.startsWith('kilo')) return { qty: roundQty(n * 1000), family: 'Gram' };
  // No (or unknown) unit token: interpret the number in the product's own unit.
  const scale = productUnit === 'Litre' || productUnit === 'Kg' ? 1000 : 1;
  return { qty: roundQty(n * scale), family: unitFamily(productUnit) };
}

export function productFormFromResponse(p: ProductResponse): { form: ProductFormState; customQuantity: boolean } {
  const custom = (p.customVariantLabel ?? '').trim();
  const variants = p.variants ?? [];
  const sizeText =
    variants.includes('Custom Size') && custom ? custom : (variants.find((v) => v !== 'Custom Size') ?? custom);

  // The form only offers ml / Gram for measured units, so Litre / Kg products are shown in ml / gram (x1000).
  const unit: ProductUnit = p.unit === 'Litre' ? 'ml' : p.unit === 'Kg' ? 'Gram' : p.unit;
  const family = unitFamily(unit);
  const parsed = sizeText ? parseSizeText(sizeText, p.unit) : null;
  let qty = parsed && parsed.family === family ? parsed.qty : NaN;
  if (!Number.isFinite(qty) && (p.unit === 'Litre' || p.unit === 'Kg')) qty = 1000; // bare "1 Litre" / "1 Kg" product

  const allowed = quantityOptionsForUnit(unit);
  const defaultQty = allowed[0] ?? 1;
  const hasQty = Number.isFinite(qty) && qty > 0;
  const customQuantity = hasQty && !allowed.includes(qty);
  const unitQuantity = hasQty ? String(qty) : String(defaultQty);
  const category = (p.category ?? '').trim();
  const discount = Number(p.discountPrice ?? 0);

  return {
    form: {
      name: p.name,
      imageUrl: p.imageUri ?? '',
      productType: p.productType,
      category: category && category !== p.productType ? category : '',
      price: String(p.price),
      discountPrice: Number.isFinite(discount) && discount > 0 ? String(discount) : '',
      taxApplicable: !!p.taxApplicable,
      taxPercentage: p.taxPercentage ?? '',
      unit,
      unitQuantity,
      sku: p.sku ?? '',
      // Stored values from before 'Out of Stock' was removed read as Available.
      availability: AVAILABILITY_OPTIONS.includes(p.availability) ? p.availability : 'Available',
      availableDays: WEEK_DAYS.filter((d) => (p.availableDays ?? []).includes(d)),
      deliveryTimeSlots: DELIVERY_SLOT_OPTIONS.filter((s) => (p.deliveryTimeSlots ?? []).includes(s)),
      availableForOnline: p.isVisibleToCustomer,
      availableForOffline: p.isVisibleOfflineCounter,
      isActive: p.isActive,
      features: FEATURE_OPTIONS.filter((f) => (p.features ?? []).includes(f)),
      description: p.description ?? '',
      ...packFieldsFromResponse(p),
    },
    customQuantity,
  };
}

/**
 * Splits a product's packs into the form's first pack (its main price and size fields, which hold the product's
 * headline pack) and the extra rows.
 */
function packFieldsFromResponse(p: ProductResponse): Pick<ProductFormState, 'firstPackId' | 'firstPackLabel' | 'extraPacks'> {
  const packs = productPacks(p);
  const headlineLabel = String(p.customVariantLabel ?? '').trim();
  const headline = packs.find((pk) => pk.label.trim() === headlineLabel) ?? packs[0];
  const money = (n: number | undefined) => (Number.isFinite(Number(n)) && Number(n) > 0 ? String(Math.round(Number(n))) : '');

  return {
    firstPackId: headline?.id ?? '',
    firstPackLabel: headline?.label ?? '',
    extraPacks: packs
      .filter((pk) => pk !== headline)
      .map((pk) => ({
        id: pk.id,
        label: pk.label,
        price: money(pk.price),
        discountPrice: money(pk.discountPrice),
        isActive: pk.isActive !== false,
        needsPricing: pk.needsPricing,
      })),
  };
}

export function buildCustomVariantLabel(form: ProductFormState): string {
  const qty = Number(form.unitQuantity);
  return `${qty} ${unitSuffix(form.unit)}`;
}

/** Blank price → undefined so the schema reports "Price is required" (Number('') would silently be 0). */
export function parsePriceInput(raw: string): number | undefined {
  const s = raw.trim();
  return s ? Number(s) : undefined;
}

type BuildOptions = {
  /** Edit mode: the product being edited and the form it was loaded into. */
  existing?: ProductResponse;
  seed?: ProductFormState;
};

function sizeChangedFromSeed(form: ProductFormState, seed: ProductFormState | undefined): boolean {
  return !seed || form.unit !== seed.unit || Number(form.unitQuantity) !== Number(seed.unitQuantity);
}

/**
 * The full product payload for the form. In edit mode an unchanged size keeps the product's own unit / variants /
 * label (the form can't represent every stored size exactly), and stock keeps its stored value (not edited here).
 */
/**
 * The pack list a save sends: the first pack from the main price and size fields, then the extra rows.
 * Prices a row leaves blank stay undefined, so the schema names the row instead of saving a ₹0 pack.
 */
export function buildPacksFromForm(form: ProductFormState, keepFirstLabel: boolean): ProductPack[] {
  const qty = Number(form.unitQuantity);
  const firstLabel =
    keepFirstLabel && form.firstPackLabel.trim()
      ? form.firstPackLabel.trim()
      : Number.isFinite(qty) && qty > 0
        ? buildCustomVariantLabel(form)
        : '';
  const first = parsePackQuantity(firstLabel, form.unit);

  const packs: ProductPack[] = [
    {
      id: form.firstPackId,
      label: firstLabel,
      unit: first.unit,
      quantity: first.quantity,
      price: parsePriceInput(form.price) as number,
      discountPrice: parsePriceInput(form.discountPrice),
      sku: form.sku.trim() || undefined,
      isActive: true,
    },
  ];

  for (const row of form.extraPacks) {
    const size = parsePackQuantity(row.label, form.unit);
    packs.push({
      id: row.id,
      label: row.label.trim(),
      unit: size.unit,
      quantity: size.quantity,
      price: parsePriceInput(row.price) as number,
      discountPrice: parsePriceInput(row.discountPrice),
      isActive: row.isActive,
    });
  }
  return packs;
}

function buildProductDraft(form: ProductFormState, { existing, seed }: BuildOptions) {
  const keepSize = !!existing && !sizeChangedFromSeed(form, seed);
  const qty = Number(form.unitQuantity);
  const size = keepSize
    ? { unit: existing!.unit, variants: existing!.variants ?? [], customVariantLabel: existing!.customVariantLabel ?? '' }
    : {
        unit: form.unit,
        variants: ['Custom Size'],
        customVariantLabel: Number.isFinite(qty) && qty > 0 ? buildCustomVariantLabel(form) : '',
      };

  return {
    name: form.name,
    category: form.category.trim() || form.productType,
    productType: form.productType,
    price: parsePriceInput(form.price),
    discountPrice: parsePriceInput(form.discountPrice),
    ...size,
    description: form.description.trim(),
    availableStock: existing?.availableStock ?? 0,
    minStockAlert: existing?.minStockAlert,
    availableDays: form.availableDays,
    availability: form.availability,
    deliveryTimeSlots: form.deliveryTimeSlots,
    sku: form.sku.trim(),
    imageUri: form.imageUrl.trim(),
    features: form.features,
    taxApplicable: form.taxApplicable,
    taxPercentage: form.taxApplicable ? form.taxPercentage || undefined : undefined,
    isVisibleToCustomer: form.availableForOnline,
    isVisibleOfflineCounter: form.availableForOffline,
    isActive: form.isActive,
    packs: buildPacksFromForm(form, keepSize),
  };
}

/** Validates the whole form against the product schema (same rules the service applies). */
export function validateProductForm(form: ProductFormState, options: BuildOptions = {}) {
  return CreateProductRequestSchema.safeParse(buildProductDraft(form, options));
}

export type ProductFormFieldKey =
  | 'name'
  | 'category'
  | 'price'
  | 'discountPrice'
  | 'taxPercentage'
  | 'quantity'
  | 'sku'
  | 'availableDays'
  | 'deliveryTimeSlots'
  | 'description'
  | 'packs'
  | 'other';

const SCHEMA_PATH_TO_FIELD: Record<string, ProductFormFieldKey> = {
  name: 'name',
  category: 'category',
  price: 'price',
  discountPrice: 'discountPrice',
  taxPercentage: 'taxPercentage',
  customVariantLabel: 'quantity',
  sku: 'sku',
  availableDays: 'availableDays',
  deliveryTimeSlots: 'deliveryTimeSlots',
  description: 'description',
  packs: 'packs',
};

/** First message per form field (anything not tied to a field lands in `other`). */
export function productFormFieldErrors(form: ProductFormState): Partial<Record<ProductFormFieldKey, string>> {
  const out: Partial<Record<ProductFormFieldKey, string>> = {};
  const res = validateProductForm(form);
  if (res.success) return out;
  for (const issue of res.error.issues) {
    const key = SCHEMA_PATH_TO_FIELD[String(issue.path[0] ?? '')] ?? 'other';
    out[key] ??= issue.message;
  }
  return out;
}

export type ExtraPackFieldErrors = Partial<Record<'label' | 'price' | 'discountPrice', string>>;

/**
 * Messages for the extra pack rows, by row index. The first pack's problems are already reported on the main price
 * and size fields, so they are not repeated here.
 */
export function productFormExtraPackErrors(form: ProductFormState): {
  rows: Record<number, ExtraPackFieldErrors>;
  /** A problem with the pack list as a whole, e.g. every pack switched off. */
  list?: string;
} {
  const res = validateProductForm(form);
  const rows: Record<number, ExtraPackFieldErrors> = {};
  let list: string | undefined;
  if (res.success) return { rows };

  for (const issue of res.error.issues) {
    if (issue.path[0] !== 'packs') continue;
    const index = issue.path[1];
    if (typeof index !== 'number') {
      list ??= issue.message;
      continue;
    }
    if (index === 0) continue;
    const field = issue.path[2];
    if (field !== 'label' && field !== 'price' && field !== 'discountPrice') continue;
    const row = (rows[index - 1] ??= {});
    row[field] ??= issue.message;
  }
  return { rows, list };
}

export type ParseUpdateProductResult = { success: true; data: UpdateProductRequest } | { success: false; message: string };

/**
 * Builds the PUT payload for the edit screen.
 * - Unit / variants / size label are only sent when the admin changed unit or quantity, so products
 *   whose size the simplified form can't represent exactly (e.g. Litre with preset variants) are not clobbered.
 * - Stock isn't edited here and is never sent.
 * - A cleared discount is sent as 0 (no discount).
 */
export function parseUpdateProductRequest(
  product: ProductResponse,
  seed: ProductFormState,
  form: ProductFormState,
): ParseUpdateProductResult {
  const res = validateProductForm(form, { existing: product, seed });
  if (!res.success) return { success: false, message: res.error.issues[0]?.message ?? strings('products').form.checkForm };

  const { availableStock: _stock, minStockAlert: _minStock, unit, variants, customVariantLabel, ...rest } = res.data;
  const data: UpdateProductRequest = { ...rest, discountPrice: rest.discountPrice ?? 0 };
  if (sizeChangedFromSeed(form, seed)) {
    Object.assign(data, { unit, variants, customVariantLabel });
  }
  return { success: true, data };
}

export function parseCreateProductRequest(form: ProductFormState) {
  return validateProductForm(form);
}
