import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { createElement } from 'react';
import { Image, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { youtubeVideoId } from '@/src/domain/announcements/announcements';
import type { AnnouncementMedia as Media } from '@/src/domain/announcements/entities';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleTypography } from '@/src/theme/dairyTactile';

/** Escapes a URI for an HTML attribute (the native player page). */
function attr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/**
 * An announcement's picture or video. `preview` is the small still for a list row (videos show a play badge);
 * otherwise videos play inline — a YouTube link embedded, an uploaded or linked file in a plain video player.
 * No extra native video library is needed: the web uses <video>/<iframe>, phones a WebView.
 */
export function AnnouncementMedia({ media, preview, height = 220 }: { media: Media; preview?: boolean; height?: number }) {
  const t = useStrings('inbox').announcements;
  if (media.kind === 'image') {
    return (
      <Image
        source={{ uri: media.uri }}
        style={[styles.frame, { height }]}
        resizeMode="cover"
        accessibilityLabel={t.picture}
      />
    );
  }

  const ytId = youtubeVideoId(media.uri);

  if (preview) {
    return (
      <View style={[styles.frame, styles.videoPreview, { height }]}>
        {ytId ? (
          <Image source={{ uri: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : null}
        <View style={styles.playBadge}>
          <MaterialCommunityIcons name="play" size={28} color={amraleColors.white} />
        </View>
      </View>
    );
  }

  const embedUrl = ytId ? `https://www.youtube.com/embed/${ytId}` : null;

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.frame, { height }]}>
        {embedUrl
          ? createElement('iframe', {
              src: embedUrl,
              title: t.video,
              allow: 'accelerometer; encrypted-media; gyroscope; picture-in-picture',
              allowFullScreen: true,
              style: { border: 0, width: '100%', height: '100%' },
            })
          : createElement('video', {
              src: media.uri,
              controls: true,
              playsInline: true,
              style: { width: '100%', height: '100%', backgroundColor: '#000', objectFit: 'contain' },
            })}
      </View>
    );
  }

  const source = embedUrl
    ? { uri: embedUrl }
    : {
        html: `<html><body style="margin:0;background:#000"><video src="${attr(media.uri)}" controls playsinline style="width:100%;height:100%;object-fit:contain"></video></body></html>`,
      };

  return (
    <View style={[styles.frame, { height }]}>
      <WebView
        source={source}
        style={styles.webview}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction
        originWhitelist={['*']}
        accessibilityLabel={t.video}
      />
      {/^https?:/i.test(media.uri) ? (
        <Pressable onPress={() => void Linking.openURL(media.uri)} style={styles.openLink} accessibilityRole="link">
          <Text style={styles.openLinkText}>{t.openVideo}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', borderRadius: amraleRadius.lg, overflow: 'hidden', backgroundColor: '#0b1d2d' },
  videoPreview: { alignItems: 'center', justifyContent: 'center' },
  playBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  webview: { flex: 1, backgroundColor: '#000' },
  openLink: {
    position: 'absolute',
    right: 8,
    top: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: amraleRadius.pill,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  openLinkText: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 12, color: amraleColors.white },
});
