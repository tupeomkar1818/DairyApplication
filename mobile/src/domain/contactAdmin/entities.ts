import type { EntityBase } from '@/src/domain/shared/types';

export type ContactChannelType = 'call' | 'whatsapp' | 'email';

export interface ContactChannel {
  type: ContactChannelType;
  /** e.g. CALL US, WHATSAPP */
  label: string;
  /** Primary display value on the card */
  value: string;
  /** tel:, https://wa.me/..., mailto: */
  actionUri: string;
}

export interface ContactAddress {
  label: string;
  fullAddress: string;
  /** Opens in device maps (share / deep link) */
  mapUrl: string;
  /** In-app map preview embed */
  mapEmbedUrl: string;
  latitude: number;
  longitude: number;
}

export interface ContactAdminDetails extends EntityBase {
  pageTitle: string;
  pageSubtitle: string;
  /** Brand heritage headline */
  headline: string;
  bodyLines: string[];
  channels: ContactChannel[];
  address: ContactAddress;
}
