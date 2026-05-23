import { z } from 'zod';

import { normalizeDigitInput, normalizeMobileNumberInput } from '@/src/domain/shared/numerals';

const MobileNumberSchema = z.preprocess(
  (val) => (typeof val === 'string' ? normalizeMobileNumberInput(val) : val),
  z.string().regex(/^\d{10}$/, 'Please enter a valid 10-digit mobile number')
);

const OtpSchema = z.preprocess(
  (val) => (typeof val === 'string' ? normalizeDigitInput(val, 6) : val),
  z.string().regex(/^\d{6}$/, 'Please enter a valid 6-digit OTP')
);

export const RequestOtpRequestSchema = z.object({
  mobileNumber: MobileNumberSchema,
});
export type RequestOtpRequestInput = z.infer<typeof RequestOtpRequestSchema>;

export const VerifyOtpRequestSchema = z.object({
  mobileNumber: MobileNumberSchema,
  otp: OtpSchema,
});
export type VerifyOtpRequestInput = z.infer<typeof VerifyOtpRequestSchema>;

