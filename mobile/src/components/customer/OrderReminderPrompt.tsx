import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import type { CustomerResponse } from '@/src/domain/customers/dtos';
import { orderCutoffLabel } from '@/src/domain/customers/daySchedule';
import {
  buildOrderReminder,
  ORDER_REMINDER_HOUR,
  orderReminderDay,
} from '@/src/domain/notifications/orderReminders';
import { useStrings } from '@/src/i18n/useStrings';
import { useOrderReminderAnswer } from '@/src/hooks/customer/useOrderReminderAnswer';
import {
  deviceRemindersSupported,
  getDeviceReminderPermission,
  requestDeviceReminderPermission,
} from '@/src/infrastructure/deviceReminders';
import type { DeviceReminderPermission } from '@/src/infrastructure/deviceReminders.types';
import { amraleColors, amraleRadius, amraleTypography } from '@/src/theme/dairyTactile';
import { formatDateTime, formatTime } from '@/src/utils/format';

/**
 * On the customer dashboard, from 6 pm IST until the 9 pm cut-off: "Is tomorrow's order OK?" with "Keep as it is"
 * and "Change order". The same answer as the notification's buttons; once given, it shows what was chosen.
 */
export function OrderReminderPrompt({ customer, tomorrowYmd, now }: { customer: CustomerResponse; tomorrowYmd: string; now: Date }) {
  const t = useStrings('customer').orderReminder;
  const answers = useOrderReminderAnswer(customer);
  const cutoff = orderCutoffLabel();
  if (orderReminderDay(now) !== tomorrowYmd || !buildOrderReminder(customer, tomorrowYmd)) return null;

  const reminder = answers.reminderFor(tomorrowYmd);
  const response = reminder?.response;

  const change = () => {
    void answers.respond(tomorrowYmd, 'change');
    router.push({ pathname: '/(customer)/my-days', params: { month: tomorrowYmd.slice(0, 7) } });
  };

  if (response === 'keep') {
    return (
      <View style={[styles.box, styles.boxDone]} accessibilityLiveRegion="polite">
        <MaterialCommunityIcons name="check-circle" size={22} color={GREEN} />
        <View style={styles.text}>
          <Text style={styles.title}>{t.keepingTitle}</Text>
          <Text style={styles.sub}>
            {reminder?.respondedAt ? t.confirmedAt(formatTime(reminder.respondedAt), cutoff) : t.confirmed(cutoff)}
          </Text>
        </View>
        <Pressable onPress={change} hitSlop={6} accessibilityRole="button" accessibilityLabel={t.changeA11y}>
          <Text style={styles.link}>{t.change}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.box}>
      <View style={styles.head}>
        <MaterialCommunityIcons name="bell-ring-outline" size={22} color={AMBER} />
        <View style={styles.text}>
          <Text style={styles.title}>{t.questionTitle}</Text>
          <Text style={styles.sub}>
            {response === 'change'
              ? reminder?.respondedAt
                ? t.choseChangeAt(formatDateTime(reminder.respondedAt), cutoff)
                : t.choseChange(cutoff)
              : t.ask(cutoff)}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable
          onPress={() => void answers.respond(tomorrowYmd, 'keep')}
          disabled={answers.saving}
          style={({ pressed }) => [styles.btn, styles.btnKeep, pressed && styles.pressed, answers.saving && styles.disabled]}
          accessibilityRole="button"
          accessibilityLabel={t.keepA11y}
        >
          {answers.saving ? (
            <ActivityIndicator size="small" color={amraleColors.white} />
          ) : (
            <MaterialCommunityIcons name="check" size={18} color={amraleColors.white} />
          )}
          <Text style={styles.btnKeepText} numberOfLines={1}>
            {t.keep}
          </Text>
        </Pressable>
        <Pressable
          onPress={change}
          style={({ pressed }) => [styles.btn, styles.btnChange, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t.changeA11y}
        >
          <MaterialCommunityIcons name="pencil-outline" size={18} color={amraleColors.blue} />
          <Text style={styles.btnChangeText} numberOfLines={1}>
            {t.changeOrder}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * "Get tomorrow's order reminder at 6 pm" with a Turn on button, shown until this device has decided. Phones ask on
 * their own the first time; a browser needs the tap.
 */
export function ReminderPermissionCard() {
  const t = useStrings('customer').orderReminder;
  const c = useStrings('common');
  const [permission, setPermission] = useState<DeviceReminderPermission | null>(null);
  useEffect(() => {
    let alive = true;
    void getDeviceReminderPermission().then((p) => alive && setPermission(p));
    return () => {
      alive = false;
    };
  }, []);

  if (!deviceRemindersSupported() || permission === null || permission === 'granted' || permission === 'unsupported') return null;

  /** "6 pm" / "संध्याकाळी 6" — the reminder time (IST) in the app's language. */
  const reminderTime = c.dates.time(String(ORDER_REMINDER_HOUR % 12 || 12), ORDER_REMINDER_HOUR);

  return (
    <View style={[styles.box, styles.boxInfo]}>
      <View style={styles.head}>
        <MaterialCommunityIcons name={permission === 'denied' ? 'bell-off-outline' : 'bell-plus-outline'} size={22} color={amraleColors.blue} />
        <View style={styles.text}>
          <Text style={styles.title}>{t.permissionTitle(reminderTime)}</Text>
          <Text style={styles.sub}>
            {permission === 'denied'
              ? Platform.OS === 'web'
                ? t.blockedWeb(reminderTime)
                : t.blockedApp(reminderTime)
              : t.everyDay(reminderTime)}
          </Text>
        </View>
      </View>
      {permission === 'undetermined' ? (
        <Pressable
          onPress={() => void requestDeviceReminderPermission().then(setPermission)}
          style={({ pressed }) => [styles.btn, styles.btnInfo, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t.turnOnA11y}
        >
          <MaterialCommunityIcons name="bell-ring-outline" size={18} color={amraleColors.white} />
          <Text style={styles.btnKeepText}>{t.turnOn}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const AMBER = '#8a5300';
const GREEN = '#15803D';

const styles = StyleSheet.create({
  box: {
    gap: 12,
    padding: 14,
    borderRadius: amraleRadius.lg,
    backgroundColor: '#fff4e0',
    borderWidth: 1,
    borderColor: '#f6d9a6',
  },
  boxDone: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(22, 163, 74, 0.08)', borderColor: 'rgba(22, 163, 74, 0.25)' },
  boxInfo: { backgroundColor: '#e3efff', borderColor: '#c4dbff' },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  text: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 15, color: amraleColors.text },
  sub: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 13, lineHeight: 19, color: amraleColors.textMuted },
  link: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 14, color: amraleColors.blue },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: {
    flexGrow: 1,
    flexBasis: 120,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 8,
    borderRadius: amraleRadius.pill,
  },
  btnKeep: { backgroundColor: GREEN },
  btnKeepText: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 14, color: amraleColors.white },
  btnChange: { backgroundColor: amraleColors.white, borderWidth: 1, borderColor: amraleColors.blue },
  btnChangeText: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 14, color: amraleColors.blue },
  btnInfo: { flexGrow: 0, alignSelf: 'flex-start', paddingHorizontal: 18, backgroundColor: amraleColors.blue },
  pressed: { opacity: 0.88 },
  disabled: { opacity: 0.6 },
});
