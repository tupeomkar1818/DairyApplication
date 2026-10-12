import type { IContactAdminService } from '@/src/domain/contactAdmin/service.interface';
import type { ContactAdminResponse } from '@/src/domain/contactAdmin/dtos';
import type { ContactAdminDetails, ContactChannel } from '@/src/domain/contactAdmin/entities';
import type { ContactAdminQuery } from '@/src/domain/contactAdmin/validations';
import type { Lang } from '@/src/i18n/language';
import { strings } from '@/src/i18n/strings';
import { readJson, writeJson } from '@/src/infrastructure/storage/storage';
import { CONTACT_ADMIN_STORE_KEY } from '@/src/infrastructure/storage/keys';

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

const AMRALE_ADDRESS =
  'Amrale Dairy - Since 1976, Sangam Chowk, 164/2, Shastri Nagar, Kothrud, Pune, Maharashtra 411038';
const AMRALE_MAP_SHARE_URL = 'https://share.google/QGK4LkSidDv5S1bcu';
/** The dairy's website, shown on Contact Us. */
export const AMRALE_WEBSITE_CHANNEL = {
  type: 'website',
  label: 'WEBSITE',
  value: 'dairy.matdarraja.in',
  actionUri: 'https://dairy.matdarraja.in',
} as const satisfies ContactChannel;

const AMRALE_LAT = 18.5035;
const AMRALE_LNG = 73.8138;

function buildMapEmbedUrl(): string {
  const q = encodeURIComponent(AMRALE_ADDRESS);
  return `https://www.google.com/maps?q=${q}&z=16&output=embed`;
}

function contactWords(lang?: Lang) {
  return strings('help', lang).contact;
}

function buildSeedContact(): ContactAdminDetails {
  const now = nowIso();
  const phoneDial = '+919922443636';
  const words = contactWords('en');

  return {
    id: newId('contact'),
    pageTitle: words.pageTitle,
    pageSubtitle: words.pageSubtitle,
    headline: words.headline,
    bodyLines: [...words.bodyLines],
    channels: [
      {
        type: 'call',
        label: words.labels.call,
        value: '+91 99224 43636',
        actionUri: `tel:${phoneDial}`,
      },
      {
        type: 'whatsapp',
        label: words.labels.whatsapp,
        value: 'Chat Now',
        actionUri: `https://wa.me/${phoneDial.replace('+', '')}`,
      },
      {
        type: 'email',
        label: words.labels.email,
        value: 'support@amraledairy.com',
        actionUri: 'mailto:support@amraledairy.com',
      },
      { ...AMRALE_WEBSITE_CHANNEL },
    ],
    address: {
      label: words.labels.address,
      fullAddress: AMRALE_ADDRESS,
      mapUrl: AMRALE_MAP_SHARE_URL,
      mapEmbedUrl: buildMapEmbedUrl(),
      latitude: AMRALE_LAT,
      longitude: AMRALE_LNG,
    },
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * The page's wording is fixed app content — nothing in the app edits it — so it is always shown in the reader's
 * language. Only the words change: phone numbers, addresses and links stay as stored.
 */
function inCurrentLanguage(contact: ContactAdminDetails): ContactAdminDetails {
  const words = contactWords();
  return {
    ...contact,
    pageTitle: words.pageTitle,
    pageSubtitle: words.pageSubtitle,
    headline: words.headline,
    bodyLines: [...words.bodyLines],
    channels: contact.channels.map((channel) => ({ ...channel, label: words.labels[channel.type] ?? channel.label })),
    address: { ...contact.address, label: words.labels.address },
  };
}

function isCurrentShape(contact: ContactAdminDetails | null | undefined): contact is ContactAdminDetails {
  return !!contact?.channels?.length && !!contact.pageTitle && !!contact.address?.fullAddress;
}

async function ensureSeedContact(): Promise<ContactAdminDetails> {
  const existing = await readJson<ContactAdminDetails>(CONTACT_ADMIN_STORE_KEY);
  if (isCurrentShape(existing)) {
    // Details saved before the website was added get it once, after the other ways to reach the dairy; a phone
    // holding the old web address gets the current one.
    const saved = existing.channels.find((c) => c.type === 'website');
    if (saved?.value === AMRALE_WEBSITE_CHANNEL.value) return existing;
    const upgraded: ContactAdminDetails = {
      ...existing,
      channels: saved
        ? existing.channels.map((c) => (c.type === 'website' ? { ...AMRALE_WEBSITE_CHANNEL } : c))
        : [...existing.channels, { ...AMRALE_WEBSITE_CHANNEL }],
      updatedAt: nowIso(),
    };
    await writeJson(CONTACT_ADMIN_STORE_KEY, upgraded);
    return upgraded;
  }

  const seeded = buildSeedContact();
  await writeJson(CONTACT_ADMIN_STORE_KEY, seeded);
  return seeded;
}

export class ContactAdminServiceMock implements IContactAdminService {
  async getContactAdmin(_query?: ContactAdminQuery): Promise<ContactAdminResponse> {
    await sleep(DEFAULT_DELAY_MS);
    const contact = inCurrentLanguage(await ensureSeedContact());
    return { contact };
  }
}
