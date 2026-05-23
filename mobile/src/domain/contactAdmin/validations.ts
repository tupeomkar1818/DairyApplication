import { z } from 'zod';

/** GET /api/contact-admin — no params today; schema reserved for locale later */
export const ContactAdminQuerySchema = z.object({
  locale: z.string().trim().optional(),
});

export type ContactAdminQuery = z.infer<typeof ContactAdminQuerySchema>;
