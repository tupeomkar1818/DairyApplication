import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthPrimaryButton } from '@/src/components/auth/AuthPrimaryButton';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';

export type DeleteCustomerConfirmDialogProps = {
  visible: boolean;
  customerName: string;
  onDismiss: () => void;
  onConfirm: () => void;
  loading?: boolean;
};

export function DeleteCustomerConfirmDialog({
  visible,
  customerName,
  onDismiss,
  onConfirm,
  loading = false,
}: DeleteCustomerConfirmDialogProps) {
  const name = customerName.trim() || 'this customer';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={loading ? undefined : onDismiss}>
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={loading ? undefined : onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss delete customer dialog"
        />

        <View style={styles.card} accessibilityViewIsModal>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="trash-can-outline" size={28} color={amraleColors.error} />
          </View>

          <Text style={styles.title}>Delete customer?</Text>
          <Text style={styles.message}>
            {"Are you sure you want to delete '"}
            <Text style={styles.messageBold}>{name}</Text>
            {"'? This action cannot be undone."}
          </Text>

          <View style={styles.primaryWrap}>
            {loading ? (
              <View style={styles.loadingBtn}>
                <ActivityIndicator color={amraleColors.white} />
              </View>
            ) : (
              <AuthPrimaryButton label="Delete" onPress={onConfirm} variant="filled" compact />
            )}
          </View>

          <Pressable
            onPress={onDismiss}
            disabled={loading}
            style={({ pressed }) => [styles.cancelBtn, pressed && !loading && styles.cancelPressed]}
            accessibilityRole="button"
            accessibilityLabel="Cancel delete customer"
          >
            <Text style={[styles.cancelText, loading && styles.cancelDisabled]}>Cancel</Text>
          </Pressable>
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 43, 75, 0.52)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: amraleColors.white,
    borderRadius: amraleRadius.xxl,
    paddingHorizontal: amraleSpacing.lg,
    paddingTop: amraleSpacing.xl,
    paddingBottom: amraleSpacing.lg,
    alignItems: 'center',
    shadowColor: amraleColors.text,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 8,
    zIndex: 1,
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
