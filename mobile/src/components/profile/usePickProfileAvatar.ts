import * as ImagePicker from 'expo-image-picker';
import { useCallback } from 'react';
import { Alert, Platform } from 'react-native';

import { mapDomainErrorMessage } from '@/src/components/profile/profileOtpUtils';
import { useUpdateProfileAvatar } from '@/src/hooks/profile';

type PickProfileAvatarOptions = {
  onSuccess?: () => void;
  onError?: (message: string) => void;
};

export function usePickProfileAvatar(options?: PickProfileAvatarOptions) {
  const updateAvatar = useUpdateProfileAvatar();

  const pickAvatar = useCallback(async () => {
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Allow photo library access to change your profile photo.');
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled || !result.assets[0]?.uri) return;

    try {
      await updateAvatar.mutateAsync({ avatarUri: result.assets[0].uri });
      options?.onSuccess?.();
    } catch (e) {
      options?.onError?.(mapDomainErrorMessage(e, 'Could not update profile photo'));
    }
  }, [options, updateAvatar]);

  return { pickAvatar, isUpdating: updateAvatar.isPending };
}
