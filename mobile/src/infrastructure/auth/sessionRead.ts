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
