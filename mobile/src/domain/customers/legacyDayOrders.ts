import { MAX_DAY_QUANTITY, usualQuantity } from '@/src/domain/customers/daySchedule';
import type { CustomerDailyProductOrderLineDto, CustomerResponse } from '@/src/domain/customers/dtos';
import { subscriptionPlanActiveOnDateYmd } from '@/src/domain/customers/planSchedule';
import type { ProductResponse } from '@/src/domain/products/dtos';
import { packPrice, productFromPrice, productPacks } from '@/src/domain/products/packs';

/**
 * The admin's older "day orders" — rows kept in a store of their own that only the admin's calendar read, so the
 * customer, the delivery boy and the bill never saw them — rewritten as the records every app shares:
 *
 * - a row for a subscription line running that day is a quantity change for that day (from today on; earlier days
 *   are already delivered and billed);
 * - any other row is an add-on: delivered when the delivery boy marked that product delivered that day, pending when
 *   the day is still ahead, cancelled when the day went by without it.
 *
 * Ids are derived from the old rows, so running it twice adds nothing twice.
 */

type ExtraOrder = NonNullable<CustomerResponse['extraOrders']>[number];
type Exception = NonNullable<CustomerResponse['subscriptionExceptions']>[number];

function norm(value: unknown): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function convertLegacyDayOrders(input: {
  customer: CustomerResponse;
  lines: readonly CustomerDailyProductOrderLineDto[];
  products: readonly ProductResponse[];
  today: string;
  nowIso?: string;
}): Pick<CustomerResponse, 'extraOrders' | 'subscriptionExceptions'> | null {
  const { customer, lines, products, today } = input;
  const nowIso = input.nowIso ?? new Date().toISOString();

  const extraOrders: ExtraOrder[] = [...(customer.extraOrders ?? [])];
  const exceptions: Exception[] = [...(customer.subscriptionExceptions ?? [])];
  const knownIds = new Set([...extraOrders.map((o) => o.id), ...exceptions.map((e) => e.id)]);
  let changed = false;

  for (const line of lines) {
    const ymd = String(line.dateYmd ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) continue;
    const items = Math.max(1, Math.floor(Number(line.quantity) || 1));

    const plan = (customer.subscriptionPlans ?? []).find(
      (p) =>
        norm(p.productName) === norm(line.productName) &&
        norm(p.quantityLabel) === norm(line.quantityLabel) &&
        subscriptionPlanActiveOnDateYmd(p, ymd),
    );

    if (plan) {
      const id = `qty_legacy_${line.id}`;
      if (ymd < today || knownIds.has(id) || items === usualQuantity(plan) || !plan.id) continue;
      exceptions.push({
        id,
        kind: 'quantity',
        fromYmd: ymd,
        toYmd: ymd,
        planId: plan.id,
        numberOfItems: Math.min(MAX_DAY_QUANTITY, items),
        createdBy: 'admin',
        createdAt: line.createdAtIso ?? nowIso,
        updatedAt: nowIso,
      } as Exception);
      knownIds.add(id);
      changed = true;
      continue;
    }

    const id = `extra_legacy_${line.id}`;
    if (knownIds.has(id)) continue;

    const product = products.find((p) => norm(p.name) === norm(line.productName));
    const pack = product ? productPacks(product).find((p) => norm(p.label) === norm(line.quantityLabel)) : undefined;
    const price = pack ? packPrice(pack) : product ? productFromPrice(product) : 0;

    const delivered = (customer.deliveries ?? []).some(
      (d) =>
        d.status === 'Delivered' &&
        String(d.deliveryDate ?? '').slice(0, 10) === ymd &&
        norm(d.productName) === norm(line.productName),
    );

    extraOrders.push({
      id,
      orderDate: ymd,
      deliveryDate: ymd,
      productName: String(line.productName ?? '').trim(),
      quantityLabel: String(line.quantityLabel ?? '').trim(),
      unit: line.unitType,
      numberOfItems: items,
      packId: pack?.id,
      price,
      status: delivered ? 'Delivered' : ymd < today ? 'Cancelled' : 'Pending',
      placedBy: 'admin',
      createdAt: line.createdAtIso ?? nowIso,
      updatedAt: nowIso,
    } as ExtraOrder);
    knownIds.add(id);
    changed = true;
  }

  return changed ? { extraOrders, subscriptionExceptions: exceptions } : null;
}
