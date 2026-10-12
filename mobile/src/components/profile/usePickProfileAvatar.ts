import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef } from 'react';
import { Alert, Platform } from 'react-native';

import { mapDomainErrorMessage } from '@/src/components/profile/profileOtpUtils';
import { useUpdateProfileAvatar } from '@/src/hooks/profile';
import { uploadPicture } from '@/src/infrastructure/uploadPicture';
import { strings } from '@/src/i18n/strings';

type PickProfileAvatarOptions = {
  onSuccess?: () => void;
  onError?: (message: string) => void;
};

export function usePickProfileAvatar(options?: PickProfileAvatarOptions) {
  const { mutateAsync: updateAvatarAsync, isPending } = useUpdateProfileAvatar();

  // Callers pass an inline options object (new every render); read the latest via a ref so `pickAvatar` stays stable.
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const pickAvatar = useCallback(async () => {
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        const words = strings('profile').errors;
        Alert.alert(words.permissionTitle, words.permissionBody);
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
      // With the dairy’s server the photo goes up once and the profile keeps its address, so the dairy’s own
      // screens show it too; on a phone of its own it stays where it was picked.
      await updateAvatarAsync({ avatarUri: await uploadPicture(result.assets[0].uri) });
      optionsRef.current?.onSuccess?.();
    } catch (e) {
      optionsRef.current?.onError?.(mapDomainErrorMessage(e, strings('profile').errors.couldNotUpdatePhoto));
    }
  }, [updateAvatarAsync]);

  return { pickAvatar, isUpdating: isPending };
}
