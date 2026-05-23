import * as ImagePicker from 'expo-image-picker';
import { useCallback } from 'react';
import { Alert, Platform } from 'react-native';

import { measureImageAspectRatio } from '@/src/components/dashboard/dashboardCover';
import { useUpdateDashboardCover } from '@/src/hooks/adminDashboard';

export function usePickDashboardCover() {
  const updateCover = useUpdateDashboardCover();

  const pickCover = useCallback(async () => {
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Allow photo library access to change the dashboard cover.');
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.92,
    });

    if (result.canceled || !result.assets[0]?.uri) return;

    const uri = result.assets[0].uri;
    const assetW = result.assets[0].width;
    const assetH = result.assets[0].height;
    const aspectRatio =
      assetW && assetH && assetH > 0 ? assetW / assetH : await measureImageAspectRatio(uri);

    await updateCover.mutateAsync({ uri, aspectRatio });
  }, [updateCover]);

  return { pickCover, isUpdating: updateCover.isPending };
}
