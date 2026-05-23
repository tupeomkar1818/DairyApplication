import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { Button, Dialog, Portal, Text, TextInput } from 'react-native-paper';

export type DateInputValueFormat = 'DD/MM/YYYY';

/** Strips non-digits, caps at 8, inserts slashes as DD/MM/YYYY while typing. */
export function formatDdMmYyyyFromInput(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function dateToDdMmYyyy(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

function ddMmYyyyToDate(value: string): Date | null {
  const m = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy)) return null;
  const d = new Date(yyyy, mm - 1, dd);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
  return d;
}

function isoToDdMmYyyy(value: string): string | null {
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const yyyy = Number(m[1]);
  const mm = Number(m[2]);
  const dd = Number(m[3]);
  const d = new Date(yyyy, mm - 1, dd);
  if (Number.isNaN(d.getTime())) return null;
  return dateToDdMmYyyy(d);
}

function ddMmYyyyToIso(value: string): string | null {
  const d = ddMmYyyyToDate(value);
  if (!d) return null;
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function monthLabel(monthIndex0: number) {
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][monthIndex0] ?? '';
}

export function DateInput({
  label,
  value,
  onChange,
  placeholder = 'DD/MM/YYYY',
  maxIsoDate = '2100-12-31',
  dense,
  mode = 'outlined',
  outlineStyle,
  activeOutlineColor = '#2563EB',
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  maxIsoDate?: string;
  dense?: boolean;
  mode?: React.ComponentProps<typeof TextInput>['mode'];
  outlineStyle?: object;
  activeOutlineColor?: string;
}) {
  const { width, height } = useWindowDimensions();
  const isMobile = width < 520;
  const dialogMaxHeight = Math.min(Math.round(height * 0.86), Math.max(420, height - 16));
  const dialogW = Math.min(Math.round(width * 0.92), 520);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'calendar' | 'year' | 'month'>('calendar');

  const cursor = useMemo(() => {
    const v = (value ?? '').trim();
    const d = ddMmYyyyToDate(v) ?? (isoToDdMmYyyy(v) ? ddMmYyyyToDate(isoToDdMmYyyy(v) as string) : null);
    return d ?? new Date();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]); // recompute when opened so it picks up latest value

  const [cursorState, setCursorState] = useState<Date>(new Date());

  function openPicker() {
    setCursorState(cursor);
    setStep('calendar');
    setOpen(true);
  }

  const selectedIso = useMemo(() => ddMmYyyyToIso((value ?? '').trim()), [value]);

  return (
    <>
      <TextInput
        dense={dense}
        mode={mode}
        label={label}
        placeholder={placeholder}
        value={value}
        onChangeText={(t) => onChange(formatDdMmYyyyFromInput(t))}
        keyboardType="number-pad"
        outlineStyle={[{ borderRadius: 16 }, outlineStyle]}
        activeOutlineColor={activeOutlineColor}
        right={<TextInput.Icon icon="calendar" onPress={openPicker} forceTextInputFocus={false} />}
      />

      <Portal>
        {open && Platform.OS !== 'web' ? (
          <DateTimePicker
            value={cursorState}
            mode="date"
            display={Platform.OS === 'android' ? 'default' : 'calendar'}
            onChange={(_event, selected) => {
              setOpen(false);
              if (!selected) return;
              onChange(dateToDdMmYyyy(selected));
            }}
            maximumDate={(() => {
              const max = isoToDdMmYyyy(maxIsoDate);
              const d = max ? ddMmYyyyToDate(max) : null;
              return d ?? new Date(2100, 11, 31);
            })()}
          />
        ) : null}

        <Dialog
          visible={open && Platform.OS === 'web'}
          onDismiss={() => setOpen(false)}
          style={{ alignSelf: 'center', width: dialogW, maxWidth: dialogW, maxHeight: dialogMaxHeight, overflow: 'hidden' }}
        >
          <Dialog.Title>{step === 'calendar' ? 'Select Date' : step === 'year' ? 'Select Year' : 'Select Month'}</Dialog.Title>
          <Dialog.Content>
            {step === 'calendar' ? (
              <Calendar
                current={`${cursorState.getFullYear()}-${String(cursorState.getMonth() + 1).padStart(2, '0')}-01`}
                markedDates={selectedIso ? { [selectedIso]: { selected: true, selectedColor: '#2563EB' } } : undefined}
                renderHeader={() => (
                  <Pressable onPress={() => setStep('year')} style={({ pressed }) => [styles.webCalHeaderPress, pressed && styles.pressed]}>
                    <Text variant="titleSmall">
                      {monthLabel(cursorState.getMonth())} {cursorState.getFullYear()}
                    </Text>
                    <MaterialCommunityIcons name="chevron-down" size={18} />
                  </Pressable>
                )}
                onMonthChange={(m) => {
                  setCursorState(new Date(m.year, m.month - 1, 1));
                }}
                onDayPress={(day) => {
                  const dob = isoToDdMmYyyy(day.dateString);
                  if (!dob) return;
                  onChange(dob);
                  setOpen(false);
                }}
                theme={{
                  todayTextColor: '#2563EB',
                  selectedDayBackgroundColor: '#2563EB',
                  arrowColor: '#2563EB',
                }}
              />
            ) : null}

            {step === 'year' ? (
              <ScrollView style={{ maxHeight: Math.min(360, dialogMaxHeight - 140) }} contentContainerStyle={{ paddingVertical: 6 }}>
                {Array.from({ length: new Date().getFullYear() - 1950 + 1 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                  <Pressable
                    key={y}
                    onPress={() => {
                      setCursorState((d) => new Date(y, d.getMonth(), 1));
                      setStep('month');
                    }}
                    style={({ pressed }) => [styles.pickItem, pressed && styles.pressed]}
                  >
                    <Text variant="bodyMedium">{String(y)}</Text>
                    {cursorState.getFullYear() === y ? <MaterialCommunityIcons name="check" size={18} color="#22C55E" /> : null}
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}

            {step === 'month' ? (
              <View style={styles.monthGrid}>
                {Array.from({ length: 12 }, (_, i) => i).map((mi) => (
                  <Pressable
                    key={mi}
                    onPress={() => {
                      setCursorState((d) => new Date(d.getFullYear(), mi, 1));
                      setStep('calendar');
                    }}
                    style={({ pressed }) => [styles.monthCell, cursorState.getMonth() === mi && styles.monthCellActive, pressed && styles.pressed]}
                  >
                    <Text variant="labelLarge" style={cursorState.getMonth() === mi ? styles.monthCellActiveText : undefined}>
                      {monthLabel(mi)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions style={{ flexWrap: 'wrap' }}>
            {!isMobile && step !== 'calendar' ? (
              <Button
                onPress={() => {
                  setStep(step === 'month' ? 'year' : 'calendar');
                }}
              >
                Back
              </Button>
            ) : null}
            <Button onPress={() => setOpen(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  webCalHeaderPress: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  pickItem: { paddingVertical: 10, paddingHorizontal: 10, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(148,163,184,0.12)', marginBottom: 8 },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingVertical: 6 },
  monthCell: { width: '30%', minWidth: 92, height: 44, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(148,163,184,0.22)', backgroundColor: 'rgba(148,163,184,0.10)', alignItems: 'center', justifyContent: 'center' },
  monthCellActive: { borderColor: 'rgba(37,99,235,0.35)', backgroundColor: 'rgba(37,99,235,0.14)' },
  monthCellActiveText: { color: '#1D4ED8', fontWeight: '900' },
});

