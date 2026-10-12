import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { ReportFilterPicker } from '@/src/components/reports/ReportFilterPicker';
import { ReportTableView } from '@/src/components/reports/ReportTableView';
import { ReportTrendChart } from '@/src/components/reports/ReportTrendChart';
import type { ReportDataState } from '@/src/components/reports/useReportData';
import { AppSnackbar } from '@/src/components/shared/AppSnackbar';
import { DatePickerModal } from '@/src/components/shared/DatePickerModal';
import { ResponsiveContainer } from '@/src/components/shared/ResponsiveContainer';
import { ScreenHeader } from '@/src/components/shared/ScreenHeader';
import { findReport, type ReportAudience } from '@/src/domain/reports/catalog';
import {
  dateOfYmd,
  formatRange,
  matchPreset,
  presetLabel,
  presetRange,
  rangeDayCount,
  validateRange,
  type ReportPresetKey,
  type ReportRange,
} from '@/src/domain/reports/dateRange';
import { formatReportDate, formatReportValue } from '@/src/domain/reports/format';
import { ALL, type ReportDocument, type ReportFilterDef, type ReportFilterValues, type ReportTone } from '@/src/domain/reports/model';
import { useScreenSafeInsets } from '@/src/hooks/useScreenSafeInsets';
import { useLanguage, useStrings } from '@/src/i18n/useStrings';
import { printReport, shareReportCsv, shareReportPdf } from '@/src/infrastructure/reportShare';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const TONE: Record<ReportTone, string> = {
  default: amraleColors.text,
  good: '#15803D',
  bad: '#B91C1C',
  warn: '#B45309',
};

const FILTER_KEYS = ['route', 'boy', 'customer', 'product', 'mode'] as const;

