import type { IContactAdminService } from '@/src/domain/contactAdmin/service.interface';
import type { ContactAdminResponse } from '@/src/domain/contactAdmin/dtos';
import type { ContactAdminDetails } from '@/src/domain/contactAdmin/entities';
import type { ContactAdminQuery } from '@/src/domain/contactAdmin/validations';
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
const AMRALE_LAT = 18.5035;
const AMRALE_LNG = 73.8138;

function buildMapEmbedUrl(): string {
  const q = encodeURIComponent(AMRALE_ADDRESS);
  return `https://www.google.com/maps?q=${q}&z=16&output=embed`;
}

function buildSeedContact(): ContactAdminDetails {
  const now = nowIso();
  const phoneDial = '+919922443636';

  return {
    id: newId('contact'),
    pageTitle: "We're here to help",
    pageSubtitle:
      'Our dedicated team is ready to assist you with your dairy subscriptions and inquiries.',
    headline: "Kothrud's Trusted Dairy Since 1976",
    bodyLines: [
      'Experience the true taste of purity with us.',
      'Premium Quality Dairy & Food Products Available.',
    ],
    channels: [
      {
        type: 'call',
        label: 'CALL US',
        value: '+91 99224 43636',
        actionUri: `tel:${phoneDial}`,
      },
      {
        type: 'whatsapp',
        label: 'WHATSAPP',
        value: 'Chat Now',
        actionUri: `https://wa.me/${phoneDial.replace('+', '')}`,
      },
      {
        type: 'email',
        label: 'EMAIL US',
        value: 'support@amraledairy.com',
        actionUri: 'mailto:support@amraledairy.com',
      },
    ],
    address: {
      label: 'VISIT US',
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

function isCurrentShape(contact: ContactAdminDetails | null | undefined): contact is ContactAdminDetails {
  return !!contact?.channels?.length && !!contact.pageTitle && !!contact.address?.fullAddress;
}

async function ensureSeedContact(): Promise<ContactAdminDetails> {
  const existing = await readJson<ContactAdminDetails>(CONTACT_ADMIN_STORE_KEY);
  if (isCurrentShape(existing)) return existing;

  const seeded = buildSeedContact();
  await writeJson(CONTACT_ADMIN_STORE_KEY, seeded);
  return seeded;
}

export class ContactAdminServiceMock implements IContactAdminService {
  async getContactAdmin(_query?: ContactAdminQuery): Promise<ContactAdminResponse> {
    await sleep(DEFAULT_DELAY_MS);
    const contact = await ensureSeedContact();
    return { contact };
  }
}
