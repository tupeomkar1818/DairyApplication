import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { ProductFormScreen, type ProductFormSection } from '@/src/components/admin/ProductFormScreen';
import {
  parseUpdateProductRequest,
  productFormFromResponse,
  type ProductFormState,
} from '@/src/components/admin/productFormShared';
import { useProducts, useUpdateProduct } from '@/src/hooks/products';
import { useScreenSafeInsets } from '@/src/hooks/useScreenSafeInsets';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';

const PRODUCT_FORM_SECTIONS: ProductFormSection[] = ['basics', 'pricing', 'pack', 'availability', 'channels', 'features', 'description'];

export default function AdminUpdateProductScreen() {
  const t = useStrings('products');
  const params = useLocalSearchParams<{ id?: string; section?: string }>();
  const id = params.id ?? '';
  // The Details screen's per-section Edit links open the form at that section.
  const initialSection = PRODUCT_FORM_SECTIONS.includes(params.section as ProductFormSection)
    ? (params.section as ProductFormSection)
    : undefined;
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
    if (!product || !seed) return;

    const parsed = parseUpdateProductRequest(product, seed.form, form);
    if (!parsed.success) {
      throw new Error(parsed.message);
    }

    await update.mutateAsync({ id: product.id, data: parsed.data });
    router.back();
  }

  if (!product || !seed) {
    const notFound = !products.isLoading;
    return (
      <View style={styles.screen}>
        <View style={[styles.header, { paddingTop: headerPaddingTop }]}>
          <Pressable onPress={() => router.back()} hitSlop={4} style={styles.headerIconBtn} accessibilityLabel={t.form.goBack}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={amraleColors.blue} />
          </Pressable>
          <Text style={styles.headerTitle}>{t.form.editTitle}</Text>
        </View>
        <View style={styles.headerDivider} />
        <View style={styles.loading}>
          {notFound ? (
            <>
              <MaterialCommunityIcons name="package-variant-remove" size={48} color={amraleColors.textSubtle} />
              <Text style={styles.notFoundTitle}>{t.notFound.title}</Text>
              <Text style={styles.notFoundHint}>
                {products.isError ? t.notFound.loadFailed : t.notFound.maybeDeleted}
              </Text>
              <Pressable
                onPress={() => router.back()}
                style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Text style={styles.backBtnText}>{t.notFound.goBack}</Text>
              </Pressable>
            </>
          ) : (
            <ActivityIndicator color={amraleColors.blue} />
          )}
        </View>
      </View>
    );
  }

  return (
    <ProductFormScreen
      key={product.id}
      title={t.form.editTitle}
      saveLabel={t.form.saveChanges}
      initialForm={seed.form}
      initialCustomQuantity={seed.customQuantity}
      initialSection={initialSection}
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
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: amraleSpacing.lg },
  notFoundTitle: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 18,
    color: amraleColors.text,
  },
  notFoundHint: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 14,
    color: amraleColors.textMuted,
    textAlign: 'center',
  },
  backBtn: {
    marginTop: amraleSpacing.sm,
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: amraleColors.blue,
  },
  backBtnText: {
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 15,
    color: amraleColors.white,
  },
  pressed: { opacity: 0.88 },
});
