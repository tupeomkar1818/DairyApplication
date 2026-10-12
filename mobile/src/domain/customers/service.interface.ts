import type { CustomerListResponse, CustomerResponse, CreateCustomerRequest, UpdateCustomerRequest } from '@/src/domain/customers/dtos';

export interface ICustomerService {
  /** GET /api/customers */
  list(): Promise<CustomerListResponse>;

  /** GET /api/customers/:id */
  getById(id: string): Promise<CustomerResponse | null>;

  /**
   * POST /api/customers
   * @throws DomainError CUSTOMER_MOBILE_EXISTS when another customer already uses `mobile`.
   */
  create(data: CreateCustomerRequest): Promise<CustomerResponse>;

  /**
   * PUT /api/customers/:id — omitted fields keep their current value; plan lines keep `id` / `createdAt`.
   * @throws DomainError CUSTOMER_NOT_FOUND when no customer has `id`.
   * @throws DomainError CUSTOMER_MOBILE_EXISTS when another customer already uses the new `mobile`.
   */
  update(id: string, data: UpdateCustomerRequest): Promise<CustomerResponse>;

  /** DELETE /api/customers/:id — also removes the customer's calendar, day-order, memo and ledger stores. */
  delete(id: string): Promise<void>;
}

