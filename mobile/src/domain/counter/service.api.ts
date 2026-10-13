import type { CounterDay, CounterSale, DeskUser, Manager } from '@/src/domain/counter/entities';
import type { ICounterService, PlaceSaleRequest } from '@/src/domain/counter/service.interface';
import { api } from '@/src/infrastructure/api/client';

/**
 * The counter, against the dairy's server.
 *
 * Nothing here works out a total. The lines go up and the server says what the sale came to — a bill is money, and
 * there is one copy of it that counts.
 */
export class CounterServiceApi implements ICounterService {
  async placeSale(data: PlaceSaleRequest): Promise<CounterSale> {
    return api.post<CounterSale>('/counter/sales', {
      lines: data.lines,
      discount: data.discount ?? 0,
      paidBy: data.paidBy,
      note: data.note ?? '',
      ...(data.customerId ? { customerId: data.customerId } : {}),
      ...(data.clientRef ? { clientRef: data.clientRef } : {}),
    });
  }

  async markPrinted(id: string): Promise<CounterSale> {
    return api.post<CounterSale>(`/counter/sales/${encodeURIComponent(id)}/printed`, {});
  }

  async salesOn(ymd?: string): Promise<{ ymd: string; items: CounterSale[] }> {
    return api.get<{ ymd: string; items: CounterSale[] }>(`/counter/sales${ymd ? `?ymd=${encodeURIComponent(ymd)}` : ''}`);
  }

  async day(range?: { from: string; to?: string }): Promise<CounterDay> {
    const query = range ? `?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to ?? range.from)}` : '';
    return api.get<CounterDay>(`/counter/day${query}`);
  }

  async listDeskUsers(): Promise<DeskUser[]> {
    return (await api.get<{ items: DeskUser[] }>('/desk-users')).items ?? [];
  }

  async addDeskUser(data: Partial<DeskUser>): Promise<DeskUser> {
    return api.post<DeskUser>('/desk-users', data);
  }

  async updateDeskUser(id: string, data: Partial<DeskUser>): Promise<DeskUser> {
    return api.patch<DeskUser>(`/desk-users/${encodeURIComponent(id)}`, data);
  }

  async removeDeskUser(id: string): Promise<void> {
    await api.delete<void>(`/desk-users/${encodeURIComponent(id)}`);
  }

  async listManagers(): Promise<Manager[]> {
    return (await api.get<{ items: Manager[] }>('/admins')).items ?? [];
  }

  async addManager(data: { name: string; mobile: string }): Promise<Manager> {
    return api.post<Manager>('/admins', data);
  }

  async removeManager(id: string): Promise<void> {
    await api.delete<void>(`/admins/${encodeURIComponent(id)}`);
  }
}
