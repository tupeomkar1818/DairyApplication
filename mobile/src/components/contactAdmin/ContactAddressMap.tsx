import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import type { ContactAddress } from '@/src/domain/contactAdmin/entities';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';
import { pointerEventsNone } from '@/src/theme/platformStyles';

type Props = {
  address: ContactAddress;
};

export function ContactAddressMap({ address }: Props) {
  function openInMaps() {
    const nativeUrl = Platform.select({
      ios: `maps:0,0?q=${address.latitude},${address.longitude}`,
      android: `geo:${address.latitude},${address.longitude}?q=${encodeURIComponent(address.fullAddress)}`,
      default: address.mapUrl,
    });
    Linking.openURL(nativeUrl ?? address.mapUrl);
  }

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{address.label}</Text>
      <Text style={styles.address}>{address.fullAddress}</Text>

      <View style={styles.mapWrap}>
        <WebView
          source={{ uri: address.mapEmbedUrl }}
          style={[styles.map, pointerEventsNone]}
          scrollEnabled={false}
          originWhitelist={['https://*']}
          accessibilityLabel="Map showing Amrale Dairy location"
        />
        <Pressable
          onPress={openInMaps}
          style={({ pressed }) => [styles.mapOverlay, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Open location in maps"
        >
          <View style={styles.openMapsChip}>
            <MaterialCommunityIcons name="map-marker" size={16} color={amraleColors.blue} />
            <Text style={styles.openMapsText}>Open in Maps</Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: amraleColors.white,
    borderRadius: amraleRadius.xl,
    padding: amraleSpacing.md,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
    shadowColor: amraleColors.cardShadow,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  label: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 11,
    letterSpacing: 1.1,
    color: amraleColors.blue,
    marginBottom: 6,
  },
  address: {
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 14,
    lineHeight: 21,
    color: amraleColors.text,
    marginBottom: amraleSpacing.sm,
  },
  mapWrap: {
    width: '100%',
    height: 180,
    borderRadius: amraleRadius.md,
    overflow: 'hidden',
    backgroundColor: amraleColors.inputBgLight,
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 10,
  },
  openMapsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: amraleColors.white,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: amraleRadius.pill,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  openMapsText: {
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 13,
    color: amraleColors.blue,
  },
  pressed: { opacity: 0.9 },
});
