import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AuthBrandLayout, AuthCard } from '@/src/components/auth/AuthBrandLayout';
import { authFormStyles } from '@/src/components/auth/authFormStyles';
import { DomainError } from '@/src/domain/shared/errors';
import { useSetPin } from '@/src/hooks/auth';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleTypography } from '@/src/theme/dairyTactile';

/**
 * Choosing the four digits to sign in with from now on.
 *
 * Shown straight after somebody's first sign-in, where their password was their own mobile number — until they
 * choose a PIN the dairy's server lets them do nothing else, because anybody who knows that number could sign in
 * as them. The same screen changes a PIN later, and then asks for the one in use.
 */
export default function SetPinScreen() {
  const t = useStrings('auth');
  const { change } = useLocalSearchParams<{ change?: string }>();
  const changing = change === '1';
  const setPin = useSetPin();

  const [currentPin, setCurrentPin] = useState('');
  const [pin, setPin1] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const digits = (value: string) => value.replace(/\D/g, '').slice(0, 4);
  const ready = pin.length === 4 && confirm.length === 4 && (!changing || currentPin.length === 4);

  async function save() {
    setError(null);
    if (pin !== confirm) {
      setError(t.errors.pinMismatch);
      return;
    }
    if (!ready || setPin.isPending) return;

    try {
      await setPin.mutateAsync({ pin, ...(changing ? { currentPin } : {}) });
      // Signing in is finished: the app's own guards send them to their home screen.
      router.replace('/');
    } catch (e) {
      setError(e instanceof DomainError ? e.message : e instanceof Error ? e.message : t.setPin.saveFailed);
    }
  }

  return (
    <AuthBrandLayout>
      <AuthCard>
        <Text style={authFormStyles.title}>{changing ? t.setPin.changeTitle : t.setPin.title}</Text>
        <Text style={authFormStyles.subtitle}>{t.setPin.subtitle}</Text>

        {changing ? (
          <PinField label={t.setPin.currentPin} value={currentPin} onChange={(v) => setCurrentPin(digits(v))} />
        ) : null}
        <PinField
          label={t.setPin.newPin}
          value={pin}
          onChange={(v) => {
            setError(null);
            setPin1(digits(v));
          }}
        />
        <PinField
          label={t.setPin.confirmPin}
          value={confirm}
          onChange={(v) => {
            setError(null);
            setConfirm(digits(v));
          }}
          onSubmit={() => void save()}
        />

        {error ? (
          <View style={authFormStyles.errorBox} accessibilityLiveRegion="polite">
            <MaterialCommunityIcons name="alert-circle-outline" size={16} color={amraleColors.error} />
            <Text style={authFormStyles.errorBoxText}>{error}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={() => void save()}
          disabled={setPin.isPending}
          style={({ pressed }) => [
            authFormStyles.button,
            !ready && authFormStyles.buttonIdle,
            pressed && !setPin.isPending && authFormStyles.buttonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t.setPin.save}
          accessibilityState={{ disabled: setPin.isPending, busy: setPin.isPending }}
        >
          {setPin.isPending ? (
            <ActivityIndicator color={amraleColors.white} />
          ) : (
            <>
              <Text style={authFormStyles.buttonText}>{t.setPin.save}</Text>
              <MaterialCommunityIcons name="check" size={20} color={amraleColors.white} />
            </>
          )}
        </Pressable>

        <View style={authFormStyles.note}>
          <MaterialCommunityIcons name="shield-lock-outline" size={16} color={amraleColors.textSubtle} />
          <Text style={authFormStyles.noteText}>{t.login.privacyNote}</Text>
        </View>
      </AuthCard>
    </AuthBrandLayout>
  );
}

function PinField({
  label,
  value,
  onChange,
  onSubmit,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        onSubmitEditing={onSubmit}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={4}
        secureTextEntry
        accessibilityLabel={label}
        placeholder="••••"
        placeholderTextColor={amraleColors.textSubtle}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: {
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 13,
    color: amraleColors.textMuted,
  },
  input: {
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
    borderRadius: amraleRadius.md,
    backgroundColor: amraleColors.inputBgLight,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 22,
    letterSpacing: 10,
    textAlign: 'center',
    color: amraleColors.text,
  },
});
