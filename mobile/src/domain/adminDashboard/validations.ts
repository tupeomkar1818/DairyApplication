import { z } from 'zod';

import { strings } from '@/src/i18n/strings';

export const UpdateDashboardCoverRequestSchema = z.object({
  uri: z.string().min(1, { error: () => strings('admin').cover.uriRequired }),
  aspectRatio: z.number().positive({ error: () => strings('admin').cover.invalidDimensions }),
});

export type UpdateDashboardCoverRequestInput = z.infer<typeof UpdateDashboardCoverRequestSchema>;
