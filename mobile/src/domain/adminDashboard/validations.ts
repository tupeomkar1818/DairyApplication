import { z } from 'zod';

export const UpdateDashboardCoverRequestSchema = z.object({
  uri: z.string().min(1, 'Image URI is required'),
  aspectRatio: z.number().positive('Invalid image dimensions'),
});

export type UpdateDashboardCoverRequestInput = z.infer<typeof UpdateDashboardCoverRequestSchema>;
