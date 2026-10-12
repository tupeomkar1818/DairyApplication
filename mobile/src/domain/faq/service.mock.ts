import type { IFaqService } from '@/src/domain/faq/service.interface';
import type { FaqListResponse } from '@/src/domain/faq/dtos';
import type { FaqItem } from '@/src/domain/faq/entities';
import type { FaqListQuery } from '@/src/domain/faq/validations';
import type { Lang } from '@/src/i18n/language';
import { strings } from '@/src/i18n/strings';
import { readJson, writeJson } from '@/src/infrastructure/storage/storage';
import { FAQ_STORE_KEY } from '@/src/infrastructure/storage/keys';

const DEFAULT_DELAY_MS = 200;

type FaqWording = { question: string; answer: string };

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function nowIso(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

/** The dictionary's questions, keyed by their place in the list. */
function faqWordings(lang?: Lang): Record<number, FaqWording> {
  return strings('help', lang).faq.items;
}

/**
 * The questions are fixed app content — nothing in the app edits them — so they are always shown in the reader's
 * language: the stored rows keep ids, order and dates, and the words come from the dictionary by `sortOrder`.
 * A stored row with no dictionary entry keeps its own text.
 */
function inCurrentLanguage(item: FaqItem): FaqItem {
  const wording = faqWordings()[item.sortOrder];
  return wording ? { ...item, question: wording.question, answer: wording.answer } : item;
}

async function ensureSeedFaqs(): Promise<FaqItem[]> {
  const existing = await readJson<FaqItem[]>(FAQ_STORE_KEY);
  if (existing && existing.length > 0) return existing;

  const now = nowIso();
  const seeded: FaqItem[] = Object.entries(faqWordings('en'))
    .map(([order, wording]) => ({
      id: newId('faq'),
      question: wording.question,
      answer: wording.answer,
      sortOrder: Number(order),
      createdAt: now,
      updatedAt: now,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  await writeJson(FAQ_STORE_KEY, seeded);
  return seeded;
}

export class FaqServiceMock implements IFaqService {
  async listFaqs(_query?: FaqListQuery): Promise<FaqListResponse> {
    await sleep(DEFAULT_DELAY_MS);
    const items = (await ensureSeedFaqs())
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(inCurrentLanguage);
    return { items };
  }
}
