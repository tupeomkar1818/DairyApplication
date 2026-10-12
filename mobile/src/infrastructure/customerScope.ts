import { readAuthSessionResponse } from '@/src/infrastructure/auth/sessionRead';
import { services } from '@/src/infrastructure/service-registry';

/**
 * Whether this app may read every customer right now.
 *
 * On a phone that keeps its own records it may: everything is on the phone. With the dairy's server, one household
 * must never see another's, so the list is the dairy's alone — a customer is given their own record instead. Jobs
 * that walk the whole list (the 6 pm reminders, the one-off migration) ask here first, so a customer's app does not
 * keep calling for something the server is right to refuse.
 */
export async function mayReadEveryCustomer(): Promise<boolean> {
  const fromServer = typeof (services.customers as { getMine?: unknown }).getMine === 'function';
  if (!fromServer) return true;
  const session = await readAuthSessionResponse();
  return session?.role === 'admin';
}
