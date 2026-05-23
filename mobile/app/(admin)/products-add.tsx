import { useMemo } from 'react';
import { router } from 'expo-router';

import { emptyProductForm, parseCreateProductRequest } from '@/src/components/admin/productFormShared';
import { ProductFormScreen } from '@/src/components/admin/ProductFormScreen';
import type { ProductFormState } from '@/src/components/admin/productFormShared';
import { useCreateProduct } from '@/src/hooks/products';

export default function AdminAddProductScreen() {
  const create = useCreateProduct();
  const initialForm = useMemo(() => emptyProductForm(), []);

  async function onSave(form: ProductFormState) {
    const parsed = parseCreateProductRequest(form);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? 'Please check the form');
    }
    await create.mutateAsync(parsed.data);
    router.back();
  }

  return (
    <ProductFormScreen
      title="Add Product"
      saveLabel="Save Product"
      initialForm={initialForm}
      isPending={create.isPending}
      onSave={onSave}
      onCancel={() => router.back()}
    />
  );
}
