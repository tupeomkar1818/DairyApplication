import type { EntityBase } from '@/src/domain/shared/types';

export interface ProductCategory extends EntityBase {
  name: string;
  isActive: boolean;
}

