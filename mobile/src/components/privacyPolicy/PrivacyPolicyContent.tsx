import { StyleSheet, Text, View } from 'react-native';

import type { PrivacyPolicyDocument } from '@/src/domain/privacyPolicy/entities';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';

type Props = {
  policy: PrivacyPolicyDocument;
};

export function PrivacyPolicyContent({ policy }: Props) {
  const sections = [...policy.sections].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <View style={styles.card}>
      <Text style={styles.updated}>{policy.lastUpdatedLabel}</Text>
      <Text style={styles.intro}>{policy.intro}</Text>

      {sections.map((section) => (
        <View key={section.id} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.paragraphs.map((paragraph) => (
            <Text key={paragraph} style={styles.paragraph}>
              {paragraph}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: amraleColors.white,
    borderRadius: amraleRadius.xxl,
    padding: amraleSpacing.lg,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
    shadowColor: amraleColors.cardShadow,
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  updated: {
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 12,
    color: amraleColors.textSubtle,
    marginBottom: amraleSpacing.sm,
  },
  intro: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 14,
    lineHeight: 22,
    color: amraleColors.textMuted,
    marginBottom: amraleSpacing.lg,
  },
  section: {
    marginBottom: amraleSpacing.lg,
  },
  sectionTitle: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 16,
    color: amraleColors.text,
    marginBottom: amraleSpacing.sm,
  },
  paragraph: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 14,
    lineHeight: 22,
    color: amraleColors.textMuted,
    marginBottom: amraleSpacing.sm,
  },
});
