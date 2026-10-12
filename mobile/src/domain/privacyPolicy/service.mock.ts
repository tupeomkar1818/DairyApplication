import type { IPrivacyPolicyService } from '@/src/domain/privacyPolicy/service.interface';
import type { PrivacyPolicyResponse } from '@/src/domain/privacyPolicy/dtos';
import type { PrivacyPolicyDocument } from '@/src/domain/privacyPolicy/entities';
import type { PrivacyPolicyQuery } from '@/src/domain/privacyPolicy/validations';
import type { Lang } from '@/src/i18n/language';
import { strings } from '@/src/i18n/strings';
import { readJson, writeJson } from '@/src/infrastructure/storage/storage';
import { PRIVACY_POLICY_STORE_KEY } from '@/src/infrastructure/storage/keys';

const DEFAULT_DELAY_MS = 200;

type SectionWording = { title: string; paragraphs: string[] };

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function nowIso(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

/** The dictionary's sections, keyed by their place in the policy. */
function sectionWordings(lang?: Lang): Record<number, SectionWording> {
  return strings('help', lang).privacy.sections;
}

function buildSeedPolicy(): PrivacyPolicyDocument {
  const now = nowIso();
  const words = strings('help', 'en').privacy;

  return {
    id: newId('policy'),
    pageTitle: words.title,
    lastUpdatedLabel: words.lastUpdated,
    intro: words.intro,
    sections: Object.entries(sectionWordings('en'))
      .map(([order, section]) => ({
        id: newId('section'),
        title: section.title,
        sortOrder: Number(order),
        paragraphs: [...section.paragraphs],
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * The policy is fixed app content — nothing in the app edits it — so it is always shown in the reader's language:
 * the stored document keeps its ids and dates, and the words come from the dictionary (sections by `sortOrder`).
 */
function inCurrentLanguage(doc: PrivacyPolicyDocument): PrivacyPolicyDocument {
  const words = strings('help').privacy;
  const sections = sectionWordings();
  return {
    ...doc,
    pageTitle: words.title,
    lastUpdatedLabel: words.lastUpdated,
    intro: words.intro,
    sections: doc.sections.map((section) => {
      const wording = sections[section.sortOrder];
      return wording ? { ...section, title: wording.title, paragraphs: [...wording.paragraphs] } : section;
    }),
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
    const policy = inCurrentLanguage(await ensureSeedPolicy());
    return { policy };
  }
}
