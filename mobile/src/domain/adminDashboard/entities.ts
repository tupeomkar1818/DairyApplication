import type { EntityBase } from '@/src/domain/shared/types';

export type DashboardCoverSourceType = 'bundled' | 'uri';

/** Shared dashboard hero cover — visible on admin, customer, and delivery home screens */
export interface DashboardCoverImage extends EntityBase {
  sourceType: DashboardCoverSourceType;
  /** Local file URI when sourceType is uri; ignored when bundled */
  uri: string;
  /** width / height — used to reserve layout space before image loads */
  aspectRatio: number;
}

export interface AdminDashboardSettings extends EntityBase {
  cover: DashboardCoverImage;
}
