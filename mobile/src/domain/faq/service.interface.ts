import type { FaqListQuery } from '@/src/domain/faq/validations';
import type { FaqListResponse } from '@/src/domain/faq/dtos';

export interface IFaqService {
  /** GET /api/faq */
  listFaqs(query?: FaqListQuery): Promise<FaqListResponse>;
}
