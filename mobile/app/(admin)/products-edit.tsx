import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { ProductFormScreen } from '@/src/components/admin/ProductFormScreen';
import {
  buildCustomVariantLabel,
  productFormFromResponse,
  type ProductFormState,
} from '@/src/components/admin/productFormShared';
import { UpdateProductDetailsRequestSchema } from '@/src/domain/products/validations';
import { useProducts, useUpdateProduct } from '@/src/hooks/products';
import { useScreenSafeInsets } from '@/src/hooks/useScreenSafeInsets';
import { amraleColors, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';

export default function AdminUpdateProductScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id ?? '';
  const products = useProducts();
  const update = useUpdateProduct();
  const { headerPaddingTop } = useScreenSafeInsets();
  const product = useMemo(() => {
    const items = products.data?.items ?? [];
    return items.find((p) => p.id === id) ?? null;
  }, [id, products.data?.items]);

  const seed = useMemo(() => {
    if (!product) return null;
    return productFormFromResponse(product);
  }, [product?.id]);

  async function onSave(form: ProductFormState) {
    if (!product) return;

    const parsed = UpdateProductDetailsRequestSchema.safeParse({
      name: form.name,
      price: Number(form.price),
      unit: form.unit,
      isActive: true,
    });
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? 'Please check the form');
    }

    const imageUri = form.imageUrl.trim();
    await update.mutateAsync({
      id: product.id,
      data: {
        ...parsed.data,
        isActive: true,
        imageUri,
        variants: ['Custom Size'],
        customVariantLabel: buildCustomVariantLabel(form),
        isVisibleToCustomer: form.availableForOnline,
        isVisibleOfflineCounter: form.availableForOffline,
      },
    });
    router.back();
  }

  if (!product || !seed) {
    return (
      <View style={styles.screen}>
        <View style={[styles.header, { paddingTop: headerPaddingTop }]}>
          <Pressable onPress={() => router.back()} style={styles.headerIconBtn} accessibilityLabel="Go back">
            <MaterialCommunityIcons name="arrow-left" size={24} color={amraleColors.blue} />
          </Pressable>
          <Text style={styles.headerTitle}>Update Product</Text>
        </View>
        <View style={styles.headerDivider} />
        <View style={styles.loading}>
          <ActivityIndicator color={amraleColors.blue} />
        </View>
      </View>
    );
  }

  return (
    <ProductFormScreen
      key={product.id}
      title="Update Product"
      saveLabel="Update Product"
      initialForm={seed.form}
      initialCustomQuantity={seed.customQuantity}
      isPending={update.isPending}
      onSave={onSave}
      onCancel={() => router.back()}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: amraleColors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: amraleSpacing.sm,
    paddingHorizontal: amraleSpacing.md,
    paddingBottom: amraleSpacing.sm,
    backgroundColor: amraleColors.white,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    minWidth: 0,
    textAlign: 'left',
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 18,
    color: amraleColors.blue,
  },
  headerDivider: {
    height: 1,
    backgroundColor: amraleColors.inputBorderLight,
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
