import { useState } from 'react';
import { Platform } from 'react-native';

import { useUpdateCustomer } from '@/src/hooks/customers';
import { strings } from '@/src/i18n/strings';

/**
 * "Pin my spot": the delivery boy, standing at the customer's door, saves where the phone is so directions go straight
 * there next time. A first tap arms it and a second tap saves — a stray tap never moves a pin.
 *
 * Only the browser can report where the phone is; the native app has no location module yet, so `canPin` is false.
 */
export function useSaveDoorPin() {
  const updateCustomer = useUpdateCustomer();
  const [armedFor, setArmedFor] = useState<string | null>(null);
  const [savingFor, setSavingFor] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const canPin = Platform.OS === 'web' && typeof navigator !== 'undefined' && !!navigator.geolocation;

  async function pin(customer: { id: string; name: string }) {
    if (armedFor !== customer.id) {
      setArmedFor(customer.id);
      setNote(strings('delivery').doorPin.armed);
      return;
    }
    setArmedFor(null);
    setSavingFor(customer.id);
    setNote(null);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }),
      );
      await updateCustomer.mutateAsync({
        id: customer.id,
        data: {
          geoLocation: {
            latitude: Math.round(position.coords.latitude * 1e6) / 1e6,
            longitude: Math.round(position.coords.longitude * 1e6) / 1e6,
            source: 'delivery',
            updatedAt: new Date().toISOString(),
          },
        },
      });
      setNote(strings('delivery').doorPin.saved(customer.name));
    } catch (err) {
      const denied = !!err && typeof err === 'object' && (err as GeolocationPositionError).code === 1;
      setNote(
        denied
          ? strings('delivery').doorPin.denied
          : strings('delivery').doorPin.failed,
      );
    } finally {
      setSavingFor(null);
    }
  }

  return { canPin, pin, armedFor, savingFor, note, setNote };
}
