import { useMutation, useQueryClient } from '@tanstack/react-query';

import type {
  RequestNewMobileOtpRequest,
  UpdateProfileAvatarRequest,
  UpdateProfileWithOtpRequest,
  VerifyNewMobileRequest,
  VerifyProfileOtpRequest,
} from '@/src/domain/profile/dtos';
import { services } from '@/src/infrastructure/service-registry';

export function useRequestProfileSaveOtp() {
  return useMutation({
    mutationFn: () => services.profile.requestSaveOtp(),
  });
}

export function useUpdateProfileWithOtp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateProfileWithOtpRequest) => services.profile.updateProfileWithOtp(data),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['profile', 'me'] });
      await qc.invalidateQueries({ queryKey: ['auth', 'session'] });
    },
  });
}

export function useRequestOldMobileOtp() {
  return useMutation({
    mutationFn: () => services.profile.requestOldMobileOtp(),
  });
}

export function useVerifyOldMobileOtp() {
  return useMutation({
    mutationFn: (data: VerifyProfileOtpRequest) => services.profile.verifyOldMobileOtp(data),
  });
}

export function useRequestNewMobileOtp() {
  return useMutation({
    mutationFn: (data: RequestNewMobileOtpRequest) => services.profile.requestNewMobileOtp(data),
  });
}

export function useVerifyNewMobileAndUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: VerifyNewMobileRequest) => services.profile.verifyNewMobileAndUpdate(data),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['profile', 'me'] });
      await qc.invalidateQueries({ queryKey: ['auth', 'session'] });
    },
  });
}

export function useUpdateProfileAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateProfileAvatarRequest) => services.profile.updateProfileAvatar(data),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['profile', 'me'] });
    },
  });
}
