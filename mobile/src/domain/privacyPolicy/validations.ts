import { z } from 'zod';

/** GET /api/privacy-policy */
export const PrivacyPolicyQuerySchema = z.object({
  locale: z.string().trim().optional(),
});

export type PrivacyPolicyQuery = z.infer<typeof PrivacyPolicyQuerySchema>;
