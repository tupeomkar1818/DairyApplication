import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AppSnackbar } from '@/src/components/shared/AppSnackbar';
import { useScreenSafeInsets } from '@/src/hooks/useScreenSafeInsets';

import { MobileNumberField } from '@/src/components/auth/MobileNumberField';
import { ScreenHeader } from '@/src/components/shared';
import { ProfileField } from '@/src/components/profile/ProfileField';
import { ProfileMobileDisplay } from '@/src/components/profile/ProfileMobileDisplay';
import { ProfileSectionCard } from '@/src/components/profile/ProfileSectionCard';
import { ProfileOtpVerifyModal } from '@/src/components/profile/ProfileOtpVerifyModal';
import { mapDomainErrorMessage } from '@/src/components/profile/profileOtpUtils';
import { usePickProfileAvatar } from '@/src/components/profile/usePickProfileAvatar';
import type { UpdateProfileRequest } from '@/src/domain/profile/dtos';
import {
  RequestNewMobileOtpRequestSchema,
  UpdateProfileRequestSchema,
  UpdateProfileWithOtpRequestSchema,
  VerifyNewMobileRequestSchema,
  VerifyProfileOtpRequestSchema,
} from '@/src/domain/profile/validations';
import {
  useMyProfile,
  useRequestNewMobileOtp,
  useRequestOldMobileOtp,
  useRequestProfileSaveOtp,
  useUpdateProfileWithOtp,
  useVerifyNewMobileAndUpdate,
  useVerifyOldMobileOtp,
} from '@/src/hooks/profile';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';

type MobileStep = 'idle' | 'old_otp' | 'new_input' | 'new_otp';

