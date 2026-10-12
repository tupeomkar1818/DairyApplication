import type {
  CreateCustomerRequest,
  CustomerListResponse,
  CustomerResponse,
  UpdateCustomerRequest,
} from '@/src/domain/customers/dtos';
import type { ICustomerService } from '@/src/domain/customers/service.interface';
import { DomainError } from '@/src/domain/shared/errors';
import { api } from '@/src/infrastructure/api/client';

/**
 * Customers, from the dairy's server.
 *
 * The server keeps the whole record: the profile, the address, the billing settings, the subscription lines, and
 * everything the customer has done — the days delivered, the days they changed, one-off orders and the money. A
 * list the app sends replaces that list on the server, the same way the on-phone version works.
 */

export class CustomerServiceApi implements ICustomerService {
  async list(): Promise<CustomerListResponse> {
    return api.get<CustomerListResponse>('/customers');
  }

  async getById(id: string): Promise<CustomerResponse | null> {
    try {
      return await api.get<CustomerResponse>(`/customers/${encodeURIComponent(id)}`);
    } catch (error) {
      // "No such customer" is an answer, not a failure: the screens expect null.
      if (error instanceof DomainError && error.code === 'CUSTOMER_NOT_FOUND') return null;
      throw error;
    }
  }

  /** The signed-in customer's own record, without the app needing to know its id. */
  async getMine(): Promise<CustomerResponse | null> {
    try {
      return await api.get<CustomerResponse>('/me/customer');
    } catch (error) {
      if (error instanceof DomainError && error.code === 'CUSTOMER_NOT_FOUND') return null;
      throw error;
    }
  }

  async create(data: CreateCustomerRequest): Promise<CustomerResponse> {
    return api.post<CustomerResponse>('/customers', data);
  }

  async update(id: string, data: UpdateCustomerRequest): Promise<CustomerResponse> {
    return api.patch<CustomerResponse>(`/customers/${encodeURIComponent(id)}`, data);
  }

  async delete(id: string): Promise<void> {
    await api.delete<void>(`/customers/${encodeURIComponent(id)}`);
  }
}
