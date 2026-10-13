import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppSnackbar } from '@/src/components/shared/AppSnackbar';
import { DairyTactileScreenBackground } from '@/src/components/shared/DairyTactileScreenBackground';
import { addToCart, cartTotals, setCartQuantity, type CartLine, type PaidBy } from '@/src/domain/counter/entities';
import { useAuthSession } from '@/src/hooks/auth';
import { useCounterSales, usePlaceSale } from '@/src/hooks/counter';
import { useProducts } from '@/src/hooks/products';
import { useStrings } from '@/src/i18n/useStrings';
import { printBill } from '@/src/infrastructure/printing/printBill';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';

/**
 * The counter.
 *
 * One screen, used all day: the catalogue on the left of the eye, what they are buying under it, and the amount
 * at the bottom where a thumb reaches. Everything is one tap — somebody is standing there waiting.
 */

type Sellable = { productId: string; packId?: string; productName: string; packLabel: string; unitPrice: number };

export default function CounterScreen() {
  const t = useStrings('counter');
  const c = useStrings('common');
  const session = useAuthSession();
  const products = useProducts();
  const todaysSales = useCounterSales();
  const placeSale = usePlaceSale();

  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState('');
  const [paidBy, setPaidBy] = useState<PaidBy>('Cash');
  const [toast, setToast] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });

  const say = useCallback((message: string) => setToast({ visible: true, message }), []);
  const hide = useCallback(() => setToast((s) => ({ ...s, visible: false })), []);

  /** Every pack of every product the dairy sells, as one flat list of things with a price. */
  const sellables = useMemo<Sellable[]>(() => {
    const items = products.data?.items ?? [];
    const out: Sellable[] = [];
    for (const product of items) {
      if (product.isActive === false) continue;
      const packs = (product.packs ?? []).filter((p) => p.isActive !== false);
      if (packs.length) {
        for (const pack of packs) {
          out.push({
            productId: product.id,
            packId: pack.id,
            productName: product.name,
            packLabel: pack.label ?? '',
            unitPrice: Math.round(Number(pack.price ?? product.price ?? 0)),
          });
        }
      } else {
        out.push({ productId: product.id, productName: product.name, packLabel: '', unitPrice: Math.round(Number(product.price ?? 0)) });
      }
    }
    return out;
  }, [products.data]);

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return sellables;
    return sellables.filter((s) => `${s.productName} ${s.packLabel}`.toLowerCase().includes(needle));
  }, [search, sellables]);

  const totals = useMemo(() => cartTotals(cart, Number(discount) || 0), [cart, discount]);
  const busy = placeSale.isPending;

  async function place() {
    if (!cart.length) {
      say(t.errors.empty);
      return;
    }
    if (busy) return;
    try {
      const sale = await placeSale.mutateAsync({
        lines: cart,
        discount: totals.discount,
        paidBy,
        // The phone's own id for this sale, so a second tap cannot take the money twice.
        clientRef: `${session.data?.userId ?? 'desk'}-${Date.now()}`,
      });
      setCart([]);
      setDiscount('');
      // The sale is safe either way; printing is a separate thing that may or may not work.
      const printed = await printBill(sale);
      say(printed.ok ? t.done.printed : t.done.printFailed);
    } catch (e) {
      say(e instanceof Error ? e.message : t.errors.failed);
    }
  }

  return (
    <DairyTactileScreenBackground>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t.title}</Text>
          <Text style={styles.subtitle}>{t.subtitle}</Text>
        </View>
        <Pressable
          onPress={() => router.push('/(desk)/sales')}
          accessibilityRole="button"
          accessibilityLabel={t.today.title}
          style={styles.headerBtn}
        >
          <MaterialCommunityIcons name="receipt-text-outline" size={22} color={amraleColors.blue} />
          <Text style={styles.headerBtnText}>{t.today.sales(todaysSales.data?.items.length ?? 0)}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.searchRow}>
          <MaterialCommunityIcons name="magnify" size={20} color={amraleColors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t.search}
            placeholderTextColor={amraleColors.textSubtle}
            style={styles.searchInput}
            accessibilityLabel={t.search}
          />
        </View>

        {products.isPending ? (
          <ActivityIndicator color={amraleColors.blue} style={styles.pad} />
        ) : !sellables.length ? (
          <Text style={styles.empty}>{t.noProducts}</Text>
        ) : !shown.length ? (
          <Text style={styles.empty}>{t.noMatches}</Text>
        ) : (
          <View style={styles.grid}>
            {shown.map((item) => (
              <Pressable
                key={`${item.productId}:${item.packId ?? ''}`}
                onPress={() => setCart((cur) => addToCart(cur, { ...item, quantity: 1 }))}
                accessibilityRole="button"
                accessibilityLabel={`${item.productName} ${item.packLabel} ₹${item.unitPrice}`}
                style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
              >
                <Text style={styles.tileName} numberOfLines={2}>
                  {item.productName}
                </Text>
                {item.packLabel ? <Text style={styles.tilePack}>{item.packLabel}</Text> : null}
                <Text style={styles.tilePrice}>₹{item.unitPrice}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>{t.cart.title}</Text>
        {!cart.length ? (
          <View style={styles.cartEmpty}>
            <Text style={styles.empty}>{t.cart.empty}</Text>
            <Text style={styles.emptyHint}>{t.cart.emptyHint}</Text>
          </View>
        ) : (
          cart.map((line, i) => (
            <View key={`${line.productName}:${line.packLabel}:${line.unitPrice}`} style={styles.cartRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cartName} numberOfLines={1}>
                  {line.productName} {line.packLabel}
                </Text>
                <Text style={styles.cartEach}>₹{line.unitPrice}</Text>
              </View>
              <Pressable
                onPress={() => setCart((cur) => setCartQuantity(cur, i, line.quantity - 1))}
                accessibilityRole="button"
                accessibilityLabel={t.cart.fewer}
                style={styles.stepBtn}
              >
                <MaterialCommunityIcons name="minus" size={18} color={amraleColors.blue} />
              </Pressable>
              <Text style={styles.qty}>{line.quantity}</Text>
              <Pressable
                onPress={() => setCart((cur) => setCartQuantity(cur, i, line.quantity + 1))}
                accessibilityRole="button"
                accessibilityLabel={t.cart.more}
                style={styles.stepBtn}
              >
                <MaterialCommunityIcons name="plus" size={18} color={amraleColors.blue} />
              </Pressable>
              <Text style={styles.lineTotal}>₹{line.quantity * line.unitPrice}</Text>
            </View>
          ))
        )}

        {cart.length ? (
          <>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>{t.totals.discount}</Text>
              <TextInput
                value={discount}
                onChangeText={(v) => setDiscount(v.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                inputMode="numeric"
                placeholder={t.totals.discountPlaceholder}
                placeholderTextColor={amraleColors.textSubtle}
                style={styles.discountInput}
                accessibilityLabel={t.totals.discount}
              />
            </View>

            <Text style={styles.sectionTitle}>{t.payment.title}</Text>
            <View style={styles.payRow}>
              {(['Cash', 'UPI'] as const).map((way) => (
                <Pressable
                  key={way}
                  onPress={() => setPaidBy(way)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: paidBy === way }}
                  accessibilityLabel={way === 'Cash' ? t.payment.cash : t.payment.upi}
                  style={[styles.payBtn, paidBy === way && styles.payBtnOn]}
                >
                  <MaterialCommunityIcons
                    name={way === 'Cash' ? 'cash' : 'qrcode'}
                    size={20}
                    color={paidBy === way ? amraleColors.white : amraleColors.blue}
                  />
                  <Text style={[styles.payText, paidBy === way && styles.payTextOn]}>
                    {way === 'Cash' ? t.payment.cash : t.payment.upi}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>

      {cart.length ? (
        <View style={styles.footer}>
          <View style={{ flex: 1 }}>
            <Text style={styles.footerLabel}>
              {t.cart.items(cart.reduce((n, l) => n + l.quantity, 0))} · {t.totals.toPay}
            </Text>
            <Text style={styles.footerTotal}>₹{totals.total}</Text>
          </View>
          <Pressable
            onPress={() => void place()}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={t.place}
            accessibilityState={{ disabled: busy, busy }}
            style={({ pressed }) => [styles.placeBtn, pressed && !busy && styles.placePressed]}
          >
            {busy ? (
              <ActivityIndicator color={amraleColors.white} />
            ) : (
              <>
                <Text style={styles.placeText}>{t.place}</Text>
                <MaterialCommunityIcons name="printer-outline" size={20} color={amraleColors.white} />
              </>
            )}
          </Pressable>
        </View>
      ) : null}

      <AppSnackbar visible={toast.visible} message={toast.message} onDismiss={hide} duration={4000} />
      <Text style={styles.hiddenHelper} accessibilityElementsHidden>
        {c.appName}
      </Text>
    </DairyTactileScreenBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: amraleSpacing.lg,
    paddingTop: amraleSpacing.lg,
    paddingBottom: amraleSpacing.sm,
  },
  title: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 22, color: amraleColors.text },
  subtitle: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 13, color: amraleColors.textMuted },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: amraleRadius.md,
    backgroundColor: amraleColors.inputBgLight,
  },
  headerBtnText: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 12, color: amraleColors.blue },

  body: { padding: amraleSpacing.lg, paddingBottom: 140, gap: 12 },
  pad: { paddingVertical: 24 },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
    borderRadius: amraleRadius.md,
    backgroundColor: amraleColors.inputBgLight,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 15,
    color: amraleColors.text,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    flexGrow: 1,
    flexBasis: 140,
    minWidth: 0,
    borderRadius: amraleRadius.md,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
    backgroundColor: amraleColors.white,
    padding: 12,
    gap: 2,
  },
  tilePressed: { opacity: 0.7 },
  tileName: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 14, color: amraleColors.text },
  tilePack: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, color: amraleColors.textMuted },
  tilePrice: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 16, color: amraleColors.blue, marginTop: 4 },

  sectionTitle: {
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 15,
    color: amraleColors.text,
    marginTop: 8,
  },
  cartEmpty: { paddingVertical: 16, gap: 4 },
  empty: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 14, color: amraleColors.textMuted },
  emptyHint: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, color: amraleColors.textSubtle },

  cartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: amraleColors.inputBorderLight,
  },
  cartName: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 14, color: amraleColors.text },
  cartEach: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, color: amraleColors.textMuted },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: amraleColors.inputBgLight,
  },
  qty: { minWidth: 24, textAlign: 'center', fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 15, color: amraleColors.text },
  lineTotal: {
    minWidth: 62,
    textAlign: 'right',
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 15,
    color: amraleColors.text,
  },

  totalsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  totalsLabel: { flex: 1, fontFamily: amraleTypography.fontFamily.medium, fontSize: 14, color: amraleColors.textMuted },
  discountInput: {
    width: 110,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
    borderRadius: amraleRadius.md,
    backgroundColor: amraleColors.inputBgLight,
    paddingVertical: 10,
    paddingHorizontal: 12,
    textAlign: 'right',
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 15,
    color: amraleColors.text,
  },

  payRow: { flexDirection: 'row', gap: 10 },
  payBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: amraleRadius.md,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
    backgroundColor: amraleColors.white,
  },
  payBtnOn: { backgroundColor: amraleColors.blue, borderColor: amraleColors.blue },
  payText: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 15, color: amraleColors.blue },
  payTextOn: { color: amraleColors.white },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: amraleSpacing.lg,
    paddingTop: 12,
    paddingBottom: 22,
    backgroundColor: amraleColors.white,
    borderTopWidth: 1,
    borderTopColor: amraleColors.inputBorderLight,
  },
  footerLabel: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, color: amraleColors.textMuted },
  footerTotal: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 24, color: amraleColors.text },
  placeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: amraleRadius.md,
    backgroundColor: amraleColors.blue,
  },
  placePressed: { opacity: 0.85 },
  placeText: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 16, color: amraleColors.white },

  hiddenHelper: { height: 0, opacity: 0 },
});
