import type {
  CreateProductCategoryRequest,
  ProductCategoryListResponse,
  ProductCategoryResponse,
  UpdateProductCategoryRequest,
} from '@/src/domain/productCategories/dtos';

export interface IProductCategoryService {
  /** GET /api/product-categories */
  list(): Promise<ProductCategoryListResponse>;

  /** POST /api/product-categories */
  create(data: CreateProductCategoryRequest): Promise<ProductCategoryResponse>;

  /** PUT /api/product-categories/:id */
  update(id: string, data: UpdateProductCategoryRequest): Promise<ProductCategoryResponse>;

  /** DELETE /api/product-categories/:id */
  delete(id: string): Promise<void>;
}

