import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { AmraleLogo } from '@/src/components/auth/AmraleLogo';
import { ContactAddressMap } from '@/src/components/contactAdmin/ContactAddressMap';
import { ContactChannelCard } from '@/src/components/contactAdmin/ContactChannelCard';
import type { ContactAdminDetails } from '@/src/domain/contactAdmin/entities';
import { useStrings } from '@/src/i18n/useStrings';
import {
  amraleColors,
  amraleRadius,
  amraleSpacing,
  amraleTypography,
  dairyGradient,
  dairyTactileColors,
} from '@/src/theme/dairyTactile';
import { platformShadow } from '@/src/theme/platformStyles';

/** The page column is up to 760px wide; from here there is room for the contact rows and the map side by side. */
const TWO_COLUMN_MIN_WIDTH = 820;

type Props = {
  contact: ContactAdminDetails;
};

function SectionTitle({ children }: { children: string }) {
  return (
    <Text style={styles.sectionTitle} accessibilityRole="header">
      {children}
    </Text>
  );
}

/**
 * Contact Us: who we are in one compact banner, then the ways to reach the dairy — each row says what tapping it
 * does — and where to find it. Short enough on a phone that calling needs no scrolling.
 */
export function ContactAdminCard({ contact }: Props) {
  const t = useStrings('help');
  const { width } = useWindowDimensions();
  const twoColumn = width >= TWO_COLUMN_MIN_WIDTH;

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={[...dairyGradient.colors]}
        start={dairyGradient.start}
        end={dairyGradient.end}
        style={styles.hero}
      >
        <View style={styles.heroTop}>
          <AmraleLogo size="login" rounded style={styles.logo} />
          <View style={styles.heroText}>
            <Text style={styles.pageTitle}>{contact.pageTitle}</Text>
            <Text style={styles.pageSubtitle}>{contact.pageSubtitle}</Text>
          </View>
        </View>

        <View style={styles.heritage}>
          <View style={styles.heritagePill}>
            <MaterialCommunityIcons name="star-circle" size={16} color={amraleColors.white} />
            <Text style={styles.heritageHeadline}>{contact.headline}</Text>
          </View>
          {contact.bodyLines.map((line) => (
            <Text key={line} style={styles.bodyLine}>
              {line}
            </Text>
          ))}
        </View>
      </LinearGradient>

      <View style={[styles.columns, twoColumn && styles.columnsWide]}>
        <View style={[styles.column, twoColumn && styles.columnWide]}>
          <SectionTitle>{t.contact.getInTouch}</SectionTitle>
          <View style={styles.listCard}>
            {contact.channels.map((channel, index) => (
              <ContactChannelCard key={channel.type} channel={channel} divider={index > 0} />
            ))}
          </View>
        </View>

        <View style={[styles.column, twoColumn && styles.columnWide]}>
          <SectionTitle>{t.contact.visitUs}</SectionTitle>
          <ContactAddressMap address={contact.address} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    gap: amraleSpacing.lg,
  },
  hero: {
    width: '100%',
    borderRadius: amraleRadius.xl,
    padding: amraleSpacing.md,
    gap: amraleSpacing.md,
    overflow: 'hidden',
    ...platformShadow({ shadowColor: amraleColors.blue, shadowOpacity: 0.22, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } }),
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: amraleSpacing.md,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.55)',
    alignSelf: 'center',
  },
  heroText: { flex: 1, minWidth: 0, gap: 4 },
  pageTitle: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 20,
    lineHeight: 26,
    color: amraleColors.white,
  },
  pageSubtitle: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(255, 255, 255, 0.88)',
  },
  heritage: {
    gap: 4,
    paddingTop: amraleSpacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.22)',
  },
  heritagePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    gap: 6,
    marginBottom: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: amraleRadius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  heritageHeadline: {
    flexShrink: 1,
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 13,
    color: amraleColors.white,
  },
  bodyLine: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  columns: {
    width: '100%',
    gap: amraleSpacing.lg,
  },
  columnsWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  column: {
    width: '100%',
    gap: amraleSpacing.sm,
  },
  columnWide: {
    flex: 1,
    width: undefined,
    minWidth: 0,
  },
  sectionTitle: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 16,
    color: amraleColors.text,
    paddingHorizontal: 2,
  },
  listCard: {
    width: '100%',
    borderRadius: amraleRadius.xl,
    borderWidth: 1,
    borderColor: dairyTactileColors.outlineVariant,
    backgroundColor: amraleColors.white,
    overflow: 'hidden',
  },
});
