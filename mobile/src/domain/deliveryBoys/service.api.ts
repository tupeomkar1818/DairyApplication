import type {
  CreateDeliveryBoyRequest,
  DeliveryBoyListResponse,
  DeliveryBoyResponse,
  UpdateDeliveryBoyRequest,
} from '@/src/domain/deliveryBoys/dtos';
import type { IDeliveryBoyService } from '@/src/domain/deliveryBoys/service.interface';
import { DomainError } from '@/src/domain/shared/errors';
import { api } from '@/src/infrastructure/api/client';

/**
 * The delivery team, from the dairy's server.
 *
 * The dairy sees each record in full. A delivery boy signed into the delivery app sees the team as the salary
 * maths needs it — names, routes and rates — but not a colleague's bank details, Aadhaar or address, and can
 * change nothing but their own attendance.
 */
export class DeliveryBoyServiceApi implements IDeliveryBoyService {
  async list(): Promise<DeliveryBoyListResponse> {
    return api.get<DeliveryBoyListResponse>('/delivery-boys');
  }

  async getById(id: string): Promise<DeliveryBoyResponse | null> {
    try {
      return await api.get<DeliveryBoyResponse>(`/delivery-boys/${encodeURIComponent(id)}`);
    } catch (error) {
      if (error instanceof DomainError && error.code === 'DELIVERY_BOY_NOT_FOUND') return null;
      throw error;
    }
  }

  /** The signed-in delivery boy's own record, without the app needing to know its id. */
  async getMine(): Promise<DeliveryBoyResponse | null> {
    try {
      return await api.get<DeliveryBoyResponse>('/me/delivery-boy');
    } catch (error) {
      if (error instanceof DomainError && error.code === 'DELIVERY_BOY_NOT_FOUND') return null;
      throw error;
    }
  }

  async create(data: CreateDeliveryBoyRequest): Promise<DeliveryBoyResponse> {
    return api.post<DeliveryBoyResponse>('/delivery-boys', data);
  }

  async update(id: string, data: UpdateDeliveryBoyRequest): Promise<DeliveryBoyResponse> {
    return api.patch<DeliveryBoyResponse>(`/delivery-boys/${encodeURIComponent(id)}`, data);
  }

  async delete(id: string): Promise<void> {
    await api.delete<void>(`/delivery-boys/${encodeURIComponent(id)}`);
  }
}
