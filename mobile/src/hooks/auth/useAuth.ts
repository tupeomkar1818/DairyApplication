import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { create } from 'zustand';

import type { LogoutConfirmDialogProps } from '@/src/components/auth/LogoutConfirmDialog';

import type { AuthSessionResponse, RequestOtpRequest, RequestOtpResponse, VerifyOtpRequest, VerifyOtpResponse } from '@/src/domain/auth/dtos';
import { services } from '@/src/infrastructure/service-registry';

type AuthState = {
  session: AuthSessionResponse | null;
  setSession: (session: AuthSessionResponse | null) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  setSession: (session) => set({ session }),
}));

export function useAuthSession() {
  const setSession = useAuthStore((s) => s.setSession);
  return useQuery({
    queryKey: ['auth', 'session'],
    queryFn: async () => {
      const session = await services.auth.getSession();
      setSession(session);
      return session;
    },
    staleTime: 30_000,
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
    onSuccess: async (res) => {
      setSession(res.session);
      await qc.invalidateQueries({ queryKey: ['auth', 'session'] });
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation<void, unknown, void>({
    mutationFn: () => services.auth.logout(),
    onSuccess: async () => {
      setSession(null);
      await qc.invalidateQueries({ queryKey: ['auth', 'session'] });
    },
  });
}

export function useConfirmLogout() {
  const logout = useLogout();
  const [visible, setVisible] = useState(false);

  const confirmLogout = useCallback(() => setVisible(true), []);

  const dismissLogout = useCallback(() => {
    if (!logout.isPending) setVisible(false);
  }, [logout.isPending]);

  const handleConfirm = useCallback(async () => {
    await logout.mutateAsync();
    setVisible(false);
    router.replace('/(auth)/login');
  }, [logout]);

  const logoutDialogProps: LogoutConfirmDialogProps = {
    visible,
    onDismiss: dismissLogout,
    onConfirm: () => {
      void handleConfirm();
    },
    loading: logout.isPending,
  };

  return { confirmLogout, isLoggingOut: logout.isPending, logoutDialogProps };
}

