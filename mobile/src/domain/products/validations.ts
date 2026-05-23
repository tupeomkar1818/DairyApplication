import { z } from 'zod';

const MoneySchema = z
  .number({ message: 'Price is required' })
  .finite('Price must be valid')
  .nonnegative('Price must be 0 or greater');

const StockSchema = z
  .number({ message: 'Stock is required' })
  .finite('Stock must be valid')
  .int('Stock must be a whole number')
  .nonnegative('Stock must be 0 or greater');

const OptionalMoneySchema = z
  .number()
  .finite('Discount price must be valid')
  .nonnegative('Discount price must be 0 or greater')
  .optional();

const OptionalIntSchema = z
  .number()
  .finite('Minimum stock must be valid')
  .int('Minimum stock must be a whole number')
  .nonnegative('Minimum stock must be 0 or greater')
  .optional();

const BaseProductRequestSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(80),
  category: z.string().min(1, 'Category is required').max(50),
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
  description: z.string().max(240).optional().default(''),
  availableStock: StockSchema,
  minStockAlert: OptionalIntSchema,
  availableDays: z
    .array(z.union([z.literal('Monday'), z.literal('Tuesday'), z.literal('Wednesday'), z.literal('Thursday'), z.literal('Friday'), z.literal('Saturday'), z.literal('Sunday')]))
    .min(1, 'Select at least one available day'),
  availability: z.union([z.literal('Available'), z.literal('Out of Stock'), z.literal('Seasonal Product'), z.literal('Discontinued')]),
  deliveryTimeSlots: z.array(z.union([z.literal('Morning'), z.literal('Afternoon'), z.literal('Evening')])).min(1, 'Select at least one delivery slot'),
  sku: z.string().min(2, 'SKU must be at least 2 characters').max(24).optional().or(z.literal('')),
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
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['discountPrice'], message: 'Discount price cannot be higher than price' });
  }
  if (v.variants.includes('Custom Size')) {
    const label = (v.customVariantLabel ?? '').trim();
    if (!label) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['customVariantLabel'], message: 'Enter custom size label' });
    }
  }
  if (v.taxApplicable && !v.taxPercentage) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['taxPercentage'], message: 'Select tax percentage' });
  }
  if (v.minStockAlert !== undefined && v.minStockAlert > v.availableStock) {
    // Allow it, but discourage; keep it informational in UI. No issue.
  }
});
export type CreateProductRequestInput = z.infer<typeof CreateProductRequestSchema>;

export const UpdateProductRequestSchema = BaseProductRequestSchema.partial();
export type UpdateProductRequestInput = z.infer<typeof UpdateProductRequestSchema>;

export const UpdateProductDetailsRequestSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(80),
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

