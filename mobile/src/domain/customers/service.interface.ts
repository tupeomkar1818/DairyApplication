import type { CustomerListResponse, CustomerResponse, CreateCustomerRequest, UpdateCustomerRequest } from '@/src/domain/customers/dtos';

export interface ICustomerService {
  /** GET /api/customers */
  list(): Promise<CustomerListResponse>;

  /** GET /api/customers/:id */
  getById(id: string): Promise<CustomerResponse | null>;

  /** POST /api/customers */
  create(data: CreateCustomerRequest): Promise<CustomerResponse>;

  /** PUT /api/customers/:id */
  update(id: string, data: UpdateCustomerRequest): Promise<CustomerResponse>;

  /** DELETE /api/customers/:id */
  delete(id: string): Promise<void>;
}

