import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, Portal, Text, TextInput } from 'react-native-paper';

import type { PeriodPreset } from '@/src/domain/deliveryBoys/periodRange';
import { presetLabel } from '@/src/domain/deliveryBoys/periodRange';
import { useLanguage, useStrings } from '@/src/i18n/useStrings';
import { useResponsiveLayout } from '@/src/utils/responsiveLayout';

const PRESETS: PeriodPreset[] = ['today', 'thisWeek', 'thisMonth', 'lastMonth', 'last3Months', 'last6Months', 'custom'];

/** Admin tactile screens are light-only; pin the scheme so chip text never switches to dark-mode colors on light surfaces. */
const ADMIN_TACTILE_SCHEME = 'light' as 'light' | 'dark';

type Props = {
  value: PeriodPreset;
  onChange: (p: PeriodPreset) => void;
  customStartIso?: string;
  customEndIso?: string;
  onCustomChange?: (startIso: string, endIso: string) => void;
};

export function AdminPeriodFilterBar({ value, onChange, customStartIso = '', customEndIso = '', onCustomChange }: Props) {
  const scheme = ADMIN_TACTILE_SCHEME;
  const t = useStrings('admin').periodFilter;
  const tc = useStrings('common');
  // presetLabel reads the app language; subscribing re-renders the chips when it changes.
  useLanguage();
  const { isMobile, dialogMaxHeight, width } = useResponsiveLayout();
  const [open, setOpen] = useState(false);
  const [draftStart, setDraftStart] = useState(customStartIso);
  const [draftEnd, setDraftEnd] = useState(customEndIso);

  const textMain = scheme === 'dark' ? styles.textDark : styles.textLight;
  const chipOn = scheme === 'dark' ? styles.chipOnDark : styles.chipOnLight;
  const chipOff = scheme === 'dark' ? styles.chipOffDark : styles.chipOffLight;

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {PRESETS.map((p) => (
          <Pressable
            key={p}
            onPress={() => {
              if (p === 'custom') {
                setDraftStart(customStartIso);
                setDraftEnd(customEndIso);
                setOpen(true);
                return;
              }
              onChange(p);
            }}
            style={({ pressed }) => [styles.chip, value === p ? chipOn : chipOff, pressed && styles.pressed]}
          >
            <Text variant="labelSmall" style={[styles.chipText, textMain]} numberOfLines={1}>
              {presetLabel(p)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Portal>
        <Dialog
          visible={open}
          onDismiss={() => setOpen(false)}
          style={[
            scheme === 'dark' ? styles.dialogDark : styles.dialogLight,
            { maxHeight: dialogMaxHeight },
            isMobile && { width: Math.min(width - 24, 520), alignSelf: 'center' as const },
          ]}
        >
          <Dialog.Title>{t.customRange}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodySmall" style={styles.hint}>
              {t.dateFormatHint}
            </Text>
            <TextInput mode="outlined" label={t.start} dense value={draftStart} onChangeText={setDraftStart} style={styles.input} />
            <TextInput mode="outlined" label={t.end} dense value={draftEnd} onChangeText={setDraftEnd} style={styles.input} />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setOpen(false)}>{tc.actions.cancel}</Button>
            <Button
              mode="contained"
              onPress={() => {
                onCustomChange?.(draftStart.trim().slice(0, 10), draftEnd.trim().slice(0, 10));
                onChange('custom');
                setOpen(false);
              }}
            >
              {tc.actions.apply}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipOnLight: { backgroundColor: 'rgba(37,99,235,0.12)', borderColor: 'rgba(37,99,235,0.35)' },
  chipOnDark: { backgroundColor: 'rgba(96,165,250,0.18)', borderColor: 'rgba(96,165,250,0.35)' },
  chipOffLight: { backgroundColor: 'rgba(148,163,184,0.12)', borderColor: 'rgba(148,163,184,0.25)' },
  chipOffDark: { backgroundColor: 'rgba(148,163,184,0.10)', borderColor: 'rgba(148,163,184,0.22)' },
  chipText: { fontWeight: '700' },
  textLight: { color: '#1E293B' },
  textDark: { color: 'rgba(255,255,255,0.92)' },
  pressed: { opacity: 0.85 },
  hint: { marginBottom: 8, opacity: 0.7 },
  input: { marginBottom: 8 },
  dialogLight: { backgroundColor: '#fff' },
  dialogDark: { backgroundColor: '#111827' },
});
