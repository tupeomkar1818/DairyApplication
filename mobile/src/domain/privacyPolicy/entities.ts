import type { EntityBase } from '@/src/domain/shared/types';

export interface PrivacyPolicySection {
  id: string;
  title: string;
  paragraphs: string[];
  sortOrder: number;
}

export interface PrivacyPolicyDocument extends EntityBase {
  pageTitle: string;
  lastUpdatedLabel: string;
  intro: string;
  sections: PrivacyPolicySection[];
}
