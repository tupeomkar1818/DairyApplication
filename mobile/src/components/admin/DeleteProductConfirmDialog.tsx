import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AuthPrimaryButton } from '@/src/components/auth/AuthPrimaryButton';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';
import { useResponsiveLayout } from '@/src/utils/responsiveLayout';

export type DeleteProductConfirmDialogProps = {
  visible: boolean;
  productName: string;
  onDismiss: () => void;
  onConfirm: () => void;
  loading?: boolean;
  /** Shown under the message when the delete was refused (e.g. product still used by subscriptions). */
  errorMessage?: string | null;
};

export function DeleteProductConfirmDialog({
  visible,
  productName,
  onDismiss,
  onConfirm,
  loading = false,
  errorMessage = null,
}: DeleteProductConfirmDialogProps) {
  const t = useStrings('products');
  const tc = useStrings('common');
  const name = productName.trim() || t.deleteDialog.thisProduct;
  // Capped to the viewport so the card scrolls instead of clipping in phone landscape (~375px tall).
  const { dialogMaxHeight } = useResponsiveLayout();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={loading ? undefined : onDismiss}>
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={loading ? undefined : onDismiss}
          accessibilityRole="button"
          accessibilityLabel={t.deleteDialog.dismissLabel}
        />

        <View style={[styles.card, { maxHeight: dialogMaxHeight }]} accessibilityViewIsModal>
          <ScrollView
            style={styles.cardScroll}
            contentContainerStyle={styles.cardContent}
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons name="trash-can-outline" size={28} color={amraleColors.error} />
            </View>

            <Text style={styles.title}>{t.deleteDialog.title}</Text>
            <Text style={styles.message}>
              {t.deleteDialog.messageBefore}
              <Text style={styles.messageBold}>{name}</Text>
              {t.deleteDialog.messageAfter}
            </Text>

            {errorMessage ? (
              <Text style={styles.errorText} accessibilityLiveRegion="polite">
                {errorMessage}
              </Text>
            ) : null}

            <View style={styles.primaryWrap}>
              {loading ? (
                <View style={styles.loadingBtn}>
                  <ActivityIndicator color={amraleColors.white} />
                </View>
              ) : (
                <AuthPrimaryButton label={tc.actions.delete} onPress={onConfirm} variant="filled" compact />
              )}
            </View>

            <Pressable
              onPress={onDismiss}
              disabled={loading}
              style={({ pressed }) => [styles.cancelBtn, pressed && !loading && styles.cancelPressed]}
              accessibilityRole="button"
              accessibilityLabel={t.deleteDialog.cancelLabel}
            >
              <Text style={[styles.cancelText, loading && styles.cancelDisabled]}>{tc.actions.cancel}</Text>
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
    backgroundColor: 'rgba(26, 43, 75, 0.52)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: amraleColors.white,
    borderRadius: amraleRadius.xxl,
    shadowColor: amraleColors.text,
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
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: amraleSpacing.md,
  },
  title: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 22,
    color: amraleColors.text,
    textAlign: 'center',
    marginBottom: amraleSpacing.sm,
  },
  message: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 15,
    lineHeight: 22,
    color: amraleColors.textMuted,
    textAlign: 'center',
    marginBottom: amraleSpacing.lg,
    paddingHorizontal: amraleSpacing.xs,
  },
  messageBold: {
    fontFamily: amraleTypography.fontFamily.bold,
    color: amraleColors.text,
  },
  errorText: {
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 13,
    lineHeight: 19,
    color: amraleColors.error,
    textAlign: 'center',
    marginTop: -amraleSpacing.sm,
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
    backgroundColor: amraleColors.blue,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: amraleColors.blue,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  cancelBtn: {
    width: '100%',
    minHeight: 52,
    borderRadius: amraleRadius.lg,
    backgroundColor: amraleColors.inputBgLight,
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
    color: amraleColors.textMuted,
    textAlign: 'center',
  },
  cancelDisabled: {
    opacity: 0.5,
  },
});
