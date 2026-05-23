import type { PrivacyPolicyDocument } from '@/src/domain/privacyPolicy/entities';

export interface PrivacyPolicyResponse {
  policy: PrivacyPolicyDocument;
}
