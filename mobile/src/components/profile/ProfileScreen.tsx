import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { AppSnackbar } from '@/src/components/shared/AppSnackbar';
import { useResponsiveContainerMaxWidth, useResponsiveContainerStyle } from '@/src/components/shared/ResponsiveContainer';
import { useScreenSafeInsets } from '@/src/hooks/useScreenSafeInsets';

import { MobileNumberField } from '@/src/components/auth/MobileNumberField';
import { ScreenHeader } from '@/src/components/shared';
import { ProfileField } from '@/src/components/profile/ProfileField';
import { ProfileLanguageCard } from '@/src/components/profile/ProfileLanguageCard';
import { ProfileSectionCard } from '@/src/components/profile/ProfileSectionCard';
import { ProfileOtpVerifyModal } from '@/src/components/profile/ProfileOtpVerifyModal';
import { mapDomainErrorMessage } from '@/src/components/profile/profileOtpUtils';
import { usePickProfileAvatar } from '@/src/components/profile/usePickProfileAvatar';
import type { UpdateProfileRequest } from '@/src/domain/profile/dtos';
import type { UserProfile } from '@/src/domain/profile/entities';
import type { UserRole } from '@/src/domain/shared/enums';
import { DomainError } from '@/src/domain/shared/errors';
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
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography, dairyTactileColors } from '@/src/theme/dairyTactile';
import { platformShadow } from '@/src/theme/platformStyles';

type MobileStep = 'idle' | 'old_otp' | 'new_input' | 'new_otp';

/** From here the short address fields (flat, society) sit side by side. */
const TWO_FIELD_ROW_MIN_WIDTH = 560;

