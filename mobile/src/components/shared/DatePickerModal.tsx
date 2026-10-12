import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { Button, Text } from 'react-native-paper';

import {
  parsePickerDate,
  PICKER_MIN_YEAR,
  pickerMaxYear,
  pickerStartMonth,
  pickerYears,
  toDdMmYyyy,
  toYmd,
} from '@/src/components/shared/datePickerDates';
import type { Lang } from '@/src/i18n/language';
import { strings } from '@/src/i18n/strings';
import { useLanguage, useStrings } from '@/src/i18n/useStrings';
import { amraleColors } from '@/src/theme/dairyTactile';

/** The calendar library names weekdays itself; give it the app's names for each language. */
function applyCalendarLocale(lang: Lang) {
  const names = strings('common', lang).dates;
  LocaleConfig.locales[lang] = {
    monthNames: names.monthsLong,
    monthNamesShort: names.monthsShort,
    dayNames: names.weekdaysLong,
    dayNamesShort: names.weekdaysShort,
    today: names.today,
  };
  LocaleConfig.defaultLocale = lang;
}

export type DatePickerModalProps = {
  visible: boolean;
  /** Current value (DD/MM/YYYY or YYYY-MM-DD): marked in the calendar, which opens on its month. */
  value?: string | null;
  /** Month to open on when the value is empty or invalid (default: this month), e.g. a typical birth year. */
  fallbackDate?: Date;
  /** How many years past this one the year list goes: 0 for a date of birth, 5 (default) for plan or joining dates. */
  yearsAhead?: number;
  title?: string;
  /** Called with DD/MM/YYYY; the picker closes itself. */
  onSelect: (ddmmyyyy: string) => void;
  onDismiss: () => void;
};

/**
 * The one date picker used by every date field (iOS, Android and web).
 *
 * It is drawn in JavaScript on purpose. The native `@react-native-community/datetimepicker` aborts the whole app on
 * iOS when a prop is outside its native enum (e.g. `display="calendar"`, which is Android-only) and behaves
 * differently per platform inside modals — a picker that renders the same everywhere cannot crash that way.
 *
 * It is a React Native Modal rather than a Paper Portal, so it also opens above a sheet it was opened from.
 */
