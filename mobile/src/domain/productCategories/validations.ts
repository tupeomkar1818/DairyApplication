import { z } from 'zod';

export const CreateProductCategoryRequestSchema = z.object({
  name: z.string().min(1, 'Category name is required').max(40),
  isActive: z.boolean(),
});
export type CreateProductCategoryRequestInput = z.infer<typeof CreateProductCategoryRequestSchema>;

export const UpdateProductCategoryRequestSchema = CreateProductCategoryRequestSchema.partial();
export type UpdateProductCategoryRequestInput = z.infer<typeof UpdateProductCategoryRequestSchema>;

