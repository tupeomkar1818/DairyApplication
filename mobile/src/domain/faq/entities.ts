import type { EntityBase } from '@/src/domain/shared/types';

export interface FaqItem extends EntityBase {
  question: string;
  answer: string;
  sortOrder: number;
}
