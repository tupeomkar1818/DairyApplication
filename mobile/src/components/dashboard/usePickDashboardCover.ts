import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import { Alert, Platform } from 'react-native';

import { measureImageAspectRatio } from '@/src/components/dashboard/dashboardCover';
import { persistableImageUriFromAsset } from '@/src/components/dashboard/persistablePickedImage';
import { useUpdateDashboardCover } from '@/src/hooks/adminDashboard';
import { uploadPicture } from '@/src/infrastructure/uploadPicture';
import { strings } from '@/src/i18n/strings';

export function usePickDashboardCover() {
  const updateCover = useUpdateDashboardCover();
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const pickCover = useCallback(async () => {
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          const t = strings('admin').cover;
          Alert.alert(t.permissionTitle, t.permissionText);
          return;
        }
      }

      const isWeb = Platform.OS === 'web';
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: isWeb ? 0.5 : 0.92,
        // Web returns a blob: URL that dies on reload; request base64 so a data: URI can be persisted.
        base64: isWeb,
      });

      const asset = result.canceled ? undefined : result.assets[0];
      if (!asset) return;

      const picked = persistableImageUriFromAsset(asset, Platform.OS);
      if (!picked.ok) {
        setError(picked.message);
        return;
      }

      const uri = picked.uri;
      const assetW = asset.width;
      const assetH = asset.height;
      // A failed measurement rejects with a technical message; tell the admin the picture could not be read.
      const aspectRatio =
        assetW && assetH && assetH > 0
          ? assetW / assetH
          : await measureImageAspectRatio(uri).catch(() => {
              throw new Error(strings('admin').cover.couldNotRead);
            });

      // With the dairy’s server the cover goes up once and the setting keeps its address, so all three apps
      // show the same picture; on a phone of its own it stays where it was picked.
      await updateCover.mutateAsync({ uri: await uploadPicture(uri), aspectRatio });
      setError(null);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : strings('admin').cover.updateFailed);
    }
  }, [updateCover]);

  return { pickCover, isUpdating: updateCover.isPending, error, clearError };
}
