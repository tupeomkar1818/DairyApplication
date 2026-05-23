import { z } from 'zod';

/** GET /api/faq — list query (reserved for category filter later) */
export const FaqListQuerySchema = z.object({
  category: z.string().trim().optional(),
});

export type FaqListQuery = z.infer<typeof FaqListQuerySchema>;