/** yyyy-mm-dd ⇄ DD/MM/YYYY for the shared date picker. */
function toDmy(ymd: string): string {
  const d = dateOfYmd(ymd);
  return d ? `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}` : '';
}
function toYmd(dmy: string): string {
  const m = dmy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

type Result = { key: string; doc?: ReportDocument; error?: string };

export function ReportScreen({ audience, state }: { audience: ReportAudience; state: ReportDataState }) {
  const params = useLocalSearchParams<Record<string, string>>();
  const def = findReport(audience, params.id);
  const lang = useLanguage();
  const t = useStrings('reports');
  const common = useStrings('common');
  const { headerPaddingTop, scrollPaddingBottom } = useScreenSafeInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 760;

  const initialRange = useMemo<ReportRange>(() => {
    const fromParams = { fromYmd: String(params.from ?? ''), toYmd: String(params.to ?? '') };
    if (!validateRange(fromParams)) return fromParams;
    return presetRange(def?.defaultPreset ?? 'thisMonth');
    // Only the first render: later param changes come from this screen's own controls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [range, setRange] = useState<ReportRange>(initialRange);
  const [preset, setPreset] = useState<ReportPresetKey>(() => matchPreset(initialRange, new Date(), def?.presets));
  const [customOpen, setCustomOpen] = useState(preset === 'custom');
  const [pickerFor, setPickerFor] = useState<'from' | 'to' | null>(null);

  const [filters, setFilters] = useState<ReportFilterValues>(() => {
    const out: ReportFilterValues = {};
    for (const key of FILTER_KEYS) if (params[key]) out[key] = String(params[key]);
    return out;
  });
  const [filterOpen, setFilterOpen] = useState<ReportFilterDef | null>(null);

  const data = state.data;
  const filterDefs = useMemo(() => {
    if (!def || !data) return [];
    // Filters pinned by the app (the signed-in delivery boy or customer) are not offered.
    return def.filters(data).filter((f) => !(f.key in state.fixedFilters));
    // `lang`: filter labels are worded in the app language when built.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def, data, state.fixedFilters, lang]);
  const effectiveFilters = useMemo(() => ({ ...filters, ...state.fixedFilters }), [filters, state.fixedFilters]);

  const rangeError = validateRange(range);
  const missingRequired =
    def?.requiredFilter && (!effectiveFilters[def.requiredFilter.key] || effectiveFilters[def.requiredFilter.key] === ALL)
      ? def.requiredFilter
      : null;
  const canRun = !!def && !!data && !rangeError && !missingRequired;

  // The language is part of the key: a report's words are written when it is built.
  const runKey = JSON.stringify([def?.id, range, effectiveFilters, lang]);
  const [result, setResult] = useState<Result | null>(null);
  const [computing, setComputing] = useState(false);

  useEffect(() => {
    if (!canRun || !def || !data) return;
    let cancelled = false;
    setComputing(true);
    // Let the spinner paint first: a year of deliveries takes a moment on an older phone.
    const timer = setTimeout(() => {
      try {
        const doc = def.build(data, range, effectiveFilters);
        if (!cancelled) setResult({ key: runKey, doc });
      } catch (e) {
        if (!cancelled) setResult({ key: runKey, error: e instanceof Error ? e.message : t.screen.buildError });
      } finally {
        if (!cancelled) setComputing(false);
      }
    }, 30);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // `runKey` stands in for range and filters; `data` changes when records change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey, data, canRun]);

  const doc = result?.key === runKey ? result.doc : undefined;

  // Keep the address bar / deep link in step, so a report can be reopened or shared as a link on web.
  useEffect(() => {
    if (!def) return;
    const next: Record<string, string> = { id: def.id, from: range.fromYmd, to: range.toYmd };
    for (const key of FILTER_KEYS) if (filters[key] && filters[key] !== ALL) next[key] = filters[key]!;
    router.setParams(next);
  }, [def, range, filters]);

  const [busy, setBusy] = useState<'pdf' | 'csv' | 'print' | null>(null);
  const [snack, setSnack] = useState<string | null>(null);

  async function exportAs(kind: 'pdf' | 'csv' | 'print') {
    if (!doc || busy) return;
    setBusy(kind);
    try {
      if (kind === 'pdf') await shareReportPdf(doc);
      else if (kind === 'csv') await shareReportCsv(doc);
      else await printReport(doc);
    } catch (e) {
      setSnack(e instanceof Error && e.message ? e.message : t.screen.shareError);
    } finally {
      setBusy(null);
    }
  }

  function choosePreset(key: ReportPresetKey) {
    setPreset(key);
    if (key === 'custom') {
      setCustomOpen(true);
      return;
    }
    setCustomOpen(false);
    setRange(presetRange(key));
  }

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace((audience === 'admin' ? '/(admin)/reports' : audience === 'delivery' ? '/(delivery)/reports' : '/(customer)/reports') as never);
  };

  if (!def) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title={audience === 'admin' ? t.home.adminTitle : t.home.myTitle} onBack={back} paddingTop={headerPaddingTop} />
        <Message icon="file-question-outline" title={t.screen.notFoundTitle} text={t.screen.notFoundText} />
      </View>
    );
  }

  const selectedLabel = (f: ReportFilterDef) => f.options.find((o) => o.value === (filters[f.key] ?? ALL))?.label ?? f.options[0]?.label ?? '';
  const exportLabels =
    Platform.OS === 'web' ? { pdf: t.screen.savePdf, csv: t.screen.downloadCsv } : { pdf: t.screen.sharePdf, csv: t.screen.shareCsv };

  return (
    <View style={styles.screen}>
      <ScreenHeader title={def.title} onBack={back} paddingTop={headerPaddingTop} contentMaxWidth={wide ? 1100 : undefined} />

      <ScrollView contentContainerStyle={{ paddingBottom: scrollPaddingBottom(amraleSpacing.xl) }} keyboardShouldPersistTaps="handled">
        <ResponsiveContainer style={styles.body}>
          {/* Period */}
          <View style={styles.panel}>
            <View style={styles.periodRow}>
              <MaterialCommunityIcons name="calendar-range" size={20} color={amraleColors.blue} />
              <Text style={styles.periodText}>{formatRange(range)}</Text>
              {!rangeError ? <Text style={styles.periodDays}>{t.screen.dayCount(rangeDayCount(range))}</Text> : null}
            </View>
            <View style={styles.chips}>
              {def.presets.map((p) => {
                const selected = preset === p.key;
                return (
                  <Pressable
                    key={p.key}
                    onPress={() => choosePreset(p.key)}
                    style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{presetLabel(p.key)}</Text>
                  </Pressable>
                );
              })}
            </View>
            {customOpen ? (
              <View style={styles.customRow}>
                <DateField label={common.dates.from} value={range.fromYmd} onPress={() => setPickerFor('from')} />
                <DateField label={common.dates.to} value={range.toYmd} onPress={() => setPickerFor('to')} />
              </View>
            ) : null}
            {rangeError ? <Text style={styles.error}>{rangeError}</Text> : null}
          </View>

          {/* Filters */}
          {filterDefs.length ? (
            <View style={styles.filters}>
              {filterDefs.map((f) => {
                const active = !!filters[f.key] && filters[f.key] !== ALL;
                return (
                  <Pressable
                    key={f.key}
                    onPress={() => setFilterOpen(f)}
                    style={({ pressed }) => [styles.filter, active && styles.filterActive, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={`${f.label}: ${selectedLabel(f)}`}
                  >
                    <Text style={styles.filterLabel}>{f.label}</Text>
                    <Text style={[styles.filterValue, active && styles.filterValueActive]} numberOfLines={1}>
                      {selectedLabel(f)}
                    </Text>
                    <MaterialCommunityIcons name="chevron-down" size={18} color={active ? amraleColors.blue : amraleColors.textMuted} />
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {/* Content */}
          {state.isLoading ? (
            <Loading text={t.screen.loadingRecords} />
          ) : state.unavailableMessage ? (
            <Message icon="account-alert-outline" title={t.screen.unavailableTitle} text={state.unavailableMessage} />
          ) : state.isError || !data ? (
            <Message icon="cloud-alert-outline" title={t.screen.loadErrorTitle} text={t.screen.loadErrorText} />
          ) : missingRequired ? (
            <Message icon="gesture-tap" title={t.screen.oneMoreChoice} text={missingRequired.prompt} />
          ) : rangeError ? null : computing || !doc ? (
            result?.key === runKey && result.error ? (
              <Message icon="alert-circle-outline" title={t.screen.buildErrorTitle} text={result.error} />
            ) : (
              <Loading text={t.screen.building} />
            )
          ) : (
            <>
              {doc.subject ? <Text style={styles.subject}>{doc.subject}</Text> : null}

              <View style={styles.exportRow}>
                <ExportButton icon="file-pdf-box" label={exportLabels.pdf} busy={busy === 'pdf'} onPress={() => void exportAs('pdf')} />
                <ExportButton icon="file-delimited-outline" label={exportLabels.csv} busy={busy === 'csv'} onPress={() => void exportAs('csv')} />
                {Platform.OS !== 'web' ? (
                  <ExportButton icon="printer-outline" label={t.screen.print} busy={busy === 'print'} onPress={() => void exportAs('print')} />
                ) : null}
              </View>

              {doc.stats.length ? (
                <View style={styles.stats}>
                  {doc.stats.map((s) => (
                    <View key={s.label} style={[styles.stat, { flexBasis: wide ? '23%' : '46%' }]}>
                      <Text style={styles.statLabel} numberOfLines={2}>
                        {s.label}
                      </Text>
                      <Text style={[styles.statValue, { color: TONE[s.tone ?? 'default'] }]} numberOfLines={1} adjustsFontSizeToFit>
                        {formatReportValue(s.value, s.kind)}
                      </Text>
                      {s.hint ? (
                        <Text style={styles.statHint} numberOfLines={2}>
                          {s.hint}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}

              {doc.trend ? <ReportTrendChart trend={doc.trend} /> : null}

              {doc.tables.map((t) => (
                <ReportTableView key={`${runKey}:${t.id}`} table={t} wide={wide} />
              ))}

              {doc.notes?.length ? (
                <View style={styles.notes}>
                  {doc.notes.map((n) => (
                    <View key={n} style={styles.noteRow}>
                      <MaterialCommunityIcons name="information-outline" size={14} color={amraleColors.textSubtle} />
                      <Text style={styles.noteText}>{n}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          )}
        </ResponsiveContainer>
      </ScrollView>

      <DatePickerModal
        visible={pickerFor !== null}
        value={toDmy(pickerFor === 'to' ? range.toYmd : range.fromYmd)}
        yearsAhead={def.yearsAhead}
        title={pickerFor === 'to' ? t.screen.endDate : t.screen.startDate}
        onSelect={(dmy) => {
          const ymd = toYmd(dmy);
          if (!ymd) return;
          setPreset('custom');
          setRange((r) => {
            if (pickerFor === 'to') return { fromYmd: r.fromYmd > ymd ? ymd : r.fromYmd, toYmd: ymd };
            return { fromYmd: ymd, toYmd: r.toYmd < ymd ? ymd : r.toYmd };
          });
        }}
        onDismiss={() => setPickerFor(null)}
      />

      <ReportFilterPicker
        filter={filterOpen}
        value={filterOpen ? filters[filterOpen.key] ?? ALL : ALL}
        visible={filterOpen !== null}
        onSelect={(v) => filterOpen && setFilters((f) => ({ ...f, [filterOpen.key]: v }))}
        onDismiss={() => setFilterOpen(null)}
      />

      <AppSnackbar visible={!!snack} message={snack ?? ''} onDismiss={() => setSnack(null)} />
    </View>
  );
}

function DateField({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  const t = useStrings('reports');
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.dateField, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={t.screen.dateA11y(label, formatReportDate(value))}
    >
      <Text style={styles.dateLabel}>{label}</Text>
      <View style={styles.dateValueRow}>
        <Text style={styles.dateValue}>{formatReportDate(value)}</Text>
        <MaterialCommunityIcons name="calendar" size={18} color={amraleColors.blue} />
      </View>
    </Pressable>
  );
}

function ExportButton({ icon, label, busy, onPress }: { icon: IconName; label: string; busy: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [styles.exportBtn, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {busy ? <ActivityIndicator size="small" color={amraleColors.blue} /> : <MaterialCommunityIcons name={icon} size={18} color={amraleColors.blue} />}
      <Text style={styles.exportText}>{label}</Text>
    </Pressable>
  );
}

function Loading({ text }: { text: string }) {
  return (
    <View style={styles.message}>
      <ActivityIndicator color={amraleColors.blue} size="large" />
      <Text style={styles.messageText}>{text}</Text>
    </View>
  );
}

function Message({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return (
    <View style={styles.message}>
      <MaterialCommunityIcons name={icon} size={40} color={amraleColors.textSubtle} />
      <Text style={styles.messageTitle}>{title}</Text>
      <Text style={styles.messageText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: amraleColors.surface },
  body: { paddingHorizontal: amraleSpacing.md, paddingTop: amraleSpacing.md, gap: 12 },

  panel: {
    backgroundColor: amraleColors.white,
    borderRadius: amraleRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(53, 81, 161, 0.08)',
    padding: 14,
    gap: 10,
  },
  periodRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  periodText: { flexShrink: 1, fontFamily: amraleTypography.fontFamily.bold, fontSize: 16, color: amraleColors.text },
  periodDays: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 13, color: amraleColors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 36,
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRadius: amraleRadius.pill,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
    backgroundColor: amraleColors.white,
  },
  chipSelected: { backgroundColor: amraleColors.blue, borderColor: amraleColors.blue },
  chipText: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 13, color: amraleColors.text },
  chipTextSelected: { color: amraleColors.white },
  customRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  dateField: {
    flexGrow: 1,
    flexBasis: 140,
    minHeight: 56,
    borderRadius: amraleRadius.md,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  dateLabel: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 12, color: amraleColors.textMuted },
  dateValueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  dateValue: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 15, color: amraleColors.text },
  error: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 13, color: amraleColors.error },

  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filter: {
    flexGrow: 1,
    flexBasis: 160,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: amraleRadius.lg,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
    backgroundColor: amraleColors.white,
  },
  filterActive: { borderColor: amraleColors.blue, backgroundColor: 'rgba(53, 81, 161, 0.06)' },
  filterLabel: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 12, color: amraleColors.textMuted },
  filterValue: { flex: 1, minWidth: 0, fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 14, color: amraleColors.text },
  filterValueActive: { color: amraleColors.blue },

  subject: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 16, color: amraleColors.text },

  exportRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  exportBtn: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: amraleRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(53, 81, 161, 0.25)',
    backgroundColor: amraleColors.white,
  },
  exportText: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 14, color: amraleColors.blue },

  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: {
    flexGrow: 1,
    minWidth: 120,
    backgroundColor: amraleColors.white,
    borderRadius: amraleRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(53, 81, 161, 0.08)',
    padding: 12,
    gap: 4,
  },
  statLabel: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 12, lineHeight: 16, color: amraleColors.textMuted },
  statValue: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 20, lineHeight: 26 },
  statHint: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 11, lineHeight: 15, color: amraleColors.textSubtle },

  notes: { gap: 6, paddingHorizontal: 4 },
  noteRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  noteText: { flex: 1, fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, lineHeight: 17, color: amraleColors.textMuted },

  message: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 48, paddingHorizontal: 16 },
  messageTitle: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 16, color: amraleColors.text, textAlign: 'center' },
  messageText: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 14, color: amraleColors.textMuted, textAlign: 'center' },
  pressed: { opacity: 0.85 },
});
