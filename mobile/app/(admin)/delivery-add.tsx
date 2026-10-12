import { router } from 'expo-router';
import { useMemo } from 'react';

import { DeliveryBoyFormScreen } from '@/src/components/admin/DeliveryBoyFormScreen';
import {
  buildCreatePayloadFromSimpleForm,
  ddmmyyyyToIso,
  emptySimpleDeliveryBoyForm,
  type SimpleDeliveryBoyForm,
} from '@/src/components/admin/deliveryBoyFormShared';
import { CreateDeliveryBoyRequestSchema } from '@/src/domain/deliveryBoys/validations';
import { useCreateDeliveryBoy } from '@/src/hooks/deliveryBoys';
import { useStrings } from '@/src/i18n/useStrings';

/** Back to the Delivery Boys list when this screen was opened directly (no history to pop). */
function goBackToList() {
  if (router.canGoBack()) router.back();
  else router.replace('/(admin)/delivery');
}

export default function AdminAddDeliveryBoyScreen() {
  const t = useStrings('deliveryBoys');
  const create = useCreateDeliveryBoy();
  const initialForm = useMemo(() => emptySimpleDeliveryBoyForm(), []);

  async function onSave(form: SimpleDeliveryBoyForm) {
    const joiningIso = ddmmyyyyToIso(form.joiningDate.trim());
    if (!joiningIso) throw new Error(t.errors.joiningDateInvalidFull);
    const parsed = CreateDeliveryBoyRequestSchema.safeParse(buildCreatePayloadFromSimpleForm(form, joiningIso));
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? t.errors.checkForm);
    }
    await create.mutateAsync(parsed.data);
    goBackToList();
  }

  return (
    <DeliveryBoyFormScreen
      title={t.form.addTitle}
      saveLabel={t.form.addSave}
      initialForm={initialForm}
      isPending={create.isPending}
      onSave={onSave}
      onCancel={goBackToList}
    />
  );
}