export function ProfileScreen() {
  const { headerPaddingTop, scrollPaddingBottom } = useScreenSafeInsets();
  const profileQuery = useMyProfile();

  const requestSaveOtp = useRequestProfileSaveOtp();
  const updateProfile = useUpdateProfileWithOtp();
  const requestOldOtp = useRequestOldMobileOtp();
  const verifyOldOtp = useVerifyOldMobileOtp();
  const requestNewOtp = useRequestNewMobileOtp();
  const verifyNewMobile = useVerifyNewMobileAndUpdate();

  const profile = profileQuery.data?.profile;

  const [displayName, setDisplayName] = useState('');
  const [address, setAddress] = useState('');
  const [societyName, setSocietyName] = useState('');
  const [houseFlatNumber, setHouseFlatNumber] = useState('');
  const [alternateMobile, setAlternateMobile] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactNumber, setEmergencyContactNumber] = useState('');
  const [newMobile, setNewMobile] = useState('');

  const [saveOtpVisible, setSaveOtpVisible] = useState(false);
  const [saveDemoOtp, setSaveDemoOtp] = useState<string | undefined>();
  const [saveOtpExpiryAt, setSaveOtpExpiryAt] = useState<string | undefined>();
  const [saveResendAvailableAt, setSaveResendAvailableAt] = useState<string | undefined>();
  const [saveVerifyKey, setSaveVerifyKey] = useState(0);

  const [mobileStep, setMobileStep] = useState<MobileStep>('idle');
  const [oldDemoOtp, setOldDemoOtp] = useState<string | undefined>();
  const [oldOtpExpiryAt, setOldOtpExpiryAt] = useState<string | undefined>();
  const [oldResendAvailableAt, setOldResendAvailableAt] = useState<string | undefined>();
  const [newDemoOtp, setNewDemoOtp] = useState<string | undefined>();
  const [newOtpExpiryAt, setNewOtpExpiryAt] = useState<string | undefined>();
  const [newResendAvailableAt, setNewResendAvailableAt] = useState<string | undefined>();
  const [mobileVerifyKey, setMobileVerifyKey] = useState(0);

  const [snack, setSnack] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);

  const { pickAvatar, isUpdating: isAvatarUpdating } = usePickProfileAvatar({
    onSuccess: () => setSnack('Profile photo updated'),
    onError: (message) => setSnack(message),
  });

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName);
    setAddress(profile.address ?? '');
    setSocietyName(profile.societyName ?? '');
    setHouseFlatNumber(profile.houseFlatNumber ?? '');
    setAlternateMobile(profile.alternateMobile ?? '');
    setEmergencyContactName(profile.emergencyContactName ?? '');
    setEmergencyContactNumber(profile.emergencyContactNumber ?? '');
  }, [profile]);

  const formPayload = useMemo(
    (): UpdateProfileRequest => ({
      displayName,
      address: address || undefined,
      societyName: societyName || undefined,
      houseFlatNumber: houseFlatNumber || undefined,
      alternateMobile: alternateMobile || undefined,
      emergencyContactName: emergencyContactName || undefined,
      emergencyContactNumber: emergencyContactNumber || undefined,
    }),
    [address, alternateMobile, displayName, emergencyContactName, emergencyContactNumber, houseFlatNumber, societyName],
  );

  const roleBadgeText = profile?.roleLabel.toUpperCase() ?? '';

  const onRequestSaveOtp = async () => {
    setFieldError(null);
    setOtpError(null);
    const parsed = UpdateProfileRequestSchema.safeParse(formPayload);
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? 'Check your details');
      return;
    }
    try {
      const res = await requestSaveOtp.mutateAsync();
      setSaveDemoOtp(res.demoOtp);
      setSaveOtpExpiryAt(res.otpExpiryAt);
      setSaveResendAvailableAt(res.resendAvailableAt);
      setSaveVerifyKey((k) => k + 1);
      setSaveOtpVisible(true);
    } catch (e) {
      setSnack(mapDomainErrorMessage(e, 'Could not send OTP'));
    }
  };

  const onVerifySaveOtp = async (otp: string) => {
    setOtpError(null);
    const parsed = UpdateProfileWithOtpRequestSchema.safeParse({ ...formPayload, otp });
    if (!parsed.success) {
      setOtpError('Invalid OTP entered. Please try again.');
      return;
    }
    try {
      await updateProfile.mutateAsync(parsed.data);
      setSaveOtpVisible(false);
      setSnack('Profile updated successfully');
    } catch (e) {
      setOtpError(mapDomainErrorMessage(e, 'Invalid OTP entered. Please try again.'));
    }
  };

  const onStartMobileChange = async () => {
    setOtpError(null);
    setMobileStep('old_otp');
    setNewMobile('');
    try {
      const res = await requestOldOtp.mutateAsync();
      setOldDemoOtp(res.demoOtp);
      setOldOtpExpiryAt(res.otpExpiryAt);
      setOldResendAvailableAt(res.resendAvailableAt);
      setMobileVerifyKey((k) => k + 1);
    } catch (e) {
      setMobileStep('idle');
      setSnack(mapDomainErrorMessage(e, 'Could not send OTP'));
    }
  };

  const onVerifyOldMobile = async (otp: string) => {
    setOtpError(null);
    const parsed = VerifyProfileOtpRequestSchema.safeParse({ otp });
    if (!parsed.success) {
      setOtpError('Invalid OTP entered. Please try again.');
      return;
    }
    try {
      await verifyOldOtp.mutateAsync(parsed.data);
      setMobileStep('new_input');
      setOtpError(null);
      setSnack('Current mobile verified');
    } catch (e) {
      setOtpError(mapDomainErrorMessage(e, 'Invalid OTP entered. Please try again.'));
    }
  };

  const onSendNewMobileOtp = async () => {
    setOtpError(null);
    const parsed = RequestNewMobileOtpRequestSchema.safeParse({ newMobileNumber: newMobile });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? 'Enter a valid mobile number');
      return;
    }
    try {
      const res = await requestNewOtp.mutateAsync(parsed.data);
      setNewDemoOtp(res.demoOtp);
      setNewOtpExpiryAt(res.otpExpiryAt);
      setNewResendAvailableAt(res.resendAvailableAt);
      setMobileStep('new_otp');
      setMobileVerifyKey((k) => k + 1);
    } catch (e) {
      setSnack(mapDomainErrorMessage(e, 'Could not send OTP to new number'));
    }
  };

  const onVerifyNewMobile = async (otp: string) => {
    setOtpError(null);
    const parsed = VerifyNewMobileRequestSchema.safeParse({ newMobileNumber: newMobile, otp });
    if (!parsed.success) {
      setOtpError('Invalid OTP entered. Please try again.');
      return;
    }
    try {
      await verifyNewMobile.mutateAsync(parsed.data);
      setMobileStep('idle');
      setOtpError(null);
      setSnack('Mobile number updated successfully');
    } catch (e) {
      setOtpError(mapDomainErrorMessage(e, 'Invalid OTP entered. Please try again.'));
    }
  };

  const cancelMobileChange = () => {
    setMobileStep('idle');
    setOtpError(null);
    setOldDemoOtp(undefined);
    setNewDemoOtp(undefined);
    setNewMobile('');
  };

  if (profileQuery.isLoading || !profile) {
    return (
      <View style={[styles.centered, { paddingTop: headerPaddingTop }]}>
        <ActivityIndicator color={amraleColors.blue} size="large" />
      </View>
    );
  }

  const isCustomer = profile.role === 'customer';
  const isDelivery = profile.role === 'delivery_boy';

  const dismissSaveOtpModal = () => {
    if (updateProfile.isPending || requestSaveOtp.isPending) return;
    setSaveOtpVisible(false);
    setOtpError(null);
  };

  const mobileOtpModalVisible = mobileStep === 'old_otp' || mobileStep === 'new_otp';
  const isOldMobileOtpStep = mobileStep === 'old_otp';

  const dismissMobileOtpModal = () => {
    if (
      verifyOldOtp.isPending ||
      requestOldOtp.isPending ||
      verifyNewMobile.isPending ||
      requestNewOtp.isPending
    ) {
      return;
    }
    setOtpError(null);
    if (mobileStep === 'new_otp') {
      setMobileStep('new_input');
      return;
    }
    cancelMobileChange();
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerPaddingTop}
    >
      <ScreenHeader
        title="My Profile"
        onBack={() => router.back()}
        paddingTop={headerPaddingTop}
        titleColor={amraleColors.text}
        showBorder={false}
        style={styles.header}
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: scrollPaddingBottom(28) }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.avatarShell}>
            {profile.avatarUri ? (
              <Image source={{ uri: profile.avatarUri }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitials}>{profile.displayName.slice(0, 1).toUpperCase()}</Text>
              </View>
            )}
            <Pressable
              onPress={pickAvatar}
              disabled={isAvatarUpdating}
              style={({ pressed }) => [styles.cameraBtn, pressed && !isAvatarUpdating && styles.pressed, isAvatarUpdating && styles.disabled]}
              accessibilityRole="button"
              accessibilityLabel="Change profile photo"
            >
              {isAvatarUpdating ? (
                <ActivityIndicator size="small" color={amraleColors.white} />
              ) : (
                <MaterialCommunityIcons name="camera" size={16} color={amraleColors.white} />
              )}
            </Pressable>
          </View>
          <Text style={styles.heroName}>{profile.displayName}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{roleBadgeText}</Text>
          </View>
        </View>

        <ProfileSectionCard icon="account-outline" title="Personal details">
          <ProfileField label="Full name" value={displayName} onChangeText={setDisplayName} />

          <View style={styles.fieldBlock}>
            <View style={styles.labelRow}>
              <Text style={styles.fieldLabel}>Mobile Number</Text>
              {mobileStep === 'idle' ? (
                <Pressable onPress={onStartMobileChange} hitSlop={8}>
                  <Text style={styles.changeLink}>Change mobile number</Text>
                </Pressable>
              ) : null}
            </View>
            <ProfileMobileDisplay mobileFormatted={profile.mobileNumberFormatted} />
          </View>

          {(isCustomer || isDelivery) && (
            <>
              <ProfileField label="Address" value={address} onChangeText={setAddress} multiline />
              {isCustomer ? (
                <>
                  <ProfileField label="Society" value={societyName} onChangeText={setSocietyName} />
                  <ProfileField label="Flat / House" value={houseFlatNumber} onChangeText={setHouseFlatNumber} />
                </>
              ) : null}
              <MobileNumberField
                value={alternateMobile}
                onChangeText={setAlternateMobile}
                variant="light"
                showLabel
                error={null}
              />
              {isDelivery ? (
                <>
                  <ProfileField
                    label="Emergency contact name"
                    value={emergencyContactName}
                    onChangeText={setEmergencyContactName}
                  />
                  <MobileNumberField
                    value={emergencyContactNumber}
                    onChangeText={setEmergencyContactNumber}
                    variant="light"
                    showLabel
                    error={null}
                  />
                </>
              ) : null}
            </>
          )}

          {fieldError ? <Text style={styles.inlineError}>{fieldError}</Text> : null}

          {mobileStep === 'idle' ? (
            <Pressable
              onPress={onRequestSaveOtp}
              disabled={requestSaveOtp.isPending}
              style={({ pressed }) => [styles.outlineBtn, pressed && styles.pressed, requestSaveOtp.isPending && styles.disabled]}
            >
              {requestSaveOtp.isPending ? (
                <ActivityIndicator color={amraleColors.blue} />
              ) : (
                <Text style={styles.outlineBtnText}>Save changes</Text>
              )}
            </Pressable>
          ) : null}
        </ProfileSectionCard>

        {mobileStep === 'new_input' ? (
          <ProfileSectionCard icon="cellphone" title="New mobile number">
            <MobileNumberField value={newMobile} onChangeText={setNewMobile} variant="light" showLabel error={fieldError} />
            <Pressable
              onPress={onSendNewMobileOtp}
              disabled={requestNewOtp.isPending}
              style={({ pressed }) => [styles.outlineBtn, pressed && styles.pressed]}
            >
              {requestNewOtp.isPending ? (
                <ActivityIndicator color={amraleColors.blue} />
              ) : (
                <Text style={styles.outlineBtnText}>Send OTP to new number</Text>
              )}
            </Pressable>
            <Pressable onPress={cancelMobileChange} style={styles.cancelLink}>
              <Text style={styles.cancelLinkText}>Cancel mobile change</Text>
            </Pressable>
          </ProfileSectionCard>
        ) : null}

      </ScrollView>

      <ProfileOtpVerifyModal
        visible={saveOtpVisible}
        onDismiss={dismissSaveOtpModal}
        verifyKey={saveVerifyKey}
        otpExpiryAt={saveOtpExpiryAt}
        resendAvailableAt={saveResendAvailableAt}
        demoOtp={saveDemoOtp}
        error={otpError}
        submitting={updateProfile.isPending}
        resending={requestSaveOtp.isPending}
        onSubmit={onVerifySaveOtp}
        onResend={onRequestSaveOtp}
      />

      <ProfileOtpVerifyModal
        visible={mobileOtpModalVisible}
        onDismiss={dismissMobileOtpModal}
        verifyKey={mobileVerifyKey}
        otpExpiryAt={isOldMobileOtpStep ? oldOtpExpiryAt : newOtpExpiryAt}
        resendAvailableAt={isOldMobileOtpStep ? oldResendAvailableAt : newResendAvailableAt}
        demoOtp={isOldMobileOtpStep ? oldDemoOtp : newDemoOtp}
        error={otpError}
        submitting={isOldMobileOtpStep ? verifyOldOtp.isPending : verifyNewMobile.isPending}
        resending={isOldMobileOtpStep ? requestOldOtp.isPending : requestNewOtp.isPending}
        sectionTitle={isOldMobileOtpStep ? 'VERIFY CURRENT MOBILE' : 'VERIFY NEW MOBILE'}
        hint={
          isOldMobileOtpStep
            ? 'Enter the 6-digit code sent to your current mobile number.'
            : 'Enter the 6-digit code sent to your new mobile number.'
        }
        submitLabel={isOldMobileOtpStep ? 'VERIFY CURRENT MOBILE' : 'CONFIRM NEW MOBILE'}
        onSubmit={isOldMobileOtpStep ? onVerifyOldMobile : onVerifyNewMobile}
        onResend={isOldMobileOtpStep ? onStartMobileChange : onSendNewMobileOtp}
      />

      <AppSnackbar visible={!!snack} message={snack ?? ''} onDismiss={() => setSnack(null)} duration={3000} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: amraleColors.surface },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    paddingBottom: amraleSpacing.md,
    backgroundColor: amraleColors.surface,
  },
  scroll: { paddingHorizontal: amraleSpacing.md, gap: amraleSpacing.md },
  hero: { alignItems: 'center', paddingTop: amraleSpacing.sm, paddingBottom: amraleSpacing.xs, gap: 10 },
  avatarShell: { position: 'relative' },
  avatarImage: { width: 96, height: 96, borderRadius: 48 },
  avatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(53, 81, 161, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 36, color: amraleColors.blue },
  cameraBtn: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: amraleColors.blue,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: amraleColors.white,
  },
  heroName: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 24,
    color: amraleColors.text,
    textAlign: 'center',
  },
  roleBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: amraleRadius.pill,
    backgroundColor: amraleColors.blue,
  },
  roleBadgeText: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 11,
    color: amraleColors.white,
    letterSpacing: 0.6,
  },
  fieldBlock: { gap: 8 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  fieldLabel: {
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 13,
    color: amraleColors.textMuted,
  },
  changeLink: {
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 13,
    color: amraleColors.blue,
  },
  inlineError: {
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 13,
    color: amraleColors.error,
  },
  outlineBtn: {
    borderRadius: amraleRadius.lg,
    borderWidth: 1.5,
    borderColor: amraleColors.blue,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  outlineBtnText: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 14,
    color: amraleColors.blue,
    letterSpacing: 0.4,
  },
  pressed: { opacity: 0.88 },
  disabled: { opacity: 0.6 },
  cancelLink: { alignSelf: 'center', paddingVertical: 8 },
  cancelLinkText: {
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 14,
    color: amraleColors.textMuted,
  },
});
