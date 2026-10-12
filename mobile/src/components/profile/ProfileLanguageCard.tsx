import { ProfileSectionCard } from '@/src/components/profile/ProfileSectionCard';
import { LanguageToggle } from '@/src/components/shared/LanguageToggle';
import { useStrings } from '@/src/i18n/useStrings';

/** English or Marathi for the whole app on this phone; it changes at once and needs no saving. */
export function ProfileLanguageCard() {
  const t = useStrings('common');
  return (
    <ProfileSectionCard icon="translate" title={t.language.title} subtitle={t.language.hint}>
      <LanguageToggle />
    </ProfileSectionCard>
  );
}
