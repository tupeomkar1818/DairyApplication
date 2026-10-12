import type {
  CreateProductRequest,
  ProductListResponse,
  ProductResponse,
  UpdateProductRequest,
} from '@/src/domain/products/dtos';
import type { IProductService } from '@/src/domain/products/service.interface';
import { api } from '@/src/infrastructure/api/client';

/** The catalog, from the dairy's server: one list every app and every phone sees. */
export class ProductServiceApi implements IProductService {
  async list(): Promise<ProductListResponse> {
    return api.get<ProductListResponse>('/products');
  }

  async create(data: CreateProductRequest): Promise<ProductResponse> {
    return api.post<ProductResponse>('/products', data);
  }

  async update(id: string, data: UpdateProductRequest): Promise<ProductResponse> {
    return api.patch<ProductResponse>(`/products/${encodeURIComponent(id)}`, data);
  }

  async delete(id: string): Promise<void> {
    await api.delete<void>(`/products/${encodeURIComponent(id)}`);
  }
}
