import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { createElement } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import type { ContactAddress } from '@/src/domain/contactAdmin/entities';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography, dairyTactileColors } from '@/src/theme/dairyTactile';
import { pointerEventsNone } from '@/src/theme/platformStyles';

type Props = {
  address: ContactAddress;
};

const MAP_HEIGHT = 190;

export function ContactAddressMap({ address }: Props) {
  const t = useStrings('help');
  function openInMaps() {
    const nativeUrl = Platform.select({
      ios: `maps:0,0?q=${address.latitude},${address.longitude}`,
      android: `geo:${address.latitude},${address.longitude}?q=${encodeURIComponent(address.fullAddress)}`,
      default: address.mapUrl,
    });
    void Linking.openURL(nativeUrl ?? address.mapUrl).catch(() => undefined);
  }

  return (
    <View style={styles.card}>
      <View style={styles.addressRow}>
        <View style={styles.pin}>
          <MaterialCommunityIcons name="map-marker" size={22} color={amraleColors.blue} />
        </View>
        <Text style={styles.address} selectable>
          {address.fullAddress}
        </Text>
      </View>

      <Pressable
        onPress={openInMaps}
        style={({ pressed }) => [styles.mapWrap, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={t.contact.mapLabel}
      >
        {Platform.OS === 'web' ? (
          // react-native-webview has no web build; a plain iframe renders the same embed URL.
          createElement('iframe', {
            src: address.mapEmbedUrl,
            title: t.contact.mapTitle,
            loading: 'lazy',
            referrerPolicy: 'no-referrer-when-downgrade',
            style: { border: 0, width: '100%', height: '100%', pointerEvents: 'none' },
          })
        ) : (
          <WebView
            source={{ uri: address.mapEmbedUrl }}
            style={[styles.map, pointerEventsNone]}
            scrollEnabled={false}
            originWhitelist={['https://*']}
            accessibilityLabel={t.contact.mapTitle}
          />
        )}
      </Pressable>

      <Pressable
        onPress={openInMaps}
        style={({ pressed }) => [styles.directionsBtn, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={t.contact.getDirections}
      >
        <MaterialCommunityIcons name="directions" size={18} color={amraleColors.white} />
        <Text style={styles.directionsText}>{t.contact.getDirections}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    gap: amraleSpacing.md,
    padding: amraleSpacing.md,
    borderRadius: amraleRadius.xl,
    borderWidth: 1,
    borderColor: dairyTactileColors.outlineVariant,
    backgroundColor: amraleColors.white,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: amraleSpacing.md,
  },
  pin: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: dairyTactileColors.surfaceContainer,
  },
  address: {
    flex: 1,
    minWidth: 0,
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 14,
    lineHeight: 21,
    color: amraleColors.text,
  },
  mapWrap: {
    width: '100%',
    height: MAP_HEIGHT,
    borderRadius: amraleRadius.lg,
    overflow: 'hidden',
    backgroundColor: amraleColors.inputBgLight,
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  directionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: amraleRadius.pill,
    backgroundColor: amraleColors.blue,
  },
  directionsText: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 15,
    color: amraleColors.white,
  },
  pressed: { opacity: 0.88 },
});
