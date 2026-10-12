import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { announcementCategoryLabel } from '@/src/domain/announcements/announcements';
import type { AnnouncementCategory } from '@/src/domain/announcements/entities';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

type Look = { icon: IconName; fg: string; bg: string };

const LOOKS: Record<AnnouncementCategory, Look> = {
  Festival: { icon: 'party-popper', fg: '#9A4F00', bg: '#FFEBD2' },
  Birthday: { icon: 'cake-variant-outline', fg: '#a3246b', bg: '#fbe3f0' },
  Important: { icon: 'alert-decagram-outline', fg: '#9f1d1d', bg: '#fde2e1' },
  Payment: { icon: 'cash-multiple', fg: '#16623a', bg: '#dcf3e5' },
  Order: { icon: 'basket-outline', fg: '#0b4fae', bg: '#e3efff' },
  Delivery: { icon: 'truck-delivery-outline', fg: '#6b3fa0', bg: '#efe6fb' },
};

/**
 * Each kind of announcement has its own icon and colour, the same in the admin and customer apps. `label` is looked
 * up in the app's language each time it is read (render time); `announcementCategoryLabel` does the same with an
 * explicit language.
 */
export const ANNOUNCEMENT_LOOK: Readonly<Record<AnnouncementCategory, Look & { readonly label: string }>> = Object.fromEntries(
  (Object.keys(LOOKS) as AnnouncementCategory[]).map((category) => [
    category,
    {
      ...LOOKS[category],
      get label() {
        return announcementCategoryLabel(category);
      },
    },
  ]),
) as Record<AnnouncementCategory, Look & { readonly label: string }>;