const HOME_BY_ROLE: Record<UserRole, string> = {
  admin: '/(admin)',
  customer: '/(customer)',
  delivery_boy: '/(delivery)',
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

export function ProfileScreen() {
  const t = useStrings('profile');
  const c = useStrings('common');
  const { headerPaddingTop, bottom } = useScreenSafeInsets();
  const { width } = useWindowDimensions();
  // Full width on phones; a centered 760px reading column on tablets/desktops.
  const readingContainerStyle = useResponsiveContainerStyle('reading');
  // The header title lines up with the same column instead of the window's left edge.
  const readingMaxWidth = useResponsiveContainerMaxWidth('reading');
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
  const [newMobileError, setNewMobileError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);

  const { pickAvatar, isUpdating: isAvatarUpdating } = usePickProfileAvatar({
    onSuccess: () => setSnack(t.snack.photoUpdated),
    onError: (message) => setSnack(message),
  });

  const seededUserIdRef = useRef<string | null>(null);

  const seedForm = useCallback((p: UserProfile) => {
    setDisplayName(p.displayName);
    setAddress(p.address ?? '');
    setSocietyName(p.societyName ?? '');
    setHouseFlatNumber(p.houseFlatNumber ?? '');
    setAlternateMobile(p.alternateMobile ?? '');
    setEmergencyContactName(p.emergencyContactName ?? '');
    setEmergencyContactNumber(p.emergencyContactNumber ?? '');
  }, []);

  useEffect(() => {
    // Seed once per signed-in user: refetches (e.g. after an avatar change) must not wipe unsaved edits.
    // After a successful save the form is re-seeded explicitly from the saved profile.
    if (!profile || seededUserIdRef.current === profile.userId) return;
    seededUserIdRef.current = profile.userId;
    seedForm(profile);
  }, [profile, seedForm]);

  // Blank strings are sent as-is so the service can tell "cleared" ('') from "not sent" (undefined).
  const formPayload = useMemo(
    (): UpdateProfileRequest => ({
      displayName,
      address,
      societyName,
      houseFlatNumber,
      alternateMobile,
      emergencyContactName,
      emergencyContactNumber,
    }),
    [address, alternateMobile, displayName, emergencyContactName, emergencyContactNumber, houseFlatNumber, societyName],
  );

  /** Something differs from what is saved — the save bar only appears then. */
  const isDirty = useMemo(() => {
    if (!profile) return false;
    const saved: Record<Exclude<keyof UpdateProfileRequest, 'email'>, string> = {
      displayName: profile.displayName,
      address: profile.address ?? '',
      societyName: profile.societyName ?? '',
      houseFlatNumber: profile.houseFlatNumber ?? '',
      alternateMobile: profile.alternateMobile ?? '',
      emergencyContactName: profile.emergencyContactName ?? '',
      emergencyContactNumber: profile.emergencyContactNumber ?? '',
    };
    return (Object.keys(saved) as (keyof typeof saved)[]).some(
      (key) => String(formPayload[key] ?? '').trim() !== saved[key].trim(),
    );
  }, [formPayload, profile]);

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace((profile ? HOME_BY_ROLE[profile.role] : '/(auth)/login') as never);
  }, [profile]);

  const onRequestSaveOtp = async () => {
    setFieldError(null);
    setOtpError(null);
    const parsed = UpdateProfileRequestSchema.safeParse(formPayload);
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? t.errors.checkDetails);
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
      setSnack(mapDomainErrorMessage(e, t.errors.couldNotSendOtp));
    }
  };

  const onVerifySaveOtp = async (otp: string) => {
    setOtpError(null);
    const parsed = UpdateProfileWithOtpRequestSchema.safeParse({ ...formPayload, otp });
    if (!parsed.success) {
      setOtpError(t.errors.invalidOtpTryAgain);
      return;
    }
    try {
      const res = await updateProfile.mutateAsync(parsed.data);
      seedForm(res.profile);
      setSaveOtpVisible(false);
      setSnack(t.snack.profileUpdated);
    } catch (e) {
      setOtpError(mapDomainErrorMessage(e, t.errors.invalidOtpTryAgain));
    }
  };

  const onStartMobileChange = async () => {
    setOtpError(null);
    setNewMobileError(null);
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
      setSnack(mapDomainErrorMessage(e, t.errors.couldNotSendOtp));
    }
  };

  const onVerifyOldMobile = async (otp: string) => {
    setOtpError(null);
    const parsed = VerifyProfileOtpRequestSchema.safeParse({ otp });
    if (!parsed.success) {
      setOtpError(t.errors.invalidOtpTryAgain);
      return;
    }
    try {
      await verifyOldOtp.mutateAsync(parsed.data);
      setMobileStep('new_input');
      setOtpError(null);
      setSnack(t.snack.currentVerified);
    } catch (e) {
      setOtpError(mapDomainErrorMessage(e, t.errors.invalidOtpTryAgain));
    }
  };

  const onSendNewMobileOtp = async () => {
    setOtpError(null);
    setNewMobileError(null);
    const parsed = RequestNewMobileOtpRequestSchema.safeParse({ newMobileNumber: newMobile });
    if (!parsed.success) {
      setNewMobileError(parsed.error.issues[0]?.message ?? t.errors.enterValidMobile);
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
      setSnack(mapDomainErrorMessage(e, t.errors.couldNotSendNewOtp));
    }
  };

  const onVerifyNewMobile = async (otp: string) => {
    setOtpError(null);
    const parsed = VerifyNewMobileRequestSchema.safeParse({ newMobileNumber: newMobile, otp });
    if (!parsed.success) {
      setOtpError(t.errors.invalidOtpTryAgain);
      return;
    }
    try {
      await verifyNewMobile.mutateAsync(parsed.data);
      setMobileStep('idle');
      setOtpError(null);
      setSnack(t.snack.mobileUpdated);
    } catch (e) {
      setOtpError(mapDomainErrorMessage(e, t.errors.invalidOtpTryAgain));
    }
  };

  const cancelMobileChange = () => {
    setMobileStep('idle');
    setOtpError(null);
    setNewMobileError(null);
    setOldDemoOtp(undefined);
    setNewDemoOtp(undefined);
    setNewMobile('');
  };

  if (!profile) {
    if (profileQuery.isError) {
      const loadError = profileQuery.error;
      if (loadError instanceof DomainError && loadError.code === 'SESSION_NOT_FOUND') {
        return <Redirect href="/(auth)/login" />;
      }
      return (
        <View style={styles.screen}>
          <ScreenHeader
            title={t.title}
            onBack={goBack}
            paddingTop={headerPaddingTop}
            titleColor={amraleColors.blue}
            backIconColor={amraleColors.blue}
            showBorder={false}
            style={styles.header}
            contentMaxWidth={readingMaxWidth}
          />
          <View style={[styles.centered, styles.errorState]}>
            <MaterialCommunityIcons name="alert-circle-outline" size={40} color={amraleColors.error} />
            <Text style={styles.errorTitle}>{t.loadErrorTitle}</Text>
            <Text style={styles.errorBody}>{mapDomainErrorMessage(loadError, c.errors.generic)}</Text>
            <Pressable
              onPress={() => {
                void profileQuery.refetch();
              }}
              disabled={profileQuery.isFetching}
              style={({ pressed }) => [
                styles.secondaryBtn,
                styles.retryBtn,
                pressed && styles.pressed,
                profileQuery.isFetching && styles.disabled,
              ]}
              accessibilityRole="button"
            >
              {profileQuery.isFetching ? (
                <ActivityIndicator color={amraleColors.blue} />
              ) : (
                <Text style={styles.secondaryBtnText}>{t.retry}</Text>
              )}
            </Pressable>
          </View>
        </View>
      );
    }
    return (
      <View style={[styles.centered, styles.screen, { paddingTop: headerPaddingTop }]}>
        <ActivityIndicator color={amraleColors.blue} size="large" />
      </View>
    );
  }

  const isCustomer = profile.role === 'customer';
  const isDelivery = profile.role === 'delivery_boy';
  const twoFieldRow = width >= TWO_FIELD_ROW_MIN_WIDTH;
  const showSaveBar = mobileStep === 'idle' && (isDirty || !!fieldError);

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

  const discardChanges = () => {
    seedForm(profile);
    setFieldError(null);
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerPaddingTop}
    >
      <ScreenHeader
        title={t.title}
        onBack={goBack}
        paddingTop={headerPaddingTop}
        titleColor={amraleColors.blue}
        backIconColor={amraleColors.blue}
        showBorder={false}
        style={styles.header}
            contentMaxWidth={readingMaxWidth}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          readingContainerStyle,
          // Room for the save bar when it is showing, so the last field never hides behind it.
          { paddingBottom: (showSaveBar ? 120 : 32) + bottom },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Who is signed in: photo, name, account type and the number they sign in with. */}
        <View style={styles.hero}>
          <View style={styles.avatarShell}>
            {profile.avatarUri ? (
              <Image source={{ uri: profile.avatarUri }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitials}>{initialsOf(profile.displayName)}</Text>
              </View>
            )}
            <Pressable
              onPress={pickAvatar}
              disabled={isAvatarUpdating}
              hitSlop={8}
              style={({ pressed }) => [styles.cameraBtn, pressed && !isAvatarUpdating && styles.pressed, isAvatarUpdating && styles.disabled]}
              accessibilityRole="button"
              accessibilityLabel={t.changePhoto}
            >
              {isAvatarUpdating ? (
                <ActivityIndicator size="small" color={amraleColors.white} />
              ) : (
                <MaterialCommunityIcons name="camera" size={15} color={amraleColors.white} />
              )}
            </Pressable>
          </View>
          <View style={styles.heroText}>
            <Text style={styles.heroName} numberOfLines={2}>
              {profile.displayName}
            </Text>
            <View style={styles.heroMetaRow}>
              <View style={styles.roleBadge}>
                <MaterialCommunityIcons
                  name={isCustomer ? 'account-heart-outline' : isDelivery ? 'truck-delivery-outline' : 'shield-account-outline'}
                  size={14}
                  color={amraleColors.blue}
                />
                <Text style={styles.roleBadgeText}>{t.roles[profile.role] ?? profile.roleLabel}</Text>
              </View>
            </View>
            <View style={styles.heroPhoneRow}>
              <MaterialCommunityIcons name="phone-outline" size={15} color={amraleColors.textMuted} />
              <Text style={styles.heroPhone}>{profile.mobileNumberFormatted}</Text>
            </View>
          </View>
        </View>

        <ProfileLanguageCard />

        <ProfileSectionCard icon="account-outline" title={t.personal.title}>
          <ProfileField
            label={t.personal.fullName}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder={t.personal.namePlaceholder}
            autoCapitalize="words"
          />
        </ProfileSectionCard>

        <ProfileSectionCard
          icon="cellphone"
          title={t.mobile.title}
          subtitle={t.mobile.subtitle}
        >
          <View style={styles.mobileRow}>
            <View style={styles.mobileIcon}>
              <MaterialCommunityIcons name="cellphone-lock" size={20} color={amraleColors.blue} />
            </View>
            <View style={styles.mobileText}>
              <Text style={styles.mobileLabel}>{t.mobile.signInNumber}</Text>
              <Text style={styles.mobileValue}>{profile.mobileNumberFormatted}</Text>
            </View>
            {mobileStep === 'idle' ? (
              <Pressable
                onPress={onStartMobileChange}
                disabled={requestOldOtp.isPending}
                style={({ pressed }) => [styles.changeBtn, pressed && styles.pressed, requestOldOtp.isPending && styles.disabled]}
                accessibilityRole="button"
                accessibilityLabel={t.mobile.changeLabel}
              >
                <Text style={styles.changeBtnText}>{c.actions.change}</Text>
              </Pressable>
            ) : null}
          </View>

          {mobileStep === 'new_input' ? (
            <View style={styles.newMobileBox}>
              <MobileNumberField
                value={newMobile}
                onChangeText={setNewMobile}
                variant="light"
                showLabel
                label={t.mobile.newLabel}
                fieldName="profile-new-mobile"
                error={newMobileError}
              />
              <View style={styles.buttonRow}>
                <Pressable
                  onPress={cancelMobileChange}
                  style={({ pressed }) => [styles.secondaryBtn, styles.buttonFlex, pressed && styles.pressed]}
                  accessibilityRole="button"
                >
                  <Text style={styles.secondaryBtnText}>{c.actions.cancel}</Text>
                </Pressable>
                <Pressable
                  onPress={onSendNewMobileOtp}
                  disabled={requestNewOtp.isPending}
                  style={({ pressed }) => [styles.primaryBtn, styles.buttonFlex, pressed && styles.pressed, requestNewOtp.isPending && styles.disabled]}
                  accessibilityRole="button"
                >
                  {requestNewOtp.isPending ? (
                    <ActivityIndicator color={amraleColors.white} />
                  ) : (
                    <Text style={styles.primaryBtnText}>{t.mobile.sendOtp}</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : null}

          {isCustomer || isDelivery ? (
            <MobileNumberField
              value={alternateMobile}
              onChangeText={setAlternateMobile}
              variant="light"
              showLabel
              label={t.mobile.alternateLabel}
              fieldName="profile-alternate-mobile"
              autoComplete="off"
              error={null}
            />
          ) : null}
        </ProfileSectionCard>

        {isCustomer ? (
          <ProfileSectionCard icon="home-outline" title={t.customerAddress.title} subtitle={t.customerAddress.subtitle}>
            <View style={[styles.fieldRow, twoFieldRow && styles.fieldRowWide]}>
              <View style={twoFieldRow ? styles.fieldHalf : undefined}>
                <ProfileField
                  label={t.customerAddress.flat}
                  value={houseFlatNumber}
                  onChangeText={setHouseFlatNumber}
                  placeholder={t.customerAddress.flatPlaceholder}
                />
              </View>
              <View style={twoFieldRow ? styles.fieldHalf : undefined}>
                <ProfileField
                  label={t.customerAddress.society}
                  value={societyName}
                  onChangeText={setSocietyName}
                  placeholder={t.customerAddress.societyPlaceholder}
                />
              </View>
            </View>
            <ProfileField
              label={c.fields.address}
              value={address}
              onChangeText={setAddress}
              multiline
              placeholder={t.customerAddress.addressPlaceholder}
              style={styles.multiline}
            />
          </ProfileSectionCard>
        ) : null}

        {isDelivery ? (
          <>
            <ProfileSectionCard icon="home-outline" title={t.deliveryAddress.title}>
              <ProfileField
                label={t.deliveryAddress.homeAddress}
                value={address}
                onChangeText={setAddress}
                multiline
                placeholder={t.deliveryAddress.placeholder}
                style={styles.multiline}
              />
            </ProfileSectionCard>
            <ProfileSectionCard
              icon="account-alert-outline"
              title={t.emergency.title}
              subtitle={t.emergency.subtitle}
            >
              <ProfileField
                label={c.fields.name}
                value={emergencyContactName}
                onChangeText={setEmergencyContactName}
                placeholder={t.emergency.namePlaceholder}
                autoCapitalize="words"
              />
              <MobileNumberField
                value={emergencyContactNumber}
                onChangeText={setEmergencyContactNumber}
                variant="light"
                showLabel
                label={c.fields.mobileNumber}
                fieldName="profile-emergency-mobile"
                autoComplete="off"
                error={null}
              />
            </ProfileSectionCard>
          </>
        ) : null}
      </ScrollView>

      {showSaveBar ? (
        <View style={[styles.saveBar, { paddingBottom: amraleSpacing.sm + bottom }]}>
          <View style={[styles.saveBarInner, readingContainerStyle]}>
            <View style={styles.saveBarText}>
              {fieldError ? (
                <Text style={styles.inlineError} accessibilityLiveRegion="polite">
                  {fieldError}
                </Text>
              ) : (
                <Text style={styles.saveBarHint}>{t.saveBar.hint}</Text>
              )}
            </View>
            <View style={styles.buttonRow}>
              <Pressable
                onPress={discardChanges}
                disabled={requestSaveOtp.isPending}
                style={({ pressed }) => [styles.secondaryBtn, styles.buttonFlex, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Text style={styles.secondaryBtnText}>{t.saveBar.discard}</Text>
              </Pressable>
              <Pressable
                onPress={onRequestSaveOtp}
                disabled={requestSaveOtp.isPending || !isDirty}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  styles.buttonFlex,
                  pressed && styles.pressed,
                  (requestSaveOtp.isPending || !isDirty) && styles.disabled,
                ]}
                accessibilityRole="button"
              >
                {requestSaveOtp.isPending ? (
                  <ActivityIndicator color={amraleColors.white} />
                ) : (
                  <Text style={styles.primaryBtnText}>{c.actions.saveChanges}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

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
        sectionTitle={isOldMobileOtpStep ? t.verify.currentTitle : t.verify.newTitle}
        hint={
          isOldMobileOtpStep ? t.verify.currentHint : t.verify.newHint
        }
        submitLabel={isOldMobileOtpStep ? t.verify.currentTitle : t.verify.confirmNew}
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
  errorState: { paddingHorizontal: amraleSpacing.lg, gap: 10 },
  errorTitle: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 18,
    color: amraleColors.text,
    textAlign: 'center',
  },
  errorBody: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: amraleColors.textMuted,
    textAlign: 'center',
  },
  // Full width on phones, capped (and centered) instead of spanning a desktop window.
  retryBtn: { alignSelf: 'center', width: '100%', maxWidth: 360, marginTop: amraleSpacing.sm },
  header: {
    paddingBottom: amraleSpacing.sm,
    backgroundColor: amraleColors.surface,
  },
  scroll: { paddingHorizontal: amraleSpacing.md, paddingTop: amraleSpacing.xs, gap: amraleSpacing.md },

  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: amraleSpacing.md,
    padding: amraleSpacing.md,
    borderRadius: amraleRadius.xl,
    borderWidth: 1,
    borderColor: dairyTactileColors.outlineVariant,
    backgroundColor: amraleColors.white,
  },
  avatarShell: { position: 'relative' },
  avatarImage: { width: 76, height: 76, borderRadius: 38 },
  avatarFallback: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: dairyTactileColors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 28, color: amraleColors.blue },
  cameraBtn: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: amraleColors.blue,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: amraleColors.white,
  },
  heroText: { flex: 1, minWidth: 0, gap: 6 },
  heroName: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 20,
    lineHeight: 26,
    color: amraleColors.text,
  },
  heroMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: amraleRadius.pill,
    backgroundColor: dairyTactileColors.surfaceContainer,
  },
  roleBadgeText: {
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 12,
    color: amraleColors.blue,
  },
  heroPhoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroPhone: {
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 14,
    color: amraleColors.textMuted,
  },

  mobileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: amraleSpacing.sm,
    padding: 12,
    borderRadius: amraleRadius.lg,
    backgroundColor: dairyTactileColors.surfaceContainerLow,
  },
  mobileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: amraleColors.white,
  },
  mobileText: { flex: 1, minWidth: 0, gap: 2 },
  mobileLabel: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 12, color: amraleColors.textMuted },
  mobileValue: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 16, color: amraleColors.text },
  changeBtn: {
    minHeight: 40,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: amraleRadius.pill,
    borderWidth: 1.5,
    borderColor: amraleColors.blue,
    backgroundColor: amraleColors.white,
  },
  changeBtnText: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 13, color: amraleColors.blue },
  newMobileBox: {
    gap: amraleSpacing.sm,
    padding: 12,
    borderRadius: amraleRadius.lg,
    borderWidth: 1,
    borderColor: dairyTactileColors.outlineVariant,
  },

  fieldRow: { gap: amraleSpacing.md },
  fieldRowWide: { flexDirection: 'row' },
  fieldHalf: { flex: 1, minWidth: 0 },
  multiline: { minHeight: 88, textAlignVertical: 'top' },

  inlineError: {
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 13,
    color: amraleColors.error,
  },

  saveBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: amraleSpacing.sm,
    paddingHorizontal: amraleSpacing.md,
    borderTopWidth: 1,
    borderTopColor: dairyTactileColors.outlineVariant,
    backgroundColor: amraleColors.white,
    ...platformShadow({ shadowColor: '#0b1d2d', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -4 } }),
  },
  saveBarInner: { gap: amraleSpacing.sm },
  saveBarText: { minHeight: 18 },
  saveBarHint: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 13, color: amraleColors.textMuted },

  buttonRow: { flexDirection: 'row', gap: amraleSpacing.sm },
  buttonFlex: { flex: 1 },
  primaryBtn: {
    minHeight: 48,
    borderRadius: amraleRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: amraleSpacing.md,
    backgroundColor: amraleColors.blue,
  },
  primaryBtnText: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 15, color: amraleColors.white },
  secondaryBtn: {
    minHeight: 48,
    borderRadius: amraleRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: amraleSpacing.md,
    borderWidth: 1.5,
    borderColor: dairyTactileColors.outlineVariant,
    backgroundColor: amraleColors.white,
  },
  secondaryBtnText: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 15, color: amraleColors.text },
  pressed: { opacity: 0.88 },
  disabled: { opacity: 0.55 },
});
