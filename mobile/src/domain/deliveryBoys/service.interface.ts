import type { CreateDeliveryBoyRequest, DeliveryBoyListResponse, DeliveryBoyResponse, UpdateDeliveryBoyRequest } from '@/src/domain/deliveryBoys/dtos';

export interface IDeliveryBoyService {
  /** GET /api/delivery-boys */
  list(): Promise<DeliveryBoyListResponse>;

  /** GET /api/delivery-boys/:id */
  getById(id: string): Promise<DeliveryBoyResponse | null>;

  /** POST /api/delivery-boys */
  create(data: CreateDeliveryBoyRequest): Promise<DeliveryBoyResponse>;

  /**
   * PUT /api/delivery-boys/:id
   * @throws DomainError `DELIVERY_BOY_NOT_FOUND` when no delivery boy has this id.
   */
  update(id: string, data: UpdateDeliveryBoyRequest): Promise<DeliveryBoyResponse>;

  /** DELETE /api/delivery-boys/:id */
  delete(id: string): Promise<void>;
}

