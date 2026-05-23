import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  CreateProductCategoryRequest,
  ProductCategoryListResponse,
  ProductCategoryResponse,
  UpdateProductCategoryRequest,
} from '@/src/domain/productCategories/dtos';
import { services } from '@/src/infrastructure/service-registry';

export function useProductCategories() {
  return useQuery<ProductCategoryListResponse>({
    queryKey: ['productCategories', 'list'],
    queryFn: () => services.productCategories.list(),
    staleTime: 30_000,
  });
}

export function useCreateProductCategory() {
  const qc = useQueryClient();
  return useMutation<ProductCategoryResponse, unknown, CreateProductCategoryRequest>({
    mutationFn: (data) => services.productCategories.create(data),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['productCategories', 'list'] });
    },
  });
}

export function useUpdateProductCategory() {
  const qc = useQueryClient();
  return useMutation<ProductCategoryResponse, unknown, { id: string; data: UpdateProductCategoryRequest }>({
    mutationFn: ({ id, data }) => services.productCategories.update(id, data),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['productCategories', 'list'] });
    },
  });
}

export function useDeleteProductCategory() {
  const qc = useQueryClient();
  return useMutation<void, unknown, { id: string }>({
    mutationFn: ({ id }) => services.productCategories.delete(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['productCategories', 'list'] });
    },
  });
}