export function DatePickerModal({
  visible,
  value,
  fallbackDate,
  yearsAhead = 5,
  title,
  onSelect,
  onDismiss,
}: DatePickerModalProps) {
  const { width, height } = useWindowDimensions();
  const lang = useLanguage();
  const t = useStrings('common');
  applyCalendarLocale(lang);
  const MONTHS = t.dates.monthsShort;
  const maxYear = pickerMaxYear(yearsAhead);
  const [step, setStep] = useState<'calendar' | 'year' | 'month'>('calendar');
  const [cursor, setCursor] = useState(() => pickerStartMonth(value, fallbackDate, PICKER_MIN_YEAR, maxYear));

  // Every opening starts on the calendar at the current value's month (not where the last opening left off).
  useEffect(() => {
    if (!visible) return;
    setStep('calendar');
    setCursor(pickerStartMonth(value, fallbackDate, PICKER_MIN_YEAR, maxYear));
    // Only on open: re-running when the parent re-renders would jump the calendar back while browsing months.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const selected = parsePickerDate(value);
  const selectedYmd = selected ? toYmd(selected) : null;
  const years = useMemo(() => pickerYears(PICKER_MIN_YEAR, maxYear), [maxYear]);

  const dialogWidth = Math.max(280, Math.min(width - 32, 400));
  const dialogMaxHeight = Math.max(320, height - 48);

  function pick(dateYmd: string) {
    const d = parsePickerDate(dateYmd);
    if (!d || d.getFullYear() > maxYear) return;
    onSelect(toDdMmYyyy(d));
    onDismiss();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss} statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} accessibilityLabel={t.datePicker.close} />
        <View style={[styles.dialog, { width: dialogWidth, maxHeight: dialogMaxHeight }]} accessibilityViewIsModal>
          <Text variant="titleLarge" style={styles.title}>
            {step === 'calendar' ? (title ?? t.datePicker.selectDate) : step === 'year' ? t.datePicker.selectYear : t.datePicker.selectMonth}
          </Text>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} bounces={false}>
            {step === 'calendar' ? (
              <Calendar
                // Re-drawn on a language change so the weekday row follows it.
                key={lang}
                current={toYmd(cursor)}
                // Only this month's days: a greyed "31" from the month before was easy to tap by mistake.
                hideExtraDays
                maxDate={`${maxYear}-12-31`}
                markedDates={selectedYmd ? { [selectedYmd]: { selected: true, selectedColor: amraleColors.blue } } : undefined}
                renderHeader={() => (
                  <Pressable
                    onPress={() => setStep('year')}
                    style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={t.datePicker.chooseMonthYear}
                  >
                    <Text variant="titleSmall">{`${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`}</Text>
                    <MaterialCommunityIcons name="chevron-down" size={18} color={amraleColors.text} />
                  </Pressable>
                )}
                onMonthChange={(m) => {
                  const next = new Date(m.year, m.month - 1, 1);
                  if (!Number.isNaN(next.getTime())) setCursor(next);
                }}
                onDayPress={(day) => pick(day.dateString)}
                theme={{
                  todayTextColor: amraleColors.blue,
                  selectedDayBackgroundColor: amraleColors.blue,
                  arrowColor: amraleColors.blue,
                }}
              />
            ) : null}

            {step === 'year' ? (
              <View>
                {years.map((y) => {
                  const isCurrent = cursor.getFullYear() === y;
                  return (
                    <Pressable
                      key={y}
                      onPress={() => {
                        setCursor((d) => new Date(y, d.getMonth(), 1));
                        setStep('month');
                      }}
                      style={({ pressed }) => [styles.yearItem, isCurrent && styles.itemActive, pressed && styles.pressed]}
                    >
                      <Text variant="bodyLarge" style={isCurrent ? styles.activeText : undefined}>
                        {String(y)}
                      </Text>
                      {isCurrent ? <MaterialCommunityIcons name="check" size={18} color={amraleColors.blue} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {step === 'month' ? (
              <View style={styles.monthGrid}>
                {MONTHS.map((label, mi) => {
                  const isCurrent = cursor.getMonth() === mi;
                  return (
                    <Pressable
                      key={label}
                      onPress={() => {
                        setCursor((d) => new Date(d.getFullYear(), mi, 1));
                        setStep('calendar');
                      }}
                      style={({ pressed }) => [styles.monthCell, isCurrent && styles.itemActive, pressed && styles.pressed]}
                    >
                      <Text variant="labelLarge" style={isCurrent ? styles.activeText : undefined}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.actions}>
            {step !== 'calendar' ? (
              <Button onPress={() => setStep(step === 'month' ? 'year' : 'calendar')}>{t.actions.back}</Button>
            ) : null}
            <Button onPress={onDismiss}>{t.actions.close}</Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(11, 29, 45, 0.45)',
  },
  dialog: {
    overflow: 'hidden',
    borderRadius: 24,
    backgroundColor: amraleColors.white,
    paddingTop: 20,
    paddingBottom: 8,
  },
  title: { paddingHorizontal: 20, marginBottom: 8, color: amraleColors.text },
  body: { flexGrow: 0, flexShrink: 1 },
  bodyContent: { paddingHorizontal: 12 },
  headerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 8 },
  yearItem: {
    minHeight: 44,
    paddingHorizontal: 14,
    marginHorizontal: 8,
    marginBottom: 6,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
  },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, paddingVertical: 6 },
  monthCell: {
    width: '29%',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.22)',
    backgroundColor: 'rgba(148, 163, 184, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemActive: { borderColor: 'rgba(53, 81, 161, 0.35)', backgroundColor: 'rgba(53, 81, 161, 0.12)' },
  activeText: { color: amraleColors.blue, fontWeight: '700' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 8, paddingTop: 4 },
  pressed: { opacity: 0.8 },
});
