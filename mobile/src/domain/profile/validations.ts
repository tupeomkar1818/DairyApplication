import { z } from 'zod';

import { normalizeIndicDigitsToAscii } from '@/src/domain/shared/numerals';

const mobileSchema = z
  .string()
  .transform((v) => normalizeIndicDigitsToAscii(v).replace(/\D/g, '').slice(-10))
  .refine((v) => v.length === 10, 'Enter a valid 10-digit mobile number');

export const UpdateProfileRequestSchema = z.object({
  displayName: z.string().trim().min(2, 'Name is required'),
  email: z.string().trim().email('Invalid email').optional().or(z.literal('')),
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
    .refine((v) => v.length === 6, 'Enter the 6-digit OTP'),
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
    .refine((v) => v.length === 6, 'Enter the 6-digit OTP'),
});

export const UpdateProfileAvatarRequestSchema = z.object({
  avatarUri: z.string().trim().min(1, 'Select a photo').max(4_000_000, 'Image is too large'),
});
