// Depends on: shared (enums, errors, types)
// Reads (mock login linkage, read-only): customers (Customer.mobile/status/appAccessEnabled),
//   deliveryBoys (DeliveryBoy.mobileNumber/status/appAccessEnabled) — User.linkedRecordId references their ids.
export * from '@/src/domain/auth/entities';
export * from '@/src/domain/auth/dtos';
export * from '@/src/domain/auth/validations';
export * from '@/src/domain/auth/service.interface';

