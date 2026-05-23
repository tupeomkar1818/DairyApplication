import type { ContactAdminResponse } from '@/src/domain/contactAdmin/dtos';
import type { ContactAdminQuery } from '@/src/domain/contactAdmin/validations';

export interface IContactAdminService {
  /** GET /api/contact-admin */
  getContactAdmin(query?: ContactAdminQuery): Promise<ContactAdminResponse>;
}
