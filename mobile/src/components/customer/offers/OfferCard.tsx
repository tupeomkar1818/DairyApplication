import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { CustomerCard, CustomerPrimaryButton, money } from '@/src/components/customer/customerUi';
import {
  comboPricing,
  offerHeadline,
  offerRuleLines,
  priceOfferRows,
  type PriceOfferRow,
} from '@/src/components/customer/offers/offerCards';
import type { Offer } from '@/src/domain/offers/entities';
import type { ProductResponse } from '@/src/domain/products/dtos';
import type { Lang } from '@/src/i18n/language';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleTypography } from '@/src/theme/dairyTactile';

const PINK = { fg: '#a3246b', bg: '#fbe3f0' };
const GREEN = { fg: '#16623a', bg: '#dcf3e5' };

/** One live offer on the customer's Offers screen: what it is, until when, and how to use it. */
export function OfferCard({
  offer,
  lang,
  products,
  canOrder,
  onOrderPack,
  onOrderCombo,
}: {
  offer: Offer;
  lang: Lang;
  products: readonly ProductResponse[];
  /** False when the account cannot order (inactive): the buttons are hidden, the offer still shows. */
  canOrder: boolean;
  onOrderPack: (row: PriceOfferRow & { product: ProductResponse; pack: NonNullable<PriceOfferRow['pack']> }) => void;
  onOrderCombo: () => void;
}) {
  const t = useStrings('offerCustomer').card;
  const o = useStrings('offers');
  const head = offerHeadline(offer, lang);

  return (
    <CustomerCard style={styles.card}>
      {offer.imageUri ? <Poster uri={offer.imageUri} label={t.posterA11y(head.title)} /> : null}

      <View style={styles.tags}>
        <Text style={[styles.tag, { color: PINK.fg, backgroundColor: PINK.bg }]}>{head.kindName}</Text>
        {head.code ? (
          <View style={styles.codeTag}>
            <MaterialCommunityIcons name="ticket-percent-outline" size={13} color={amraleColors.blue} />
            <Text style={styles.codeTagText}>{o.code(head.code)}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.title}>{head.title}</Text>
      {head.description ? <Text style={styles.description}>{head.description}</Text> : null}
      <View style={styles.validity}>
        <MaterialCommunityIcons name="calendar-clock" size={15} color={amraleColors.textMuted} />
        <Text style={styles.validityText}>{head.validity}</Text>
      </View>

      {offer.kind === 'price' ? (
        <View style={styles.section}>
          {priceOfferRows(offer, products).map((row) => (
            <View key={row.item.packId} style={styles.packRow}>
              <View style={styles.packText}>
                <Text style={styles.packName}>{`${row.item.productName} · ${row.item.packLabel}`}</Text>
                <View style={styles.priceLine}>
                  <Text style={styles.struck}>{money(row.item.listPrice)}</Text>
                  <Text style={styles.price}>{money(row.item.offerPrice)}</Text>
                  {row.save > 0 ? <Text style={[styles.tag, styles.saveTag]}>{o.save(money(row.save))}</Text> : null}
                </View>
              </View>
              {!canOrder ? null : row.product && row.pack ? (
                <Pressable
                  onPress={() => onOrderPack({ ...row, product: row.product!, pack: row.pack! })}
                  style={({ pressed }) => [styles.orderBtn, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={t.orderA11y(`${row.item.productName} · ${row.item.packLabel}`)}
                >
                  <MaterialCommunityIcons name="basket-plus-outline" size={16} color={amraleColors.white} />
                  <Text style={styles.orderBtnText}>{t.order}</Text>
                </Pressable>
              ) : (
                <Text style={styles.gone}>{t.packGone}</Text>
              )}
            </View>
          ))}
          {offer.includeRegular ? (
            <View style={styles.ruleRow}>
              <MaterialCommunityIcons name="calendar-sync-outline" size={16} color={GREEN.fg} />
              <Text style={styles.ruleText}>{o.regularToo}</Text>
            </View>
          ) : null}
        </View>
      ) : offer.kind === 'combo' ? (
        <ComboSection offer={offer} canOrder={canOrder} onOrder={onOrderCombo} />
      ) : (
        <View style={styles.section}>
          {offerRuleLines(offer, lang).map((line) => (
            <View key={line} style={styles.ruleRow}>
              <MaterialCommunityIcons name="check-circle-outline" size={16} color={GREEN.fg} />
              <Text style={styles.ruleText}>{line}</Text>
            </View>
          ))}
          <Text style={styles.note}>{t.onBill}</Text>
        </View>
      )}
    </CustomerCard>
  );
}

function ComboSection({
  offer,
  canOrder,
  onOrder,
}: {
  offer: Offer;
  canOrder: boolean;
  onOrder: () => void;
}) {
  const t = useStrings('offerCustomer').card;
  const o = useStrings('offers');
  const pricing = comboPricing(offer);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{o.combo.contains}</Text>
      {(offer.comboItems ?? []).map((i) => (
        <View key={i.packId} style={styles.ruleRow}>
          <View style={styles.bullet} />
          <Text style={styles.ruleText}>
            {`${i.productName} · ${i.packLabel}${i.quantity > 1 ? ` × ${i.quantity}` : ''}`}
          </Text>
        </View>
      ))}
      <View style={styles.priceLine}>
        {pricing.save > 0 ? <Text style={styles.struck}>{o.combo.worth(money(pricing.worth))}</Text> : null}
        <Text style={styles.comboPrice}>{money(pricing.price)}</Text>
        {pricing.save > 0 ? <Text style={[styles.tag, styles.saveTag]}>{o.save(money(pricing.save))}</Text> : null}
      </View>
      {canOrder ? (
        <CustomerPrimaryButton label={t.orderCombo} icon="basket-plus-outline" onPress={onOrder} style={styles.comboBtn} />
      ) : null}
    </View>
  );
}

function Poster({ uri, label }: { uri: string; label: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <Image
      source={{ uri }}
      style={styles.poster}
      resizeMode="cover"
      onError={() => setFailed(true)}
      accessible
      accessibilityLabel={label}
    />
  );
}

const styles = StyleSheet.create({
  card: { gap: 8 },
  poster: { width: '100%', aspectRatio: 16 / 9, borderRadius: amraleRadius.md, backgroundColor: amraleColors.inputBgLight },
  tags: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  tag: {
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: amraleRadius.pill,
    overflow: 'hidden',
  },
  codeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: amraleRadius.pill,
    backgroundColor: '#e3efff',
  },
  codeTagText: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 12, color: amraleColors.blue },
  title: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 17, lineHeight: 23, color: amraleColors.text },
  description: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 14, lineHeight: 20, color: amraleColors.textMuted },
  validity: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  validityText: { flexShrink: 1, fontFamily: amraleTypography.fontFamily.medium, fontSize: 13, color: amraleColors.textMuted },

  section: { gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: amraleColors.inputBorderLight },
  sectionLabel: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 13, color: amraleColors.textMuted },
  packRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  packText: { flex: 1, minWidth: 0, gap: 2 },
  packName: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 14, color: amraleColors.text },
  priceLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  struck: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 13,
    color: amraleColors.textSubtle,
    textDecorationLine: 'line-through',
  },
  price: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 15, color: amraleColors.text },
  comboPrice: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 18, color: amraleColors.text },
  saveTag: { color: GREEN.fg, backgroundColor: GREEN.bg },
  orderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: amraleRadius.pill,
    backgroundColor: amraleColors.blue,
  },
  orderBtnText: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 13, color: amraleColors.white },
  gone: { maxWidth: 110, fontFamily: amraleTypography.fontFamily.medium, fontSize: 12, color: amraleColors.textSubtle, textAlign: 'right' },
  ruleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  ruleText: { flex: 1, minWidth: 0, fontFamily: amraleTypography.fontFamily.regular, fontSize: 14, lineHeight: 20, color: amraleColors.text },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 7, backgroundColor: PINK.fg },
  note: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, lineHeight: 17, color: amraleColors.textSubtle },
  comboBtn: { marginTop: 4 },
  pressed: { opacity: 0.88 },
});
