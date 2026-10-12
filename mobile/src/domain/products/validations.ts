import { z } from 'zod';

import { strings, type Dictionary } from '@/src/i18n/strings';

type ProductValidationWords = Dictionary['products']['validation'];

/** A zod message read when the check fails, so it follows the app language. */
const msg = (pick: (v: ProductValidationWords) => string) => ({ error: () => pick(strings('products').validation) });

const MoneySchema = z
  .number(msg((v) => v.priceRequired))
  .finite(msg((v) => v.priceValid))
  .positive(msg((v) => v.pricePositive));

const ProductNameSchema = z.string().trim().min(1, msg((v) => v.nameRequired)).max(80);

const StockSchema = z
  .number(msg((v) => v.stockRequired))
  .finite(msg((v) => v.stockValid))
  .int(msg((v) => v.stockWhole))
  .nonnegative(msg((v) => v.stockNonNegative));

const OptionalMoneySchema = z
  .number()
  .finite(msg((v) => v.discountValid))
  .nonnegative(msg((v) => v.discountNonNegative))
  .optional();

const OptionalIntSchema = z
  .number()
  .finite(msg((v) => v.minStockValid))
  .int(msg((v) => v.minStockWhole))
  .nonnegative(msg((v) => v.minStockNonNegative))
  .optional();

const PackUnitSchema = z.union([
  z.literal('Gram'),
  z.literal('Kg'),
  z.literal('ml'),
  z.literal('Litre'),
  z.literal('Packet'),
  z.literal('Piece'),
  z.literal('Box'),
  z.literal('Bottle'),
  z.literal('Pouch'),
]);

/** One pack row from the admin form. */
export const ProductPackSchema = z
  .object({
    id: z.string().default(''),
    label: z.string().trim().min(1, msg((v) => v.packLabelRequired)).max(30),
    unit: PackUnitSchema,
    quantity: z.number().finite().positive(msg((v) => v.sizePositive)),
    price: MoneySchema,
    discountPrice: OptionalMoneySchema,
    sku: z.string().max(24).optional().or(z.literal('')),
    availableStock: z.number().int().nonnegative().optional(),
    isActive: z.boolean().optional(),
    needsPricing: z.boolean().optional(),
  })
  .superRefine((p, ctx) => {
    // Same rule and wording as the product-level check, so the first pack never reports it differently.
    if (p.discountPrice !== undefined && p.discountPrice > p.price) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['discountPrice'],
        message: strings('products').validation.discountAbovePrice,
      });
    }
  });

/** The pack list as a whole: at least one sellable pack, and no two with the same size label. */
export const ProductPacksSchema = z
  .array(ProductPackSchema)
  .min(1, msg((v) => v.packsMin))
  .superRefine((packs, ctx) => {
    if (!packs.some((p) => p.isActive !== false)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: strings('products').validation.packOnSale });
    }
    const seen = new Map<string, number>();
    packs.forEach((p, index) => {
      const key = p.label.trim().toLowerCase();
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, 'label'],
          message: strings('products').validation.packDuplicate(p.label.trim()),
        });
      } else {
        seen.set(key, index);
      }
    });
  });

const BaseProductRequestSchema = z.object({
  name: ProductNameSchema,
  category: z.string().min(1, msg((v) => v.categoryRequired)).max(50),
  productType: z.union([z.literal('Milk'), z.literal('Milk Product'), z.literal('Sweet Product'), z.literal('Grocery Product')]),
  price: MoneySchema,
  discountPrice: OptionalMoneySchema,
  unit: z.union([
    z.literal('Gram'),
    z.literal('Kg'),
    z.literal('ml'),
    z.literal('Litre'),
    z.literal('Packet'),
    z.literal('Piece'),
    z.literal('Box'),
    z.literal('Bottle'),
    z.literal('Pouch'),
  ]),
  variants: z.array(z.union([z.literal('250 ml'), z.literal('500 ml'), z.literal('1 Litre'), z.literal('2 Litre'), z.literal('Custom Size')])).default([]),
  customVariantLabel: z.string().max(30).optional().or(z.literal('')),
  packs: ProductPacksSchema.optional(),
  description: z.string().max(240).optional().default(''),
  availableStock: StockSchema,
  minStockAlert: OptionalIntSchema,
  availableDays: z
    .array(z.union([z.literal('Monday'), z.literal('Tuesday'), z.literal('Wednesday'), z.literal('Thursday'), z.literal('Friday'), z.literal('Saturday'), z.literal('Sunday')]))
    .min(1, msg((v) => v.daysRequired)),
  availability: z.union([z.literal('Available'), z.literal('Seasonal Product'), z.literal('Discontinued')]),
  deliveryTimeSlots: z.array(z.union([z.literal('Morning'), z.literal('Afternoon'), z.literal('Evening')])).min(1, msg((v) => v.slotsRequired)),
  sku: z.string().min(2, msg((v) => v.skuMin)).max(24).optional().or(z.literal('')),
  imageUri: z.string().optional().or(z.literal('')),
  features: z
    .array(
      z.union([
        z.literal('Fresh Product'),
        z.literal('Organic'),
        z.literal('Best Seller'),
        z.literal('Subscription Available'),
        z.literal('Home Delivery Available'),
        z.literal('Returnable Bottle'),
        z.literal('Refrigeration Required'),
      ])
    )
    .default([]),
  taxApplicable: z.boolean(),
  taxPercentage: z.union([z.literal('0%'), z.literal('5%'), z.literal('12%'), z.literal('18%')]).optional(),
  isVisibleToCustomer: z.boolean(),
  isVisibleOfflineCounter: z.boolean(),
  isActive: z.boolean(),
});

export const CreateProductRequestSchema = BaseProductRequestSchema.superRefine((v, ctx) => {
  if (v.discountPrice !== undefined && v.discountPrice > v.price) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['discountPrice'], message: strings('products').validation.discountAbovePrice });
  }
  if (v.variants.includes('Custom Size')) {
    const label = (v.customVariantLabel ?? '').trim();
    if (!label) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['customVariantLabel'], message: strings('products').validation.customSizeRequired });
    }
  }
  if (v.taxApplicable && !v.taxPercentage) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['taxPercentage'], message: strings('products').validation.taxRequired });
  }
  if (v.minStockAlert !== undefined && v.minStockAlert > v.availableStock) {
    // Allow it, but discourage; keep it informational in UI. No issue.
  }
});
export type CreateProductRequestInput = z.infer<typeof CreateProductRequestSchema>;

export const UpdateProductRequestSchema = BaseProductRequestSchema.partial();
export type UpdateProductRequestInput = z.infer<typeof UpdateProductRequestSchema>;

export const UpdateProductDetailsRequestSchema = z.object({
  name: ProductNameSchema,
  price: MoneySchema,
  unit: z.union([
    z.literal('Gram'),
    z.literal('Kg'),
    z.literal('ml'),
    z.literal('Litre'),
    z.literal('Packet'),
    z.literal('Piece'),
    z.literal('Box'),
    z.literal('Bottle'),
    z.literal('Pouch'),
  ]),
  isActive: z.boolean(),
});
export type UpdateProductDetailsRequestInput = z.infer<typeof UpdateProductDetailsRequestSchema>;

