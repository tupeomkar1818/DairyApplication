import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppSnackbar } from '@/src/components/shared/AppSnackbar';
import { DairyTactileScreenBackground } from '@/src/components/shared/DairyTactileScreenBackground';
import type { CounterSale } from '@/src/domain/counter/entities';
import { useCounterSales } from '@/src/hooks/counter';
import { useStrings } from '@/src/i18n/useStrings';
import { billPrinter, type PrinterDevice } from '@/src/infrastructure/printing/billPrinter';
import { printBill } from '@/src/infrastructure/printing/printBill';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';

/**
 * The desk's own day: every bill they rang up, and the printer.
 *
 * Here because two things go wrong at a counter — a bill that did not come out, and a printer that has wandered
 * off — and both are fixed from the same place.
 */
export default function DeskSalesScreen() {
  const t = useStrings('counter');
  const c = useStrings('common');
  const sales = useCounterSales();

  const [printer, setPrinter] = useState<PrinterDevice | null>(billPrinter.connected());
  const [devices, setDevices] = useState<PrinterDevice[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });

  const say = useCallback((message: string) => setToast({ visible: true, message }), []);
  const hide = useCallback(() => setToast((s) => ({ ...s, visible: false })), []);
  const supported = billPrinter.isSupported();

  useEffect(() => {
    setPrinter(billPrinter.connected());
  }, []);

  async function findPrinters() {
    if (!supported) {
      say(t.printer.needsBuild);
      return;
    }
    setScanning(true);
    try {
      const found = await billPrinter.list();
      setDevices(found);
      if (!found.length) say(t.printer.none);
    } catch {
      say(t.printer.permission);
    } finally {
      setScanning(false);
    }
  }

  async function connect(device: PrinterDevice) {
    try {
      await billPrinter.connect(device);
      setPrinter(device);
      setDevices(null);
      say(t.printer.connected(device.name));
    } catch {
      say(t.printer.none);
    }
  }

  async function reprint(sale: CounterSale) {
    const printed = await printBill(sale);
    say(printed.ok ? t.done.printed : printed.reason === 'no-printer' ? t.printer.notConnected : t.done.printFailed);
  }

  const items = sales.data?.items ?? [];

  return (
    <DairyTactileScreenBackground>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={c.actions.back} style={styles.backBtn}>
          <MaterialCommunityIcons name="chevron-left" size={26} color={amraleColors.text} />
        </Pressable>
        <Text style={styles.title}>{t.today.title}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.printer.title}</Text>
          <Text style={styles.cardSub}>{t.printer.subtitle}</Text>
          <Text style={styles.state}>{printer ? t.printer.connected(printer.name) : t.printer.notConnected}</Text>
          {!supported ? <Text style={styles.warn}>{t.printer.needsBuild}</Text> : null}

          <View style={styles.row}>
            <Pressable onPress={() => void findPrinters()} accessibilityRole="button" style={styles.btn} disabled={scanning}>
              {scanning ? (
                <ActivityIndicator color={amraleColors.blue} />
              ) : (
                <Text style={styles.btnText}>{printer ? t.printer.connect : t.printer.connect}</Text>
              )}
            </Pressable>
            {printer ? (
              <Pressable
                onPress={() => void billPrinter.disconnect().then(() => setPrinter(null))}
                accessibilityRole="button"
                style={styles.btn}
              >
                <Text style={styles.btnText}>{t.printer.disconnect}</Text>
              </Pressable>
            ) : null}
          </View>

          {devices?.map((d) => (
            <Pressable key={d.id} onPress={() => void connect(d)} accessibilityRole="button" style={styles.device}>
              <MaterialCommunityIcons name="printer" size={18} color={amraleColors.blue} />
              <Text style={styles.deviceName}>{d.name}</Text>
            </Pressable>
          ))}
        </View>

        {sales.isPending ? (
          <ActivityIndicator color={amraleColors.blue} style={{ paddingVertical: 24 }} />
        ) : !items.length ? (
          <Text style={styles.empty}>{t.today.none}</Text>
        ) : (
          items.map((sale) => (
            <View key={sale.id} style={styles.saleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.saleNo}>#{sale.saleNo}</Text>
                <Text style={styles.saleWhat} numberOfLines={1}>
                  {sale.lines.map((l) => `${l.quantity}× ${l.productName}`).join(', ')}
                </Text>
                {!sale.printedAt ? <Text style={styles.notPrinted}>{t.today.notPrinted}</Text> : null}
              </View>
              <Text style={styles.saleTotal}>₹{sale.total}</Text>
              <Pressable
                onPress={() => void reprint(sale)}
                accessibilityRole="button"
                accessibilityLabel={t.done.printAgain}
                style={styles.reprint}
              >
                <MaterialCommunityIcons name="printer-outline" size={20} color={amraleColors.blue} />
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>

      <AppSnackbar visible={toast.visible} message={toast.message} onDismiss={hide} duration={4000} />
    </DairyTactileScreenBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: amraleSpacing.md,
    paddingTop: amraleSpacing.lg,
    paddingBottom: amraleSpacing.sm,
  },
  backBtn: { padding: 4 },
  title: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 20, color: amraleColors.text },
  body: { padding: amraleSpacing.lg, gap: 12, paddingBottom: 48 },

  card: {
    borderRadius: amraleRadius.md,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
    backgroundColor: amraleColors.white,
    padding: 14,
    gap: 6,
  },
  cardTitle: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 15, color: amraleColors.text },
  cardSub: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, color: amraleColors.textMuted },
  state: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 13, color: amraleColors.blue, marginTop: 4 },
  warn: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, color: amraleColors.textMuted },
  row: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: amraleRadius.md,
    backgroundColor: amraleColors.inputBgLight,
  },
  btnText: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 13, color: amraleColors.blue },
  device: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  deviceName: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 14, color: amraleColors.text },

  empty: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 14, color: amraleColors.textMuted, paddingVertical: 16 },
  saleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: amraleColors.inputBorderLight,
  },
  saleNo: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 14, color: amraleColors.text },
  saleWhat: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, color: amraleColors.textMuted },
  notPrinted: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 11, color: amraleColors.error, marginTop: 2 },
  saleTotal: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 16, color: amraleColors.text },
  reprint: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: amraleColors.inputBgLight,
  },
});
