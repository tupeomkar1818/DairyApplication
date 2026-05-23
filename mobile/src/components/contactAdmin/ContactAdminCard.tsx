import { StyleSheet, Text, View } from 'react-native';

import { AmraleLogo } from '@/src/components/auth/AmraleLogo';
import { ContactAddressMap } from '@/src/components/contactAdmin/ContactAddressMap';
import { ContactChannelCard } from '@/src/components/contactAdmin/ContactChannelCard';
import type { ContactAdminDetails } from '@/src/domain/contactAdmin/entities';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';

type Props = {
  contact: ContactAdminDetails;
};

export function ContactAdminCard({ contact }: Props) {
  return (
    <View style={styles.wrap}>
      <AmraleLogo size="login" rounded style={styles.logoCircle} />

      <Text style={styles.pageTitle}>{contact.pageTitle}</Text>
      <Text style={styles.pageSubtitle}>{contact.pageSubtitle}</Text>

      <View style={styles.heritageCard}>
        <Text style={styles.headline}>{contact.headline}</Text>
        {contact.bodyLines.map((line) => (
          <Text key={line} style={styles.bodyLine}>
            {line}
          </Text>
        ))}
      </View>

      <View style={styles.channels}>
        {contact.channels.map((channel) => (
          <ContactChannelCard key={channel.type} channel={channel} />
        ))}
      </View>

      <ContactAddressMap address={contact.address} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignItems: 'center',
  },
  logoCircle: {
    borderRadius: 56,
    marginBottom: amraleSpacing.lg,
  },
  pageTitle: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 24,
    color: amraleColors.text,
    textAlign: 'center',
    marginBottom: amraleSpacing.sm,
  },
  pageSubtitle: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 14,
    lineHeight: 21,
    color: amraleColors.textMuted,
    textAlign: 'center',
    marginBottom: amraleSpacing.lg,
    paddingHorizontal: amraleSpacing.sm,
  },
  heritageCard: {
    width: '100%',
    backgroundColor: amraleColors.white,
    borderRadius: amraleRadius.lg,
    padding: amraleSpacing.md,
    marginBottom: amraleSpacing.lg,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
  },
  headline: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 16,
    lineHeight: 24,
    color: amraleColors.blue,
    textAlign: 'center',
    marginBottom: amraleSpacing.sm,
  },
  bodyLine: {
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 14,
    lineHeight: 22,
    color: amraleColors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  channels: {
    width: '100%',
    gap: 12,
    marginBottom: amraleSpacing.md,
  },
});
