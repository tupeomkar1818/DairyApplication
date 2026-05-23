import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import { Pressable, StyleSheet, useColorScheme, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { Text } from 'react-native-paper';

import { DeliveryBoysManagementSection } from '@/src/components/admin/DeliveryBoysManagementSection';
import { useScreenSafeInsets } from '@/src/hooks/useScreenSafeInsets';
import { rf } from '@/src/utils/responsiveTypography';

const COLORS = {
  primary: '#2563EB',
  secondary: '#60A5FA',
  accent: '#22C55E',
  bg: '#F8FAFC',
  text: '#1E293B',
};

export default function AdminDeliveryScreen() {
  const scheme = useColorScheme();
  const { headerPaddingTop } = useScreenSafeInsets();
  const { width } = useWindowDimensions();
  const textMain = scheme === 'dark' ? styles.textOnDark : styles.textOnLight;
  const titleSize = rf(20, width, { clamp: { min: 18, max: 24 } });

  return (
    <View style={[styles.bg, scheme === 'dark' ? styles.bgDark : styles.bgLight, styles.rootClip]}>
      <View style={[styles.appBar, scheme === 'dark' ? styles.appBarDark : styles.appBarLight, { paddingTop: headerPaddingTop }]}>
        <View style={styles.left}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
            <MaterialCommunityIcons name="arrow-left" size={20} color={scheme === 'dark' ? 'white' : COLORS.text} />
          </Pressable>
          <Text
            variant="titleLarge"
            style={[textMain, styles.title, { fontSize: titleSize, lineHeight: Math.round(titleSize * 1.15) }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            Delivery Boys
          </Text>
        </View>
      </View>

      <DeliveryBoysManagementSection />
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  rootClip: { overflow: 'hidden' },
  bgLight: { backgroundColor: COLORS.bg },
  bgDark: { backgroundColor: '#0B1220' },

  appBar: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  appBarLight: { backgroundColor: 'transparent' },
  appBarDark: { backgroundColor: 'transparent' },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  title: { flexShrink: 1 },
  iconBtn: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },

  textOnLight: { color: COLORS.text },
  textOnDark: { color: 'rgba(255,255,255,0.96)' },
});
