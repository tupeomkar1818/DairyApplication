import type { PrivacyPolicyResponse } from '@/src/domain/privacyPolicy/dtos';
import type { PrivacyPolicyQuery } from '@/src/domain/privacyPolicy/validations';

export interface IPrivacyPolicyService {
  /** GET /api/privacy-policy */
  getPrivacyPolicy(query?: PrivacyPolicyQuery): Promise<PrivacyPolicyResponse>;
}
