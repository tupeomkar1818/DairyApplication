import type { IFaqService } from '@/src/domain/faq/service.interface';
import type { FaqListResponse } from '@/src/domain/faq/dtos';
import type { FaqItem } from '@/src/domain/faq/entities';
import type { FaqListQuery } from '@/src/domain/faq/validations';
import { readJson, writeJson } from '@/src/infrastructure/storage/storage';
import { FAQ_STORE_KEY } from '@/src/infrastructure/storage/keys';

const DEFAULT_DELAY_MS = 200;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function nowIso(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

async function ensureSeedFaqs(): Promise<FaqItem[]> {
  const existing = await readJson<FaqItem[]>(FAQ_STORE_KEY);
  if (existing && existing.length > 0) return existing;

  const now = nowIso();
  const seeded: FaqItem[] = [
    {
      id: newId('faq'),
      question: 'How do I sign in to the Amrale Dairy app?',
      answer:
        'Enter your registered 10-digit mobile number with country code +91, then tap Verify with OTP. You will receive a 6-digit code via SMS to complete sign-in.',
      sortOrder: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: newId('faq'),
      question: 'I did not receive my OTP. What should I do?',
      answer:
        'Wait for the resend timer to finish, then tap Resend OTP. Ensure your mobile number is correct and has network coverage. If the issue continues, use Contact Admin from the login screen.',
      sortOrder: 2,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: newId('faq'),
      question: 'Can I change my mobile number after logging in?',
      answer:
        'On the OTP screen, tap Change mobile number to go back and enter a different number. For updating your registered account number, please contact your dairy administrator.',
      sortOrder: 3,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: newId('faq'),
      question: 'Who do I contact for delivery or subscription help?',
      answer:
        'Use Contact Admin on the login screen to reach your local Amrale Dairy coordinator. For urgent delivery issues, call during your usual delivery window.',
      sortOrder: 4,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: newId('faq'),
      question: 'Is my personal information secure?',
      answer:
        'Yes. We use OTP-based sign-in and secure access to protect your account. Your mobile number is used only for authentication and delivery communication. See Privacy Policy for full details.',
      sortOrder: 5,
      createdAt: now,
      updatedAt: now,
    },
  ];

  await writeJson(FAQ_STORE_KEY, seeded);
  return seeded;
}

export class FaqServiceMock implements IFaqService {
  async listFaqs(_query?: FaqListQuery): Promise<FaqListResponse> {
    await sleep(DEFAULT_DELAY_MS);
    const items = (await ensureSeedFaqs()).slice().sort((a, b) => a.sortOrder - b.sortOrder);
    return { items };
  }
}
