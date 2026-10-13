import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppSnackbar } from '@/src/components/shared/AppSnackbar';
import { DairyTactileScreenBackground } from '@/src/components/shared/DairyTactileScreenBackground';
import { DomainError } from '@/src/domain/shared/errors';
import { useAuthSession } from '@/src/hooks/auth';
import {
  useAddDeskUser,
  useAddManager,
  useDeskUsers,
  useManagers,
  useRemoveDeskUser,
  useRemoveManager,
} from '@/src/hooks/counter';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';

/**
 * Who works here: the desk, and the managers.
 *
 * The owner's screen. A manager can run the day but cannot take somebody on — otherwise "manager" would mean
 * "owner who has not noticed yet".
 */
export default function StaffScreen() {
  const t = useStrings('counter');
  const c = useStrings('common');
  const session = useAuthSession();
  const owner = session.data?.role === 'super_admin';

  const deskUsers = useDeskUsers();
  const managers = useManagers();
  const addDesk = useAddDeskUser();
  const addManager = useAddManager();
  const removeDesk = useRemoveDeskUser();
  const removeManager = useRemoveManager();

  const [deskName, setDeskName] = useState('');
  const [deskMobile, setDeskMobile] = useState('');
  const [mgrName, setMgrName] = useState('');
  const [mgrMobile, setMgrMobile] = useState('');
  const [toast, setToast] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });

  const say = useCallback((message: string) => setToast({ visible: true, message }), []);
  const hide = useCallback(() => setToast((s) => ({ ...s, visible: false })), []);

  const problem = (e: unknown) => {
    if (e instanceof DomainError) {
      if (e.code === 'MOBILE_IN_USE' || e.code === 'CUSTOMER_MOBILE_EXISTS') return t.errors.mobileInUse;
      return e.message;
    }
    return e instanceof Error ? e.message : c.errors.couldNotSave;
  };

  const valid = (name: string, mobile: string) => name.trim().length > 0 && /^\d{10}$/.test(mobile);

  async function onAddDesk() {
    if (!valid(deskName, deskMobile)) {
      say(deskName.trim() ? t.errors.mobileInvalid : t.errors.nameRequired);
      return;
    }
    try {
      await addDesk.mutateAsync({ fullName: deskName.trim(), mobile: deskMobile, status: 'Active' });
      setDeskName('');
      setDeskMobile('');
    } catch (e) {
      say(problem(e));
    }
  }

  async function onAddManager() {
    if (!valid(mgrName, mgrMobile)) {
      say(mgrName.trim() ? t.errors.mobileInvalid : t.errors.nameRequired);
      return;
    }
    try {
      await addManager.mutateAsync({ name: mgrName.trim(), mobile: mgrMobile });
      setMgrName('');
      setMgrMobile('');
    } catch (e) {
      say(problem(e));
    }
  }

  return (
    <DairyTactileScreenBackground>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={c.actions.back} style={styles.backBtn}>
          <MaterialCommunityIcons name="chevron-left" size={26} color={amraleColors.text} />
        </Pressable>
        <Text style={styles.title}>{t.staff.deskTitle}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.note}>{t.staff.signInHint}</Text>

        <Text style={styles.sectionTitle}>{t.staff.deskTitle}</Text>
        <Text style={styles.sectionSub}>{t.staff.deskSubtitle}</Text>

        {deskUsers.isPending ? (
          <ActivityIndicator color={amraleColors.blue} style={{ paddingVertical: 16 }} />
        ) : !deskUsers.data?.length ? (
          <Text style={styles.empty}>{t.staff.noDesk}</Text>
        ) : (
          deskUsers.data.map((person) => (
            <View key={person.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName}>{person.fullName}</Text>
                <Text style={styles.rowMeta}>
                  {person.mobile}
                  {person.counterName ? ` · ${person.counterName}` : ''}
                </Text>
              </View>
              {owner ? (
                <Pressable
                  onPress={() => void removeDesk.mutateAsync(person.id).catch((e) => say(problem(e)))}
                  accessibilityRole="button"
                  accessibilityLabel={t.staff.remove}
                  style={styles.removeBtn}
                >
                  <MaterialCommunityIcons name="account-remove-outline" size={20} color={amraleColors.error} />
                </Pressable>
              ) : null}
            </View>
          ))
        )}

        {owner ? (
          <View style={styles.addCard}>
            <Text style={styles.addTitle}>{t.staff.addDesk}</Text>
            <TextInput
              value={deskName}
              onChangeText={setDeskName}
              placeholder={t.staff.name}
              placeholderTextColor={amraleColors.textSubtle}
              style={styles.input}
              accessibilityLabel={t.staff.name}
            />
            <TextInput
              value={deskMobile}
              onChangeText={(v) => setDeskMobile(v.replace(/\D/g, '').slice(0, 10))}
              placeholder={t.staff.mobile}
              placeholderTextColor={amraleColors.textSubtle}
              keyboardType="number-pad"
              inputMode="numeric"
              style={styles.input}
              accessibilityLabel={t.staff.mobile}
            />
            <Pressable onPress={() => void onAddDesk()} accessibilityRole="button" style={styles.addBtn} disabled={addDesk.isPending}>
              {addDesk.isPending ? <ActivityIndicator color={amraleColors.white} /> : <Text style={styles.addBtnText}>{t.staff.add}</Text>}
            </Pressable>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>{t.staff.managersTitle}</Text>
        <Text style={styles.sectionSub}>{t.staff.managersSubtitle}</Text>

        {managers.isPending ? (
          <ActivityIndicator color={amraleColors.blue} style={{ paddingVertical: 16 }} />
        ) : !managers.data?.length ? (
          <Text style={styles.empty}>{t.staff.noManagers}</Text>
        ) : (
          managers.data.map((person) => (
            <View key={person.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName}>
                  {person.name}
                  {person.role === 'super_admin' ? ` · ${t.staff.owner}` : ''}
                </Text>
                <Text style={styles.rowMeta}>{person.mobile}</Text>
              </View>
              {owner && person.removable ? (
                <Pressable
                  onPress={() => void removeManager.mutateAsync(person.id).catch((e) => say(problem(e)))}
                  accessibilityRole="button"
                  accessibilityLabel={t.staff.remove}
                  style={styles.removeBtn}
                >
                  <MaterialCommunityIcons name="account-remove-outline" size={20} color={amraleColors.error} />
                </Pressable>
              ) : null}
            </View>
          ))
        )}

        {owner ? (
          <>
            <View style={styles.addCard}>
              <Text style={styles.addTitle}>{t.staff.addManager}</Text>
              <TextInput
                value={mgrName}
                onChangeText={setMgrName}
                placeholder={t.staff.name}
                placeholderTextColor={amraleColors.textSubtle}
                style={styles.input}
                accessibilityLabel={t.staff.name}
              />
              <TextInput
                value={mgrMobile}
                onChangeText={(v) => setMgrMobile(v.replace(/\D/g, '').slice(0, 10))}
                placeholder={t.staff.mobile}
                placeholderTextColor={amraleColors.textSubtle}
                keyboardType="number-pad"
                inputMode="numeric"
                style={styles.input}
                accessibilityLabel={t.staff.mobile}
              />
              <Pressable
                onPress={() => void onAddManager()}
                accessibilityRole="button"
                style={styles.addBtn}
                disabled={addManager.isPending}
              >
                {addManager.isPending ? (
                  <ActivityIndicator color={amraleColors.white} />
                ) : (
                  <Text style={styles.addBtnText}>{t.staff.add}</Text>
                )}
              </Pressable>
            </View>
            <Text style={styles.note}>{t.staff.ownerNote}</Text>
          </>
        ) : null}
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
  body: { padding: amraleSpacing.lg, gap: 8, paddingBottom: 48 },

  sectionTitle: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 16, color: amraleColors.text, marginTop: 14 },
  sectionSub: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, color: amraleColors.textMuted },
  note: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, color: amraleColors.textSubtle, marginTop: 6 },
  empty: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 14, color: amraleColors.textMuted, paddingVertical: 12 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: amraleColors.inputBorderLight,
  },
  rowName: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 15, color: amraleColors.text },
  rowMeta: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, color: amraleColors.textMuted },
  removeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: amraleColors.inputBgLight,
  },

  addCard: {
    marginTop: 12,
    borderRadius: amraleRadius.md,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
    backgroundColor: amraleColors.white,
    padding: 14,
    gap: 10,
  },
  addTitle: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 14, color: amraleColors.text },
  input: {
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
    borderRadius: amraleRadius.md,
    backgroundColor: amraleColors.inputBgLight,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 15,
    color: amraleColors.text,
  },
  addBtn: {
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: amraleRadius.md,
    backgroundColor: amraleColors.blue,
  },
  addBtnText: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 15, color: amraleColors.white },
});
