import type { CreateProductRequest, ProductListResponse, ProductResponse, UpdateProductRequest } from '@/src/domain/products/dtos';

export interface IProductService {
  /** GET /api/products */
  list(): Promise<ProductListResponse>;

  /** POST /api/products */
  create(data: CreateProductRequest): Promise<ProductResponse>;

  /** PUT /api/products/:id */
  update(id: string, data: UpdateProductRequest): Promise<ProductResponse>;

  /** DELETE /api/products/:id */
  delete(id: string): Promise<void>;
}

