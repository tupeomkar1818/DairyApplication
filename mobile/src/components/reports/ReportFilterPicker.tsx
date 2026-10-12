import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Platform, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ReportFilterDef } from '@/src/domain/reports/model';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleTypography } from '@/src/theme/dairyTactile';

/** A list to pick one filter value from; long lists (customers) get a search box. */
export function ReportFilterPicker({
  filter,
  value,
  visible,
  onSelect,
  onDismiss,
}: {
  filter: ReportFilterDef | null;
  value: string;
  visible: boolean;
  onSelect: (value: string) => void;
  onDismiss: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const t = useStrings('reports');
  const closeLabel = useStrings('common').actions.close;
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (visible) setQuery('');
  }, [visible]);

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = filter?.options ?? [];
    return q ? all.filter((o) => o.label.toLowerCase().includes(q)) : all;
  }, [filter, query]);

  const searchable = (filter?.options.length ?? 0) > 8;
  const sheetWidth = Math.min(width, 560);

  return (
    <Modal visible={visible && !!filter} transparent animationType="fade" onRequestClose={onDismiss} statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} accessibilityLabel={closeLabel} />
        <View
          style={[
            styles.sheet,
            { width: sheetWidth, maxHeight: Math.max(320, height * 0.8), paddingBottom: Math.max(insets.bottom, 12) },
          ]}
          accessibilityViewIsModal
        >
          <View style={styles.header}>
            <Text style={styles.title}>{filter?.label ?? ''}</Text>
            <Pressable onPress={onDismiss} hitSlop={8} style={styles.close} accessibilityRole="button" accessibilityLabel={closeLabel}>
              <MaterialCommunityIcons name="close" size={22} color={amraleColors.textMuted} />
            </Pressable>
          </View>

          {searchable ? (
            <View style={styles.search}>
              <MaterialCommunityIcons name="magnify" size={20} color={amraleColors.textSubtle} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t.picker.search(filter?.label ?? '')}
                placeholderTextColor={amraleColors.textSubtle}
                autoCorrect={false}
                autoCapitalize="none"
                style={[styles.searchInput, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
              />
            </View>
          ) : null}

          <FlatList
            data={options}
            keyExtractor={(o) => o.value}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            ListEmptyComponent={<Text style={styles.empty}>{t.picker.nothingMatches}</Text>}
            renderItem={({ item }) => {
              const selected = item.value === value;
              return (
                <Pressable
                  onPress={() => {
                    onSelect(item.value);
                    onDismiss();
                  }}
                  style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.optionText, selected && styles.optionTextSelected]} numberOfLines={2}>
                    {item.label}
                  </Text>
                  {selected ? <MaterialCommunityIcons name="check" size={20} color={amraleColors.blue} /> : null}
                </Pressable>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(11, 29, 45, 0.45)' },
  sheet: {
    backgroundColor: amraleColors.white,
    borderTopLeftRadius: amraleRadius.xl,
    borderTopRightRadius: amraleRadius.xl,
    paddingTop: 8,
  },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  title: { flex: 1, fontFamily: amraleTypography.fontFamily.bold, fontSize: 18, color: amraleColors.text },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    minHeight: 46,
    borderRadius: amraleRadius.lg,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
  },
  searchInput: { flex: 1, minWidth: 0, fontFamily: amraleTypography.fontFamily.regular, fontSize: 15, color: amraleColors.text, paddingVertical: 10 },
  list: { paddingHorizontal: 12, paddingBottom: 8, gap: 4 },
  option: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: amraleRadius.md,
  },
  optionSelected: { backgroundColor: 'rgba(53, 81, 161, 0.08)' },
  optionText: { flex: 1, fontFamily: amraleTypography.fontFamily.medium, fontSize: 15, color: amraleColors.text },
  optionTextSelected: { fontFamily: amraleTypography.fontFamily.bold, color: amraleColors.blue },
  empty: { padding: 16, fontFamily: amraleTypography.fontFamily.regular, fontSize: 14, color: amraleColors.textMuted },
  pressed: { opacity: 0.8 },
});
