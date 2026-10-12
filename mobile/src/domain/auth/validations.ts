import { z } from 'zod';

import { normalizeDigitInput, normalizeMobileNumberInput } from '@/src/domain/shared/numerals';
import { strings } from '@/src/i18n/strings';

const MobileNumberSchema = z.preprocess(
  (val) => (typeof val === 'string' ? normalizeMobileNumberInput(val) : val),
  z.string().regex(/^\d{10}$/, { error: () => strings('common').errors.invalidMobile })
);

const OtpSchema = z.preprocess(
  (val) => (typeof val === 'string' ? normalizeDigitInput(val, 6) : val),
  z.string().regex(/^\d{6}$/, { error: () => strings('auth').errors.invalidOtp })
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

