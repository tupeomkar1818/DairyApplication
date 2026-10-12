import { z } from 'zod';

import { normalizeIndicDigitsToAscii } from '@/src/domain/shared/numerals';
import { strings } from '@/src/i18n/strings';

const mobileSchema = z
  .string()
  .transform((v) => normalizeIndicDigitsToAscii(v).replace(/\D/g, '').slice(-10))
  .refine((v) => v.length === 10, { error: () => strings('profile').errors.invalidMobile });

export const UpdateProfileRequestSchema = z.object({
  displayName: z.string().trim().min(2, { error: () => strings('profile').errors.nameRequired }),
  email: z.string().trim().email({ error: () => strings('profile').errors.invalidEmail }).optional().or(z.literal('')),
  address: z.string().trim().optional(),
  societyName: z.string().trim().optional(),
  houseFlatNumber: z.string().trim().optional(),
  alternateMobile: mobileSchema.optional().or(z.literal('')),
  emergencyContactName: z.string().trim().optional(),
  emergencyContactNumber: mobileSchema.optional().or(z.literal('')),
});

export const VerifyProfileOtpRequestSchema = z.object({
  otp: z
    .string()
    .transform((v) => normalizeIndicDigitsToAscii(v).replace(/\D/g, ''))
    .refine((v) => v.length === 6, { error: () => strings('profile').errors.enterOtp }),
});

export const UpdateProfileWithOtpRequestSchema = UpdateProfileRequestSchema.and(VerifyProfileOtpRequestSchema);

export const RequestNewMobileOtpRequestSchema = z.object({
  newMobileNumber: mobileSchema,
});

export const VerifyNewMobileRequestSchema = z.object({
  newMobileNumber: mobileSchema,
  otp: z
    .string()
    .transform((v) => normalizeIndicDigitsToAscii(v).replace(/\D/g, ''))
    .refine((v) => v.length === 6, { error: () => strings('profile').errors.enterOtp }),
});

export const UpdateProfileAvatarRequestSchema = z.object({
  avatarUri: z
    .string()
    .trim()
    .min(1, { error: () => strings('profile').errors.selectPhoto })
    .max(4_000_000, { error: () => strings('profile').errors.imageTooLarge }),
});
