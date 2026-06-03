import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  Button,
  Card,
  Checkbox,
  Dialog,
  HelperText,
  List,
  Menu,
  Portal,
  RadioButton,
  Switch,
  Text,
  TextInput,
} from 'react-native-paper';

import type { DayOfWeek, DeliveryTimeSlot, ProductAvailability, ProductFeature, ProductType, ProductUnit, ProductVariant, TaxPercentage } from '@/src/domain/products/enums';
import type { ProductResponse } from '@/src/domain/products/dtos';
import { CreateProductRequestSchema } from '@/src/domain/products/validations';
import { useCreateProduct, useDeleteProduct, useProducts, useUpdateProduct } from '@/src/hooks/products';
import { useProductCategories } from '@/src/hooks/productCategories';

const COLORS = {
  primary: '#2563EB',
  secondary: '#60A5FA',
  accent: '#22C55E',
  bg: '#F8FAFC',
  text: '#1E293B',
};

type SortKey = 'latest' | 'price' | 'stock';

type ProductFormState = {
  imageUri: string;
  name: string;
  category: string;
  productType: ProductType;
  description: string;
  price: string;
  discountPrice: string;
  unit: ProductUnit;
  variants: ProductVariant[];
  customVariantLabel: string;
  availableDays: DayOfWeek[];
  availability: ProductAvailability;
  deliveryTimeSlots: DeliveryTimeSlot[];
  availableStock: string;
  minStockAlert: string;
  sku: string;
  features: ProductFeature[];
  taxApplicable: boolean;
  taxPercentage: TaxPercentage;
  isVisibleToCustomer: boolean;
  isActive: boolean;
};

function statusForProduct(p: ProductResponse): { label: 'Out of Stock' | 'Active' | 'Inactive'; tone: 'red' | 'green' | 'gray' } {
  if (p.availableStock <= 0) return { label: 'Out of Stock', tone: 'red' };
  if (p.isActive) return { label: 'Active', tone: 'green' };
  return { label: 'Inactive', tone: 'gray' };
}

function toNumberOrUndefined(raw: string): number | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

function toIntOrUndefined(raw: string): number | undefined {
  const n = toNumberOrUndefined(raw);
  if (n === undefined) return undefined;
  return Math.trunc(n);
}

function badgeColors(tone: 'red' | 'green' | 'gray') {
  switch (tone) {
    case 'red':
      return { bg: 'rgba(239,68,68,0.14)', fg: '#B91C1C', border: 'rgba(239,68,68,0.22)' };
    case 'green':
      return { bg: 'rgba(34,197,94,0.14)', fg: '#166534', border: 'rgba(34,197,94,0.22)' };
    default:
      return { bg: 'rgba(148,163,184,0.16)', fg: '#475569', border: 'rgba(148,163,184,0.22)' };
  }
}

function emptyForm(): ProductFormState {
  return {
    imageUri: '',
    name: '',
    category: 'Milk',
    productType: 'Milk',
    description: '',
    price: '',
    discountPrice: '',
    unit: 'Litre',
    variants: ['1 Litre'],
    customVariantLabel: '',
    availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    availability: 'Available',
    deliveryTimeSlots: ['Morning'],
    availableStock: '',
    minStockAlert: '',
    sku: '',
    features: ['Home Delivery Available'],
    taxApplicable: false,
    taxPercentage: '0%',
    isVisibleToCustomer: true,
    isActive: true,
  };
}

