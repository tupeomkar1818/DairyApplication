import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { ProfileVerifyCard } from '@/src/components/profile/ProfileVerifyCard';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleSpacing } from '@/src/theme/dairyTactile';

export type ProfileOtpVerifyModalProps = {
  visible: boolean;
  onDismiss: () => void;
  verifyKey?: number;
  otpExpiryAt?: string;
  resendAvailableAt?: string;
  demoOtp?: string;
  error?: string | null;
  submitting?: boolean;
  resending?: boolean;
  submitLabel?: string;
  sectionTitle?: string;
  hint?: string;
  onSubmit: (otp: string) => void;
  onResend: () => void;
};

export function ProfileOtpVerifyModal({
  visible,
  onDismiss,
  verifyKey = 0,
  otpExpiryAt,
  resendAvailableAt,
  demoOtp,
  error,
  submitting,
  resending,
  submitLabel,
  sectionTitle,
  hint,
  onSubmit,
  onResend,
}: ProfileOtpVerifyModalProps) {
  const t = useStrings('profile');
  const c = useStrings('common');
  const busy = submitting || resending;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={busy ? undefined : onDismiss}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={styles.backdrop}
          onPress={busy ? undefined : onDismiss}
          accessibilityRole="button"
          accessibilityLabel={t.verify.closeLabel}
        />

        <View style={styles.sheet} accessibilityViewIsModal>
          <Pressable
            onPress={onDismiss}
            disabled={busy}
            hitSlop={6}
            style={({ pressed }) => [styles.closeBtn, pressed && !busy && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={c.actions.close}
          >
            <MaterialCommunityIcons name="close" size={22} color={amraleColors.textMuted} />
          </Pressable>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <ProfileVerifyCard
              key={verifyKey}
              otpExpiryAt={otpExpiryAt}
              resendAvailableAt={resendAvailableAt}
              demoOtp={demoOtp}
              error={error}
              submitting={submitting}
              resending={resending}
              submitLabel={submitLabel}
              sectionTitle={sectionTitle}
              hint={hint}
              onSubmit={onSubmit}
              onResend={onResend}
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: amraleSpacing.lg,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(26, 43, 75, 0.52)',
  },
  sheet: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '88%',
    zIndex: 1,
  },
  closeBtn: {
    alignSelf: 'flex-end',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: amraleColors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: amraleSpacing.sm,
    shadowColor: amraleColors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  pressed: { opacity: 0.85 },
  scrollContent: {
    flexGrow: 1,
  },
});
