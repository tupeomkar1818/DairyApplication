import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, useColorScheme, View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';

import { useScreenSafeInsets } from '@/src/hooks/useScreenSafeInsets';

const COLORS = {
  primary: '#2563EB',
  bg: '#F8FAFC',
  text: '#1E293B',
  green: '#16A34A',
  red: '#DC2626',
};

function buildGatewayUrl(base: string, params: Record<string, string>) {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return base.includes('?') ? `${base}&${qs}` : `${base}?${qs}`;
}

export default function AdminSalaryPay() {
  const scheme = useColorScheme();
  const { headerPaddingTop } = useScreenSafeInsets();
  const params = useLocalSearchParams<{ deliveryBoyId?: string; amount?: string; month?: string }>();
  const [opening, setOpening] = useState(false);

  const deliveryBoyId = params.deliveryBoyId ?? '';
  const amount = Number(params.amount ?? '0') || 0;
  const month = params.month ?? '';

  const gatewayBaseUrl = (process.env.EXPO_PUBLIC_PAYMENT_GATEWAY_URL ?? '').trim();

  const gatewayUrl = useMemo(() => {
    if (!gatewayBaseUrl) return '';
    return buildGatewayUrl(gatewayBaseUrl, {
      kind: 'delivery-salary',
      deliveryBoyId,
      month,
      amount: String(Math.round(amount)),
    });
  }, [amount, deliveryBoyId, gatewayBaseUrl, month]);

  const card = scheme === 'dark' ? styles.cardDark : styles.cardLight;
  const textMain = scheme === 'dark' ? styles.textOnDark : styles.textOnLight;
  const textSub = scheme === 'dark' ? styles.subtleOnDark : styles.subtleOnLight;

  async function openGateway() {
    if (!gatewayUrl) return;
    setOpening(true);
    try {
      await WebBrowser.openBrowserAsync(gatewayUrl);
    } finally {
      setOpening(false);
    }
  }

  return (
    <View style={[styles.bg, scheme === 'dark' ? styles.bgDark : styles.bgLight]}>
      <View style={[styles.appBar, { paddingTop: headerPaddingTop }]}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
          <Text style={[styles.backText, textMain]}>Back</Text>
        </Pressable>
        <Text variant="titleMedium" style={[styles.title, textMain]} numberOfLines={1}>
          Salary Payment
        </Text>
      </View>

      <View style={styles.container}>
        <Card style={[styles.sectionCard, card]} mode="elevated">
          <Card.Content style={{ gap: 10 }}>
            <View style={styles.row}>
              <View style={[styles.kv, styles.kvLeft]}>
                <Text variant="bodySmall" style={textSub}>
                  Salary Month
                </Text>
                <Text variant="titleSmall" style={[styles.bold, textMain]} numberOfLines={1}>
                  {month || '—'}
                </Text>
              </View>
              <View style={[styles.kv, styles.kvRight]}>
                <Text variant="bodySmall" style={textSub}>
                  Amount
                </Text>
                <Text variant="titleSmall" style={[styles.bold, textMain]} numberOfLines={1}>
                  ₹{Math.round(amount)}
                </Text>
              </View>
            </View>

            {!gatewayBaseUrl ? (
              <View style={[styles.helperBox, styles.helperBoxRed]}>
                <Text variant="bodySmall" style={[styles.helperText, { color: 'white' }]}>
                  Payment gateway is not configured. Set `EXPO_PUBLIC_PAYMENT_GATEWAY_URL` in your `.env`.
                </Text>
              </View>
            ) : (
              <View style={[styles.helperBox, styles.helperBoxBlue]}>
                <Text variant="bodySmall" style={[styles.helperText, { color: 'white' }]}>
                  You’ll be redirected to the payment gateway to complete the salary payment.
                </Text>
              </View>
            )}

            <View style={styles.actions}>
              <Button mode="outlined" onPress={() => router.back()} disabled={opening}>
                Cancel
              </Button>
              <Button
                mode="contained"
                buttonColor={COLORS.primary}
                onPress={openGateway}
                disabled={!gatewayUrl || opening}
                loading={opening}
              >
                Pay Now
              </Button>
            </View>
          </Card.Content>
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  bgLight: { backgroundColor: COLORS.bg },
  bgDark: { backgroundColor: '#0B1220' },
  container: { padding: 16 },

  appBar: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: { height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  backText: { fontWeight: '900' },
  title: { flex: 1, minWidth: 0, fontWeight: '900', textAlign: 'left' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },

  sectionCard: { borderRadius: 16, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 8 } },
  cardLight: { backgroundColor: 'white', borderColor: 'rgba(37,99,235,0.10)' },
  cardDark: { backgroundColor: 'rgba(15,23,42,0.70)', borderColor: 'rgba(255,255,255,0.10)' },

  textOnLight: { color: COLORS.text },
  textOnDark: { color: 'rgba(255,255,255,0.96)' },
  subtleOnLight: { color: 'rgba(30,41,59,0.70)' },
  subtleOnDark: { color: 'rgba(255,255,255,0.78)' },
  bold: { fontWeight: '900' },

  row: { flexDirection: 'row', gap: 10 },
  kv: { flexGrow: 1, flexBasis: 0, minWidth: 0, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(148,163,184,0.18)', backgroundColor: 'rgba(148,163,184,0.06)' },
  kvLeft: {},
  kvRight: {},

  helperBox: { borderRadius: 14, padding: 10 },
  helperBoxBlue: { backgroundColor: 'rgba(37,99,235,0.88)' },
  helperBoxRed: { backgroundColor: 'rgba(220,38,38,0.88)' },
  helperText: { fontWeight: '800' },

  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
});

