import type { ProductCategory } from '@/src/domain/productCategories/entities';

export interface CreateProductCategoryRequest {
  name: string;
  isActive: boolean;
}

export interface UpdateProductCategoryRequest {
  name?: string;
  isActive?: boolean;
}

export interface ProductCategoryResponse extends ProductCategory {}

export interface ProductCategoryListResponse {
  items: ProductCategoryResponse[];
  total: number;
}

