import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { create } from 'zustand';

import type { LogoutConfirmDialogProps } from '@/src/components/auth/LogoutConfirmDialog';

import type {
  AuthSessionResponse,
  LoginRequest,
  LoginResponse,
  RequestOtpRequest,
  RequestOtpResponse,
  SetPinRequest,
  VerifyOtpRequest,
  VerifyOtpResponse,
} from '@/src/domain/auth/dtos';
import { strings } from '@/src/i18n/strings';
import { services } from '@/src/infrastructure/service-registry';

type AuthState = {
  session: AuthSessionResponse | null;
  setSession: (session: AuthSessionResponse | null) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  setSession: (session) => set({ session }),
}));

const AUTH_SESSION_QUERY_KEY = ['auth', 'session'] as const;

export function useAuthSession() {
  const setSession = useAuthStore((s) => s.setSession);
  return useQuery({
    queryKey: AUTH_SESSION_QUERY_KEY,
    queryFn: async () => {
      const session = await services.auth.getSession();
      setSession(session);
      return session;
    },
    staleTime: 30_000,
  });
}

/**
 * Signing in with a number and a PIN — or, the first time, with their own mobile number, which is when
 * `mustSetPin` comes back true and the app asks them to choose one.
 */
export function useLogin() {
  const qc = useQueryClient();
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation<LoginResponse, unknown, LoginRequest>({
    mutationFn: (data) => services.auth.login(data),
    onSuccess: (res) => {
      // Never show a previous user's cached profile to the newly signed-in user.
      qc.removeQueries({ queryKey: ['profile'] });
      qc.setQueryData<AuthSessionResponse | null>(AUTH_SESSION_QUERY_KEY, res.session);
      setSession(res.session);
    },
  });
}

/** Choosing the first PIN, or changing one. */
export function useSetPin() {
  return useMutation<void, unknown, SetPinRequest>({
    mutationFn: (data) => services.auth.setPin(data),
  });
}

/** The dairy forgets somebody's PIN for them, so they can sign in with their own number again. */
export function useResetPin() {
  return useMutation<void, unknown, string>({
    mutationFn: (mobileNumber) => services.auth.resetPin(mobileNumber),
  });
}

export function useRequestOtp() {
  return useMutation<RequestOtpResponse, unknown, RequestOtpRequest>({
    mutationFn: (data) => services.auth.requestOtp(data),
  });
}

export function useVerifyOtp() {
  const qc = useQueryClient();
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation<VerifyOtpResponse, unknown, VerifyOtpRequest>({
    mutationFn: (data) => services.auth.verifyOtp(data),
    onSuccess: (res) => {
      // Never show a previous user's cached profile to the newly signed-in user.
      qc.removeQueries({ queryKey: ['profile'] });
      // Seed the session directly: route guards / dashboards mount with refetchOnMount:false and would
      // otherwise keep the pre-login `null` (an invalidate while unobserved does not refetch).
      qc.setQueryData<AuthSessionResponse | null>(AUTH_SESSION_QUERY_KEY, res.session);
      setSession(res.session);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation<void, unknown, void>({
    mutationFn: () => services.auth.logout(),
    onSuccess: () => {
      // Drop every cached query (profile, dashboards, lists) so the next user starts clean.
      qc.clear();
      qc.setQueryData<AuthSessionResponse | null>(AUTH_SESSION_QUERY_KEY, null);
      setSession(null);
    },
  });
}

export function useConfirmLogout() {
  const { mutateAsync: logoutAsync, isPending: isLoggingOut } = useLogout();
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmLogout = useCallback(() => {
    setError(null);
    setVisible(true);
  }, []);

  const dismissLogout = useCallback(() => {
    if (isLoggingOut) return;
    setVisible(false);
    setError(null);
  }, [isLoggingOut]);

  const handleConfirm = useCallback(async () => {
    setError(null);
    try {
      await logoutAsync();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : strings('auth').logout.failed);
      return;
    }
    setVisible(false);
    router.replace('/(auth)/login');
  }, [logoutAsync]);

  const logoutDialogProps: LogoutConfirmDialogProps = {
    visible,
    onDismiss: dismissLogout,
    onConfirm: () => {
      void handleConfirm();
    },
    loading: isLoggingOut,
    error,
  };

  return { confirmLogout, isLoggingOut, logoutDialogProps };
}
