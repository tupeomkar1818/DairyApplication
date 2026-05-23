import type { IPrivacyPolicyService } from '@/src/domain/privacyPolicy/service.interface';
import type { PrivacyPolicyResponse } from '@/src/domain/privacyPolicy/dtos';
import type { PrivacyPolicyDocument } from '@/src/domain/privacyPolicy/entities';
import type { PrivacyPolicyQuery } from '@/src/domain/privacyPolicy/validations';
import { readJson, writeJson } from '@/src/infrastructure/storage/storage';
import { PRIVACY_POLICY_STORE_KEY } from '@/src/infrastructure/storage/keys';

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

function buildSeedPolicy(): PrivacyPolicyDocument {
  const now = nowIso();

  return {
    id: newId('policy'),
    pageTitle: 'Privacy Policy',
    lastUpdatedLabel: 'Last updated: January 2024',
    intro:
      'Amrale Dairy ("we", "our", "us") respects your privacy. This policy explains how we collect, use, and protect your information when you use our mobile application and delivery services.',
    sections: [
      {
        id: newId('section'),
        title: 'Information We Collect',
        sortOrder: 1,
        paragraphs: [
          'Mobile number and one-time password (OTP) details used to verify your identity and secure your account.',
          'Subscription, delivery, and order information needed to fulfil daily dairy deliveries.',
          'Device and app usage data required to keep the service reliable and secure.',
        ],
      },
      {
        id: newId('section'),
        title: 'How We Use Your Information',
        sortOrder: 2,
        paragraphs: [
          'To authenticate you and manage your account.',
          'To process subscriptions, deliveries, billing, and customer support requests.',
          'To send service-related messages such as OTP codes and delivery updates.',
          'To improve our products, routes, and app experience.',
        ],
      },
      {
        id: newId('section'),
        title: 'Sharing of Information',
        sortOrder: 3,
        paragraphs: [
          'We do not sell your personal information.',
          'We may share limited data with delivery partners and service providers who help us operate the dairy service, under strict confidentiality.',
          'We may disclose information when required by law or to protect the rights and safety of our customers and staff.',
        ],
      },
      {
        id: newId('section'),
        title: 'Data Security',
        sortOrder: 4,
        paragraphs: [
          'We use industry-standard safeguards including OTP-based sign-in and secure storage for session data.',
          'No method of transmission over mobile networks is completely secure; we work continuously to protect your data.',
        ],
      },
      {
        id: newId('section'),
        title: 'Your Choices',
        sortOrder: 5,
        paragraphs: [
          'You may contact us to update your registered mobile number or subscription details through your dairy administrator.',
          'You may request information about your data or raise privacy concerns using the Contact Admin option in the app.',
        ],
      },
      {
        id: newId('section'),
        title: 'Contact Us',
        sortOrder: 6,
        paragraphs: [
          'For privacy-related questions, email support@amraledairy.com or call +91 99224 43636.',
          'Amrale Dairy — Kothrud’s Trusted Dairy Since 1976.',
        ],
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

function isCurrentShape(doc: PrivacyPolicyDocument | null | undefined): doc is PrivacyPolicyDocument {
  return !!doc?.sections?.length && !!doc.pageTitle;
}

async function ensureSeedPolicy(): Promise<PrivacyPolicyDocument> {
  const existing = await readJson<PrivacyPolicyDocument>(PRIVACY_POLICY_STORE_KEY);
  if (isCurrentShape(existing)) return existing;

  const seeded = buildSeedPolicy();
  await writeJson(PRIVACY_POLICY_STORE_KEY, seeded);
  return seeded;
}

export class PrivacyPolicyServiceMock implements IPrivacyPolicyService {
  async getPrivacyPolicy(_query?: PrivacyPolicyQuery): Promise<PrivacyPolicyResponse> {
    await sleep(DEFAULT_DELAY_MS);
    const policy = await ensureSeedPolicy();
    return { policy };
  }
}
