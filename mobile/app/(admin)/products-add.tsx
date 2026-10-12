import { useMemo } from 'react';
import { router } from 'expo-router';

import { emptyProductForm, parseCreateProductRequest } from '@/src/components/admin/productFormShared';
import { ProductFormScreen } from '@/src/components/admin/ProductFormScreen';
import type { ProductFormState } from '@/src/components/admin/productFormShared';
import { useCreateProduct } from '@/src/hooks/products';
import { strings } from '@/src/i18n/strings';
import { useStrings } from '@/src/i18n/useStrings';

export default function AdminAddProductScreen() {
  const t = useStrings('products');
  const create = useCreateProduct();
  const initialForm = useMemo(() => emptyProductForm(), []);

  async function onSave(form: ProductFormState) {
    const parsed = parseCreateProductRequest(form);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? strings('products').form.checkForm);
    }
    await create.mutateAsync(parsed.data);
    router.back();
  }

  return (
    <ProductFormScreen
      title={t.form.addTitle}
      saveLabel={t.form.saveProduct}
      initialForm={initialForm}
      isPending={create.isPending}
      onSave={onSave}
      onCancel={() => router.back()}
    />
  );
}
