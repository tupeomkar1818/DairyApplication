import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

type StorageKeyChangeListener = (key: string) => void;

const listenersByKey = new Map<string, Set<StorageKeyChangeListener>>();

let sharedChannel: BroadcastChannel | null = null;
let sharedChannelInitialized = false;

function getSharedChannel(): BroadcastChannel | null {
  if (Platform.OS !== 'web') return null;
  if (sharedChannelInitialized) return sharedChannel;
  sharedChannelInitialized = true;
  try {
    sharedChannel = new BroadcastChannel('dairy_storage_v1');
    sharedChannel.addEventListener('message', (ev: MessageEvent) => {
      const data = (ev as MessageEvent<{ type?: string; key?: string }>).data;
      if (data?.type === 'storage_key_changed' && typeof data.key === 'string') {
        notifyLocal(data.key);
      }
    });
  } catch {
    sharedChannel = null;
  }
  return sharedChannel;
}

function notifyLocal(key: string) {
  const set = listenersByKey.get(key);
  if (!set?.size) return;
  for (const cb of set) cb(key);
}

function broadcastWeb(key: string) {
  const ch = getSharedChannel();
  if (!ch) return;
  try {
    ch.postMessage({ type: 'storage_key_changed', key });
  } catch {
    // ignore
  }
}

function notifyKeyChanged(key: string) {
  notifyLocal(key);
  broadcastWeb(key);
}

export function subscribeStorageKey(key: string, cb: StorageKeyChangeListener): () => void {
  const set = listenersByKey.get(key) ?? new Set<StorageKeyChangeListener>();
  set.add(cb);
  listenersByKey.set(key, set);

  // Ensure the shared channel exists so cross-tab messages are delivered.
  getSharedChannel();

  return () => {
    const cur = listenersByKey.get(key);
    if (cur) {
      cur.delete(cb);
      if (!cur.size) listenersByKey.delete(key);
    }
  };
}

export async function readJson<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  return JSON.parse(raw) as T;
}

export async function writeJson<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
  notifyKeyChanged(key);
}