export function ProductManagementSection() {
  const scheme = useColorScheme();
  const { width } = useWindowDimensions();

  const products = useProducts();
  const productCategories = useProductCategories();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('All');
  const [sortKey, setSortKey] = useState<SortKey>('latest');

  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProductResponse | null>(null);
  const [form, setForm] = useState<ProductFormState>(() => emptyForm());
  const [formTouched, setFormTouched] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [categoryPickerQuery, setCategoryPickerQuery] = useState('');
  const [taxPickerOpen, setTaxPickerOpen] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<ProductResponse | null>(null);

  const openAnim = useRef(new Animated.Value(0)).current;

  const columns = useMemo(() => {
    if (width >= 1100) return 3;
    if (width >= 720) return 2;
    return 1;
  }, [width]);

  const cardWidth = useMemo(() => {
    const max = 1120;
    const padding = 16 * 2;
    const available = Math.min(width - padding, max - padding);
    const gap = 12;
    return Math.floor((available - gap * (columns - 1)) / columns);
  }, [columns, width]);

  const all = products.data?.items ?? [];

  const categories = useMemo(() => {
    const items = productCategories.data?.items ?? [];
    const active = items.filter((c) => c.isActive).map((c) => c.name);
    if (active.length > 0) return ['All', ...active];
    const set = new Set<string>();
    for (const p of all) set.add(p.category);
    return ['All', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [all, productCategories.data?.items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let items = all;
    if (category !== 'All') items = items.filter((p) => p.category === category);
    if (q) {
      items = items.filter((p) => {
        const blob = `${p.name} ${p.category} ${p.description ?? ''} ${p.sku ?? ''}`.toLowerCase();
        return blob.includes(q);
      });
    }

    switch (sortKey) {
      case 'price':
        items = [...items].sort((a, b) => (a.discountPrice && a.discountPrice > 0 ? a.discountPrice : a.price) - (b.discountPrice && b.discountPrice > 0 ? b.discountPrice : b.price));
        break;
      case 'stock':
        items = [...items].sort((a, b) => b.availableStock - a.availableStock);
        break;
      case 'latest':
      default:
        items = [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return items;
  }, [all, category, query, sortKey]);

  const summary = useMemo(() => {
    const total = all.length;
    const active = all.filter((p) => p.isActive && p.availableStock > 0).length;
    const outOfStock = all.filter((p) => p.availableStock <= 0).length;
    const categoryCount = new Set(all.map((p) => p.category)).size;
    return [
      { key: 'total', label: 'Total Products', value: String(total), colors: ['#2563EB', '#60A5FA'] as const, icon: 'cube-outline' as const },
      { key: 'active', label: 'Active Products', value: String(active), colors: ['#22C55E', '#60A5FA'] as const, icon: 'check-decagram-outline' as const },
      { key: 'oos', label: 'Out of Stock', value: String(outOfStock), colors: ['#EF4444', '#F97316'] as const, icon: 'alert-circle-outline' as const },
      { key: 'cats', label: 'Categories', value: String(categoryCount), colors: ['#2563EB', '#22C55E'] as const, icon: 'shape-outline' as const },
    ];
  }, [all]);

  function animateForm(open: boolean) {
    openAnim.stopAnimation();
    Animated.timing(openAnim, {
      toValue: open ? 1 : 0,
      duration: open ? 240 : 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }

  function openCreate() {
    router.push('/(admin)/products-add');
  }

  function openEdit(p: ProductResponse) {
    router.push({ pathname: '/(admin)/products-edit', params: { id: p.id } });
  }

  function closeForm() {
    animateForm(false);
    setTimeout(() => {
      setFormOpen(false);
      setEditing(null);
      setFormError(null);
    }, 160);
  }

  const parsedForm = useMemo(() => {
    const input = {
      name: form.name,
      category: form.category,
      productType: form.productType,
      price: Number(form.price),
      discountPrice: toNumberOrUndefined(form.discountPrice),
      unit: form.unit,
      variants: form.variants,
      customVariantLabel: form.customVariantLabel,
      description: form.description,
      availableStock: Number(form.availableStock),
      minStockAlert: toIntOrUndefined(form.minStockAlert),
      availableDays: form.availableDays,
      availability: form.availability,
      deliveryTimeSlots: form.deliveryTimeSlots,
      sku: form.sku,
      imageUri: form.imageUri,
      features: form.features,
      taxApplicable: form.taxApplicable,
      taxPercentage: form.taxApplicable ? form.taxPercentage : undefined,
      isVisibleToCustomer: form.isVisibleToCustomer,
      isActive: form.isActive,
    };
    return CreateProductRequestSchema.safeParse(input);
  }, [form]);

  async function onPickImage() {
    try {
      // Optional dependency. If not installed, user can still paste a URL.
      const mod = await import('expo-image-picker');
      const ImagePicker = mod;

      if (Platform.OS !== 'web') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsEditing: true,
        aspect: [1, 1],
      });

      if (result.canceled) return;
      const uri = result.assets?.[0]?.uri;
      if (!uri) return;
      setForm((s) => ({ ...s, imageUri: uri }));
    } catch {
      // ignore
    }
  }

  function toggleInList<T extends string>(list: T[], value: T, checked: boolean): T[] {
    if (checked) return list.includes(value) ? list : [...list, value];
    return list.filter((x) => x !== value);
  }

  async function onSave() {
    setFormTouched(true);
    setFormError(null);
    if (!parsedForm.success) {
      setFormError(parsedForm.error.issues[0]?.message ?? 'Please check the form');
      return;
    }

    try {
      if (editing) {
        await updateProduct.mutateAsync({ id: editing.id, data: parsedForm.data });
      } else {
        await createProduct.mutateAsync(parsedForm.data);
      }
      closeForm();
    } catch {
      setFormError('Unable to save product. Please try again.');
    }
  }

  async function onToggleActive(p: ProductResponse, next: boolean) {
    try {
      await updateProduct.mutateAsync({ id: p.id, data: { isActive: next } });
    } catch {
      // ignore for mock
    }
  }

  async function onConfirmDelete() {
    const p = confirmDelete;
    if (!p) return;
    try {
      await deleteProduct.mutateAsync({ id: p.id });
      setConfirmDelete(null);
    } catch {
      setConfirmDelete(null);
    }
  }

  const bg = scheme === 'dark' ? '#0B1220' : COLORS.bg;
  const sectionCard = scheme === 'dark' ? styles.sectionCardDark : styles.sectionCardLight;
  const textMain = scheme === 'dark' ? styles.textOnDark : styles.textOnLight;
  const textSub = scheme === 'dark' ? styles.subtleOnDark : styles.subtleOnLight;

  return (
    <View style={[styles.wrap, { backgroundColor: bg }]}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text variant="titleLarge" style={[styles.hTitle, textMain]}>
            Product Management
          </Text>
          <Text variant="bodyMedium" style={[styles.hSub, textSub]}>
            Manage all dairy products available for customer orders
          </Text>
        </View>

        <LinearGradient colors={[COLORS.primary, COLORS.secondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.addBtnGradient}>
          <Button
            mode="contained"
            onPress={openCreate}
            icon="plus"
            buttonColor="transparent"
            textColor="white"
            style={styles.addBtn}
            contentStyle={styles.addBtnContent}
          >
            Add Product
          </Button>
        </LinearGradient>
      </View>

      <View style={styles.controlsRow}>
        <TextInput
          mode="outlined"
          placeholder="Search product name"
          value={query}
          onChangeText={setQuery}
          style={[styles.search, sectionCard]}
          left={<TextInput.Icon icon="magnify" />}
        />

        <Menu
          visible={categoryMenuOpen}
          onDismiss={() => setCategoryMenuOpen(false)}
          anchor={
            <Pressable onPress={() => setCategoryMenuOpen(true)} style={({ pressed }) => [styles.chip, sectionCard, pressed && styles.pressed]}>
              <MaterialCommunityIcons name="filter-variant" size={18} color={scheme === 'dark' ? 'white' : COLORS.text} />
              <Text variant="labelLarge" style={textMain}>
                {category === 'All' ? 'Category' : category}
              </Text>
              <MaterialCommunityIcons name="chevron-down" size={18} color={scheme === 'dark' ? 'white' : COLORS.text} />
            </Pressable>
          }
        >
          {categories.map((c) => (
            <Menu.Item
              key={c}
              onPress={() => {
                setCategory(c);
                setCategoryMenuOpen(false);
              }}
              title={c}
            />
          ))}
        </Menu>

        <Menu
          visible={sortMenuOpen}
          onDismiss={() => setSortMenuOpen(false)}
          anchor={
            <Pressable onPress={() => setSortMenuOpen(true)} style={({ pressed }) => [styles.chip, sectionCard, pressed && styles.pressed]}>
              <MaterialCommunityIcons name="sort" size={18} color={scheme === 'dark' ? 'white' : COLORS.text} />
              <Text variant="labelLarge" style={textMain}>
                {sortKey === 'latest' ? 'Latest' : sortKey === 'price' ? 'Price' : 'Stock'}
              </Text>
              <MaterialCommunityIcons name="chevron-down" size={18} color={scheme === 'dark' ? 'white' : COLORS.text} />
            </Pressable>
          }
        >
          <Menu.Item title="Latest product" onPress={() => { setSortKey('latest'); setSortMenuOpen(false); }} />
          <Menu.Item title="Price" onPress={() => { setSortKey('price'); setSortMenuOpen(false); }} />
          <Menu.Item title="Stock" onPress={() => { setSortKey('stock'); setSortMenuOpen(false); }} />
        </Menu>
      </View>

      <View style={styles.summaryRow}>
        {summary.map((s) => (
          <LinearGradient key={s.key} colors={[...s.colors]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.summaryCard}>
            <View style={styles.summaryTop}>
              <View style={styles.summaryIconWrap}>
                <MaterialCommunityIcons name={s.icon} size={18} color="white" />
              </View>
              <Text variant="headlineSmall" style={styles.summaryValue}>
                {s.value}
              </Text>
            </View>
            <Text variant="labelLarge" style={styles.summaryLabel}>
              {s.label}
            </Text>
          </LinearGradient>
        ))}
      </View>

      <View style={styles.grid}>
        {filtered.map((p) => {
          const status = statusForProduct(p);
          const badge = badgeColors(status.tone);
          const lowStock = p.minStockAlert !== undefined && p.availableStock > 0 && p.availableStock <= p.minStockAlert;

          const showPrice = p.discountPrice && p.discountPrice > 0 && p.discountPrice < p.price;
          return (
            <Card
              key={p.id}
              style={[
                styles.productCard,
                sectionCard,
                { width: cardWidth },
              ]}
              mode="elevated"
            >
              <Card.Content style={styles.productContent}>
                <View style={styles.productTop}>
                  <View style={styles.productImageWrap}>
                    {p.imageUri ? (
                      <Image source={{ uri: p.imageUri }} style={styles.productImage} resizeMode="cover" />
                    ) : (
                      <View style={[styles.productImagePlaceholder, scheme === 'dark' ? styles.imagePhDark : styles.imagePhLight]}>
                        <MaterialCommunityIcons name="image-outline" size={20} color={scheme === 'dark' ? 'white' : COLORS.text} />
                      </View>
                    )}
                  </View>

                  <View style={styles.productMeta}>
                    <Text variant="titleMedium" style={[styles.productName, textMain]} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text variant="bodySmall" style={textSub} numberOfLines={1}>
                      {p.category} • {p.unit}
                    </Text>

                    <View style={[styles.badge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                      <Text variant="labelSmall" style={{ color: badge.fg }}>
                        {status.label}
                      </Text>
                    </View>
                  </View>
                </View>

                <Text variant="bodySmall" style={[styles.productDesc, textSub]} numberOfLines={2}>
                  {p.description || '—'}
                </Text>

                <View style={styles.detailRow}>
                  <View style={styles.detailItem}>
                    <Text variant="labelSmall" style={textSub}>
                      Price
                    </Text>
                    <Text variant="titleSmall" style={textMain}>
                      ₹{showPrice ? p.discountPrice : p.price}
                    </Text>
                    {showPrice ? (
                      <Text variant="bodySmall" style={[styles.strike, textSub]}>
                        ₹{p.price}
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.detailItem}>
                    <Text variant="labelSmall" style={textSub}>
                      Stock
                    </Text>
                    <Text variant="titleSmall" style={[textMain, lowStock ? styles.lowStockText : null]}>
                      {p.availableStock}
                    </Text>
                    {lowStock ? (
                      <Text variant="bodySmall" style={[styles.lowStockHint]}>
                        Low stock
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.detailItem}>
                    <Text variant="labelSmall" style={textSub}>
                      SKU
                    </Text>
                    <Text variant="titleSmall" style={textMain} numberOfLines={1}>
                      {p.sku || '—'}
                    </Text>
                  </View>
                </View>

                <View style={styles.actionsRow}>
                  <Pressable onPress={() => openEdit(p)} style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}>
                    <MaterialCommunityIcons name="pencil-outline" size={20} color={COLORS.primary} />
                  </Pressable>
                  <Pressable onPress={() => setConfirmDelete(p)} style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}>
                    <MaterialCommunityIcons name="trash-can-outline" size={20} color="#EF4444" />
                  </Pressable>

                  <View style={styles.flex} />
                  <Text variant="labelSmall" style={textSub}>
                    Active
                  </Text>
                  <Switch value={p.isActive} onValueChange={(v) => onToggleActive(p, v)} />
                </View>
              </Card.Content>
            </Card>
          );
        })}
      </View>

      {/* Floating add button for mobile */}
      {width < 720 ? (
        <Pressable onPress={openCreate} style={({ pressed }) => [styles.fab, pressed && styles.pressed]}>
          <LinearGradient colors={[COLORS.primary, COLORS.secondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabBg}>
            <MaterialCommunityIcons name="plus" size={26} color="white" />
          </LinearGradient>
        </Pressable>
      ) : null}

      <Portal>
        <Dialog visible={!!confirmDelete} onDismiss={() => setConfirmDelete(null)} style={scheme === 'dark' ? styles.dialogDark : styles.dialogLight}>
          <Dialog.Title>Delete product</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">Are you sure you want to delete this product?</Text>
            <Text variant="bodySmall" style={styles.dialogHint}>
              {confirmDelete?.name ?? ''}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmDelete(null)}>Cancel</Button>
            <Button textColor="#EF4444" onPress={onConfirmDelete}>
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Portal>
        <Dialog
          visible={formOpen}
          onDismiss={closeForm}
          style={[
            scheme === 'dark' ? styles.dialogDark : styles.dialogLight,
            styles.formDialog,
            { width: '100%', maxWidth: 860, alignSelf: 'center' },
          ]}
        >
          <Animated.View
            style={{
              opacity: openAnim,
              transform: [{ translateY: openAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
            }}
          >
            <View style={styles.dialogTitleRow}>
              <Text variant="titleLarge" style={styles.dialogTitleText}>
                {editing ? 'Edit Product' : 'Add Product'}
              </Text>
              <Pressable onPress={closeForm} style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}>
                <MaterialCommunityIcons name="close" size={20} color={scheme === 'dark' ? 'white' : COLORS.text} />
              </Pressable>
            </View>
            <Dialog.ScrollArea>
              <ScrollView contentContainerStyle={styles.formBody} keyboardShouldPersistTaps="handled">
                <View style={styles.previewRow}>
                  <View style={styles.previewBox}>
                    {form.imageUri ? (
                      <Image source={{ uri: form.imageUri }} style={styles.previewImage} resizeMode="cover" />
                    ) : (
                      <View style={[styles.previewPlaceholder, scheme === 'dark' ? styles.imagePhDark : styles.imagePhLight]}>
                        <MaterialCommunityIcons name="image-outline" size={22} color={scheme === 'dark' ? 'white' : COLORS.text} />
                      </View>
                    )}
                  </View>
                  <View style={styles.previewInputs}>
                    <View style={styles.formRow}>
                      <Button mode="outlined" onPress={onPickImage} icon="upload" style={styles.formHalf}>
                        Upload Image
                      </Button>
                      <Button mode="text" onPress={() => setForm((s) => ({ ...s, imageUri: '' }))} style={styles.formHalf}>
                        Remove
                      </Button>
                    </View>
                    <TextInput mode="outlined" label="Image URL (optional)" value={form.imageUri} onChangeText={(t) => setForm((s) => ({ ...s, imageUri: t }))} />
                    <HelperText type="info" visible={true}>
                      Image upload works in supported devices; URL also supported.
                    </HelperText>
                  </View>
                </View>

                <List.Section>
                  <List.Accordion title="Product Details" left={(p) => <List.Icon {...p} icon="information-outline" />}>
                    <View style={styles.sectionBody}>
                      <TextInput mode="outlined" label="Product name" value={form.name} onChangeText={(t) => setForm((s) => ({ ...s, name: t }))} />

                      <Pressable onPress={() => { setCategoryPickerQuery(''); setCategoryPickerOpen(true); }} style={({ pressed }) => [styles.pickerField, pressed && styles.pressed]}>
                        <Text variant="labelLarge" style={styles.pickerLabel}>Category</Text>
                        <Text variant="bodyMedium">{form.category}</Text>
                        <MaterialCommunityIcons name="chevron-down" size={20} color={COLORS.text} />
                      </Pressable>

                      <Text variant="labelLarge" style={styles.groupLabel}>Product Type</Text>
                      <RadioButton.Group value={form.productType} onValueChange={(v) => setForm((s) => ({ ...s, productType: v as ProductType }))}>
                        <View style={styles.radioWrap}>
                          {(['Milk', 'Milk Product', 'Sweet Product', 'Grocery Product'] as const).map((t) => (
                            <View key={t} style={styles.radioItem}>
                              <RadioButton value={t} />
                              <Text>{t}</Text>
                            </View>
                          ))}
                        </View>
                      </RadioButton.Group>

                      <Text variant="labelLarge" style={styles.groupLabel}>Unit Type</Text>
                      <RadioButton.Group value={form.unit} onValueChange={(v) => setForm((s) => ({ ...s, unit: v as ProductUnit }))}>
                        <View style={styles.radioWrap}>
                          {(['Litre', 'Kg', 'Gram', 'Packet', 'Bottle', 'Piece'] as const).map((u) => (
                            <View key={u} style={styles.radioItem}>
                              <RadioButton value={u} />
                              <Text>{u}</Text>
                            </View>
                          ))}
                        </View>
                      </RadioButton.Group>

                      <Text variant="labelLarge" style={styles.groupLabel}>Product Variant</Text>
                      <View style={styles.checkGrid}>
                        {(['250 ml', '500 ml', '1 Litre', '2 Litre', 'Custom Size'] as const).map((v) => (
                          <Pressable
                            key={v}
                            onPress={() => setForm((s) => ({ ...s, variants: toggleInList(s.variants, v, !s.variants.includes(v)) }))}
                            style={({ pressed }) => [styles.checkItem, pressed && styles.pressed]}
                          >
                            <Checkbox status={form.variants.includes(v) ? 'checked' : 'unchecked'} />
                            <Text>{v}</Text>
                          </Pressable>
                        ))}
                      </View>
                      {form.variants.includes('Custom Size') ? (
                        <TextInput mode="outlined" label="Custom size" value={form.customVariantLabel} onChangeText={(t) => setForm((s) => ({ ...s, customVariantLabel: t }))} />
                      ) : null}

                      <TextInput mode="outlined" label="SKU / Product code" value={form.sku} onChangeText={(t) => setForm((s) => ({ ...s, sku: t }))} />
                      <TextInput mode="outlined" label="Description" value={form.description} onChangeText={(t) => setForm((s) => ({ ...s, description: t }))} multiline numberOfLines={3} />
                    </View>
                  </List.Accordion>

                  <List.Accordion title="Pricing" left={(p) => <List.Icon {...p} icon="currency-inr" />}>
                    <View style={styles.sectionBody}>
                      <View style={styles.responsiveRow}>
                        <TextInput mode="outlined" label="Price" keyboardType="decimal-pad" value={form.price} onChangeText={(t) => setForm((s) => ({ ...s, price: t.replace(/[^\d.]/g, '') }))} style={styles.flex1} />
                        <TextInput mode="outlined" label="Discount Price" keyboardType="decimal-pad" value={form.discountPrice} onChangeText={(t) => setForm((s) => ({ ...s, discountPrice: t.replace(/[^\d.]/g, '') }))} style={styles.flex1} />
                      </View>

                      <Text variant="labelLarge" style={styles.groupLabel}>Tax Applicable</Text>
                      <RadioButton.Group value={form.taxApplicable ? 'Yes' : 'No'} onValueChange={(v) => setForm((s) => ({ ...s, taxApplicable: v === 'Yes' }))}>
                        <View style={styles.radioWrap}>
                          {(['Yes', 'No'] as const).map((v) => (
                            <View key={v} style={styles.radioItem}>
                              <RadioButton value={v} />
                              <Text>{v}</Text>
                            </View>
                          ))}
                        </View>
                      </RadioButton.Group>

                      {form.taxApplicable ? (
                        <Pressable onPress={() => setTaxPickerOpen(true)} style={({ pressed }) => [styles.pickerField, pressed && styles.pressed]}>
                          <Text variant="labelLarge" style={styles.pickerLabel}>Tax Percentage</Text>
                          <Text variant="bodyMedium">{form.taxPercentage}</Text>
                          <MaterialCommunityIcons name="chevron-down" size={20} color={COLORS.text} />
                        </Pressable>
                      ) : null}
                    </View>
                  </List.Accordion>

                  <List.Accordion title="Stock" left={(p) => <List.Icon {...p} icon="warehouse" />}>
                    <View style={styles.sectionBody}>
                      <View style={styles.responsiveRow}>
                        <TextInput mode="outlined" label="Stock Quantity" keyboardType="number-pad" value={form.availableStock} onChangeText={(t) => setForm((s) => ({ ...s, availableStock: t.replace(/\D/g, '') }))} style={styles.flex1} />
                        <TextInput mode="outlined" label="Minimum Stock Alert" keyboardType="number-pad" value={form.minStockAlert} onChangeText={(t) => setForm((s) => ({ ...s, minStockAlert: t.replace(/\D/g, '') }))} style={styles.flex1} />
                      </View>

                      <Text variant="labelLarge" style={styles.groupLabel}>Product Availability</Text>
                      <RadioButton.Group value={form.availability} onValueChange={(v) => setForm((s) => ({ ...s, availability: v as ProductAvailability }))}>
                        <View style={styles.radioWrap}>
                          {(['Available', 'Out of Stock', 'Seasonal Product', 'Discontinued'] as const).map((a) => (
                            <View key={a} style={styles.radioItem}>
                              <RadioButton value={a} />
                              <Text>{a}</Text>
                            </View>
                          ))}
                        </View>
                      </RadioButton.Group>
                    </View>
                  </List.Accordion>

                  <List.Accordion title="Delivery" left={(p) => <List.Icon {...p} icon="truck-delivery-outline" />}>
                    <View style={styles.sectionBody}>
                      <Text variant="labelLarge" style={styles.groupLabel}>Available Days</Text>
                      <View style={styles.checkGrid}>
                        {(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const).map((d) => (
                          <Pressable
                            key={d}
                            onPress={() => setForm((s) => ({ ...s, availableDays: toggleInList(s.availableDays, d, !s.availableDays.includes(d)) }))}
                            style={({ pressed }) => [styles.checkItem, pressed && styles.pressed]}
                          >
                            <Checkbox status={form.availableDays.includes(d) ? 'checked' : 'unchecked'} />
                            <Text>{d}</Text>
                          </Pressable>
                        ))}
                      </View>

                      <Text variant="labelLarge" style={styles.groupLabel}>Delivery Time Slot</Text>
                      <View style={styles.checkGrid}>
                        {(['Morning', 'Afternoon', 'Evening'] as const).map((slt) => (
                          <Pressable
                            key={slt}
                            onPress={() => setForm((s) => ({ ...s, deliveryTimeSlots: toggleInList(s.deliveryTimeSlots, slt, !s.deliveryTimeSlots.includes(slt)) }))}
                            style={({ pressed }) => [styles.checkItem, pressed && styles.pressed]}
                          >
                            <Checkbox status={form.deliveryTimeSlots.includes(slt) ? 'checked' : 'unchecked'} />
                            <Text>{slt}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  </List.Accordion>

                  <List.Accordion title="Customer Visibility & Status" left={(p) => <List.Icon {...p} icon="eye-outline" />}>
                    <View style={styles.sectionBody}>
                      <Text variant="labelLarge" style={styles.groupLabel}>Visibility for Customer</Text>
                      <View style={styles.checkGrid}>
                        <Pressable onPress={() => setForm((s) => ({ ...s, isVisibleToCustomer: true }))} style={({ pressed }) => [styles.checkItem, pressed && styles.pressed]}>
                          <Checkbox status={form.isVisibleToCustomer ? 'checked' : 'unchecked'} />
                          <Text>Show product in customer app</Text>
                        </Pressable>
                        <Pressable onPress={() => setForm((s) => ({ ...s, isVisibleToCustomer: false }))} style={({ pressed }) => [styles.checkItem, pressed && styles.pressed]}>
                          <Checkbox status={!form.isVisibleToCustomer ? 'checked' : 'unchecked'} />
                          <Text>Hide product from customer app</Text>
                        </Pressable>
                      </View>

                      <Text variant="labelLarge" style={styles.groupLabel}>Product Features</Text>
                      <View style={styles.checkGrid}>
                        {(
                          [
                            'Fresh Product',
                            'Organic',
                            'Best Seller',
                            'Subscription Available',
                            'Home Delivery Available',
                            'Returnable Bottle',
                            'Refrigeration Required',
                          ] as const
                        ).map((f) => (
                          <Pressable
                            key={f}
                            onPress={() => setForm((s) => ({ ...s, features: toggleInList(s.features, f, !s.features.includes(f)) }))}
                            style={({ pressed }) => [styles.checkItem, pressed && styles.pressed]}
                          >
                            <Checkbox status={form.features.includes(f) ? 'checked' : 'unchecked'} />
                            <Text>{f}</Text>
                          </Pressable>
                        ))}
                      </View>

                      <View style={styles.toggleRow}>
                        <Text variant="labelLarge">Status</Text>
                        <Switch value={form.isActive} onValueChange={(v) => setForm((s) => ({ ...s, isActive: v }))} />
                      </View>
                    </View>
                  </List.Accordion>
                </List.Section>

                <HelperText type="error" visible={!!(formTouched && !parsedForm.success)}>
                  {formTouched && !parsedForm.success ? parsedForm.error.issues[0]?.message : ' '}
                </HelperText>
                <HelperText type="error" visible={!!formError}>
                  {formError ?? ' '}
                </HelperText>
              </ScrollView>
            </Dialog.ScrollArea>
            <Dialog.Actions>
              <Button
                onPress={() => {
                  setForm(emptyForm());
                  setFormTouched(false);
                  setFormError(null);
                }}
                disabled={createProduct.isPending || updateProduct.isPending}
              >
                Reset Form
              </Button>
              <Button onPress={closeForm} disabled={createProduct.isPending || updateProduct.isPending}>Cancel</Button>
              <Button onPress={onSave} loading={createProduct.isPending || updateProduct.isPending}>
                Save
              </Button>
            </Dialog.Actions>
          </Animated.View>
        </Dialog>
      </Portal>

      <Portal>
        <Dialog visible={categoryPickerOpen} onDismiss={() => setCategoryPickerOpen(false)} style={scheme === 'dark' ? styles.dialogDark : styles.dialogLight}>
          <Dialog.Title>Select category</Dialog.Title>
          <Dialog.Content>
            <TextInput mode="outlined" placeholder="Search category" value={categoryPickerQuery} onChangeText={setCategoryPickerQuery} left={<TextInput.Icon icon="magnify" />} />
            <View style={styles.pickerList}>
              {categories
                .filter((c) => c !== 'All')
                .filter((c) => c.toLowerCase().includes(categoryPickerQuery.trim().toLowerCase()))
                .map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => {
                      setForm((s) => ({ ...s, category: c }));
                      setCategoryPickerOpen(false);
                    }}
                    style={({ pressed }) => [styles.pickerItem, pressed && styles.pressed]}
                  >
                    <Text variant="bodyMedium">{c}</Text>
                    {form.category === c ? <MaterialCommunityIcons name="check" size={18} color={COLORS.accent} /> : null}
                  </Pressable>
                ))}
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setCategoryPickerOpen(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Portal>
        <Dialog visible={taxPickerOpen} onDismiss={() => setTaxPickerOpen(false)} style={scheme === 'dark' ? styles.dialogDark : styles.dialogLight}>
          <Dialog.Title>Select tax percentage</Dialog.Title>
          <Dialog.Content>
            {(['0%', '5%', '12%', '18%'] as const).map((t) => (
              <Pressable
                key={t}
                onPress={() => {
                  setForm((s) => ({ ...s, taxPercentage: t }));
                  setTaxPickerOpen(false);
                }}
                style={({ pressed }) => [styles.pickerItem, pressed && styles.pressed]}
              >
                <Text variant="bodyMedium">{t}</Text>
                {form.taxPercentage === t ? <MaterialCommunityIcons name="check" size={18} color={COLORS.accent} /> : null}
              </Pressable>
            ))}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setTaxPickerOpen(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },

  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  headerLeft: { flex: 1, minWidth: 260 },
  hTitle: { fontWeight: '900' },
  hSub: { marginTop: 4 },

  addBtnGradient: { borderRadius: 16 },
  addBtn: { borderRadius: 16 },
  addBtnContent: { height: 44, paddingHorizontal: 8 },

  controlsRow: { flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  search: { flex: 1, minWidth: 240 },
  chip: { height: 56, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },

  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  summaryCard: { width: '48%', borderRadius: 20, padding: 14 },
  summaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryIconWrap: { width: 36, height: 36, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
  summaryValue: { color: 'white', fontWeight: '900' },
  summaryLabel: { color: 'rgba(255,255,255,0.90)', marginTop: 10 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  productCard: { borderRadius: 20, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 10 } },
  productContent: { gap: 10 },

  productTop: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  productImageWrap: { width: 62, height: 62, borderRadius: 18, overflow: 'hidden' },
  productImage: { width: '100%', height: '100%' },
  productImagePlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  imagePhLight: { backgroundColor: 'rgba(96,165,250,0.14)' },
  imagePhDark: { backgroundColor: 'rgba(255,255,255,0.08)' },

  productMeta: { flex: 1, gap: 3 },
  productName: { fontWeight: '900' },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, marginTop: 6 },

  productDesc: { minHeight: 34 },

  detailRow: { flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  detailItem: { flex: 1 },
  strike: { textDecorationLine: 'line-through' },
  lowStockText: { color: '#B45309' },
  lowStockHint: { color: '#B45309', marginTop: 2 },

  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  iconAction: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(148,163,184,0.12)' },
  flex: { flex: 1 },

  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },

  sectionCardLight: { backgroundColor: 'white', borderColor: 'rgba(37,99,235,0.10)' },
  sectionCardDark: { backgroundColor: 'rgba(15,23,42,0.70)', borderColor: 'rgba(255,255,255,0.10)' },
  textOnLight: { color: COLORS.text },
  textOnDark: { color: 'rgba(255,255,255,0.96)' },
  subtleOnLight: { color: 'rgba(30,41,59,0.70)' },
  subtleOnDark: { color: 'rgba(255,255,255,0.78)' },

  fab: { position: 'absolute', right: 16, bottom: 16 },
  fabBg: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 12 } },

  dialogLight: { backgroundColor: 'white' },
  dialogDark: { backgroundColor: '#0F172A' },
  dialogHint: { marginTop: 6, opacity: 0.7 },

  formDialog: { maxHeight: '92%' },
  dialogTitleRow: { paddingHorizontal: 24, paddingTop: 18, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  dialogTitleText: { fontWeight: '900' },
  closeBtn: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(148,163,184,0.12)' },

  formBody: { paddingHorizontal: 2, paddingBottom: 18, gap: 10 },
  formRow: { flexDirection: 'row', gap: 10 },
  formHalf: { flex: 1 },
  responsiveRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  flex1: { flex: 1, minWidth: 220 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  previewRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  previewBox: { width: 78, height: 78, borderRadius: 18, overflow: 'hidden' },
  previewImage: { width: '100%', height: '100%' },
  previewPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  previewInputs: { flex: 1 },

  sectionBody: { gap: 10, paddingBottom: 6 },
  groupLabel: { marginTop: 6 },
  radioWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  radioItem: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 160 },
  checkGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: 4, width: '50%', paddingVertical: 4 },
  pickerField: { borderRadius: 16, borderWidth: 1, borderColor: 'rgba(37,99,235,0.16)', backgroundColor: 'rgba(96,165,250,0.10)', paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerLabel: { opacity: 0.75 },
  pickerList: { marginTop: 10, gap: 6 },
  pickerItem: { paddingVertical: 10, paddingHorizontal: 10, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(148,163,184,0.12)' },
});

