import { z } from 'zod';

import { strings } from '@/src/i18n/strings';

export const CreateProductCategoryRequestSchema = z.object({
  name: z.string().min(1, { error: () => strings('products').validation.categoryNameRequired }).max(40),
  isActive: z.boolean(),
});
export type CreateProductCategoryRequestInput = z.infer<typeof CreateProductCategoryRequestSchema>;

export const UpdateProductCategoryRequestSchema = CreateProductCategoryRequestSchema.partial();
export type UpdateProductCategoryRequestInput = z.infer<typeof UpdateProductCategoryRequestSchema>;

