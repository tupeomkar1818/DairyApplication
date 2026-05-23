import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';

import type { FaqItem } from '@/src/domain/faq/entities';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = {
  items: FaqItem[];
};

export function FaqAccordionList({ items }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(items[0]?.id ?? null);

  function toggle(id: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <View style={styles.list}>
      {items.map((item) => {
        const open = expandedId === item.id;
        return (
          <View key={item.id} style={styles.card}>
            <Pressable
              onPress={() => toggle(item.id)}
              style={({ pressed }) => [styles.questionRow, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
            >
              <Text style={styles.question}>{item.question}</Text>
              <MaterialCommunityIcons
                name={open ? 'chevron-up' : 'chevron-down'}
                size={22}
                color={amraleColors.blue}
              />
            </Pressable>
            {open ? <Text style={styles.answer}>{item.answer}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    width: '100%',
    gap: 12,
  },
  card: {
    backgroundColor: amraleColors.white,
    borderRadius: amraleRadius.lg,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
    paddingHorizontal: amraleSpacing.md,
    paddingVertical: amraleSpacing.md,
    shadowColor: amraleColors.cardShadow,
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  question: {
    flex: 1,
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 15,
    lineHeight: 22,
    color: amraleColors.text,
  },
  answer: {
    marginTop: amraleSpacing.sm,
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 14,
    lineHeight: 21,
    color: amraleColors.textMuted,
  },
  pressed: { opacity: 0.85 },
});
