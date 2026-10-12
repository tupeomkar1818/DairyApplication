import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AuthPrimaryButton } from '@/src/components/auth/AuthPrimaryButton';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleRadius, amraleSpacing, amraleTypography, dairyTactileColors } from '@/src/theme/dairyTactile';
import { useResponsiveLayout } from '@/src/utils/responsiveLayout';

export type DeleteCustomerConfirmDialogProps = {
  visible: boolean;
  customerName: string;
  onDismiss: () => void;
  onConfirm: () => void;
  loading?: boolean;
  /** Shown above the actions when the last delete attempt failed (dialog stays open). */
  errorMessage?: string | null;
};

export function DeleteCustomerConfirmDialog({
  visible,
  customerName,
  onDismiss,
  onConfirm,
  loading = false,
  errorMessage,
}: DeleteCustomerConfirmDialogProps) {
  const t = useStrings('customers').deleteDialog;
  const name = customerName.trim() || t.thisCustomer;
  // Capped to the viewport so the card scrolls instead of clipping in phone landscape (~375px tall).
  const { dialogMaxHeight } = useResponsiveLayout();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={loading ? undefined : onDismiss}>
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={loading ? undefined : onDismiss}
          accessibilityRole="button"
          accessibilityLabel={t.dismissLabel}
        />

        <View style={[styles.card, { maxHeight: dialogMaxHeight }]} accessibilityViewIsModal>
          <ScrollView
            style={styles.cardScroll}
            contentContainerStyle={styles.cardContent}
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons name="trash-can-outline" size={28} color={dairyTactileColors.error} />
            </View>

            <Text style={styles.title}>{t.title}</Text>
            <Text style={styles.message}>
              {t.messageBefore}
              <Text style={styles.messageBold}>{name}</Text>
              {t.messageAfter}
            </Text>

            {errorMessage ? (
              <Text style={styles.errorText} accessibilityLiveRegion="polite">
                {errorMessage}
              </Text>
            ) : null}

            <View style={styles.primaryWrap}>
              {loading ? (
                <View style={styles.loadingBtn}>
                  <ActivityIndicator color={dairyTactileColors.onPrimary} />
                </View>
              ) : (
                <AuthPrimaryButton label={t.delete} onPress={onConfirm} variant="filled" compact />
              )}
            </View>

            <Pressable
              onPress={onDismiss}
              disabled={loading}
              style={({ pressed }) => [styles.cancelBtn, pressed && !loading && styles.cancelPressed]}
              accessibilityRole="button"
              accessibilityLabel={t.cancelLabel}
            >
              <Text style={[styles.cancelText, loading && styles.cancelDisabled]}>{t.cancel}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
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
    backgroundColor: 'rgba(11, 29, 45, 0.48)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: dairyTactileColors.surfaceContainerLowest,
    borderRadius: amraleRadius.xxl,
    shadowColor: dairyTactileColors.primaryContainer,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 8,
    zIndex: 1,
  },
  cardScroll: { flexGrow: 0 },
  cardContent: {
    paddingHorizontal: amraleSpacing.lg,
    paddingTop: amraleSpacing.xl,
    paddingBottom: amraleSpacing.lg,
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: dairyTactileColors.errorContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: amraleSpacing.md,
  },
  title: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 22,
    color: dairyTactileColors.onSurface,
    textAlign: 'center',
    marginBottom: amraleSpacing.sm,
  },
  message: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 15,
    lineHeight: 22,
    color: dairyTactileColors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: amraleSpacing.lg,
    paddingHorizontal: amraleSpacing.xs,
  },
  messageBold: {
    fontFamily: amraleTypography.fontFamily.bold,
    color: dairyTactileColors.onSurface,
  },
  errorText: {
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 14,
    lineHeight: 20,
    color: dairyTactileColors.error,
    textAlign: 'center',
    marginBottom: amraleSpacing.md,
  },
  primaryWrap: {
    width: '100%',
    marginBottom: amraleSpacing.sm,
  },
  loadingBtn: {
    width: '100%',
    minHeight: 54,
    borderRadius: amraleRadius.lg,
    backgroundColor: dairyTactileColors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: dairyTactileColors.primaryContainer,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  cancelBtn: {
    width: '100%',
    minHeight: 52,
    borderRadius: amraleRadius.lg,
    backgroundColor: dairyTactileColors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: amraleSpacing.xs,
  },
  cancelPressed: {
    opacity: 0.88,
  },
  cancelText: {
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 16,
    color: dairyTactileColors.onSurfaceVariant,
    textAlign: 'center',
  },
  cancelDisabled: {
    opacity: 0.5,
  },
});
