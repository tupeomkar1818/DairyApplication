import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import type { AuthSessionResponse } from '@/src/domain/auth/dtos';
import type { AuthSession } from '@/src/domain/auth/entities';
import { SESSION_ID_STORAGE_KEY, SESSION_STORE_PREFIX } from '@/src/infrastructure/storage/keys';

async function sessionGetItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return AsyncStorage.getItem(`${SESSION_STORE_PREFIX}${key}`);
  }
  return SecureStore.getItemAsync(key);
}

async function sessionSetItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(`${SESSION_STORE_PREFIX}${key}`, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function sessionDeleteItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(`${SESSION_STORE_PREFIX}${key}`);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Reads the active auth session (shared by profile and other modules). */
export async function readAuthSessionResponse(): Promise<AuthSessionResponse | null> {
  const sessionId = await sessionGetItem(SESSION_ID_STORAGE_KEY);
  if (!sessionId) return null;

  const raw = await sessionGetItem(sessionId);
  if (!raw) return null;

  const session = JSON.parse(raw) as AuthSession;
  return {
    sessionId: session.id,
    userId: session.userId,
    mobileNumber: session.mobileNumber,
    role: session.role,
    createdAt: session.createdAt,
  };
}

/** Updates mobile on the active session after profile mobile change. */
export async function updateAuthSessionMobile(newMobileNumber: string): Promise<void> {
  const sessionId = await sessionGetItem(SESSION_ID_STORAGE_KEY);
  if (!sessionId) return;

  const raw = await sessionGetItem(sessionId);
  if (!raw) return;

  const session = JSON.parse(raw) as AuthSession;
  const updated: AuthSession = {
    ...session,
    mobileNumber: newMobileNumber,
    updatedAt: nowIso(),
  };
  await sessionSetItem(sessionId, JSON.stringify(updated));
}

/** The token the phone signed in with (the session's id), or null when nobody is signed in. */
export async function readStoredSessionToken(): Promise<string | null> {
  return sessionGetItem(SESSION_ID_STORAGE_KEY);
}

/** Keeps a session the server started, in the same place the on-phone sign-in keeps its own. */
export async function saveAuthSession(session: AuthSessionResponse): Promise<void> {
  const stored: AuthSession = {
    id: session.sessionId,
    userId: session.userId,
    mobileNumber: session.mobileNumber,
    role: session.role,
    createdAt: session.createdAt,
    updatedAt: nowIso(),
  };
  await sessionSetItem(session.sessionId, JSON.stringify(stored));
  await sessionSetItem(SESSION_ID_STORAGE_KEY, session.sessionId);
}

/** Forgets the session on this phone: signing out, or a server that no longer accepts it. */
export async function clearStoredSession(): Promise<void> {
  const sessionId = await sessionGetItem(SESSION_ID_STORAGE_KEY);
  if (sessionId) await sessionDeleteItem(sessionId);
  await sessionDeleteItem(SESSION_ID_STORAGE_KEY);
}
