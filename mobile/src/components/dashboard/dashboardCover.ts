import { Image, Platform } from 'react-native';

import type { DashboardCoverImage } from '@/src/domain/adminDashboard/entities';

export const DEFAULT_DASHBOARD_COVER_ASSET = require('@/assets/images/admin-dashboard-cover.png');

type ImageModule = number | string | { uri: string; width?: number; height?: number };

type ResolvedAsset = { uri: string; width?: number; height?: number };

function aspectFromDimensions(width: number | undefined, height: number | undefined): number | null {
  if (width && height && height > 0) return width / height;
  return null;
}

/** Native-only; react-native-web does not implement this API. */
function tryResolveAssetSource(module: number): ResolvedAsset | null {
  const resolve = (Image as typeof Image & { resolveAssetSource?: (source: number) => ResolvedAsset })
    .resolveAssetSource;
  if (typeof resolve !== 'function') return null;
  return resolve(module) ?? null;
}

function uriFromBundledModule(module: ImageModule): string | null {
  if (typeof module === 'string') return module;
  if (typeof module === 'object' && module !== null && typeof module.uri === 'string') {
    return module.uri;
  }
  if (typeof module === 'number') {
    return tryResolveAssetSource(module)?.uri ?? null;
  }
  return null;
}

function measureWebImageAspectRatio(uri: string): Promise<number> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Window unavailable'));
      return;
    }
    const img = new window.Image();
    img.onload = () => {
      if (img.naturalHeight <= 0) {
        reject(new Error('Invalid image height'));
        return;
      }
      resolve(img.naturalWidth / img.naturalHeight);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = uri;
  });
}

export function measureImageAspectRatio(uri: string): Promise<number> {
  const measure =
    Platform.OS === 'web'
      ? () => measureWebImageAspectRatio(uri)
      : () =>
          new Promise<number>((resolve, reject) => {
            Image.getSize(
              uri,
              (width, height) => {
                if (height <= 0) {
                  reject(new Error('Invalid image height'));
                  return;
                }
                resolve(width / height);
              },
              reject,
            );
          });

  return measure();
}

async function resolveBundledAspectRatio(fallback: number): Promise<number> {
  const module = DEFAULT_DASHBOARD_COVER_ASSET as ImageModule;

  if (typeof module === 'object' && module !== null) {
    const fromMeta = aspectFromDimensions(module.width, module.height);
    if (fromMeta) return fromMeta;
    if (module.uri) {
      try {
        return await measureImageAspectRatio(module.uri);
      } catch {
        return fallback;
      }
    }
  }

  if (typeof module === 'number') {
    const resolved = tryResolveAssetSource(module);
    const fromResolved = aspectFromDimensions(resolved?.width, resolved?.height);
    if (fromResolved) return fromResolved;
    if (resolved?.uri) {
      try {
        return await measureImageAspectRatio(resolved.uri);
      } catch {
        return fallback;
      }
    }
  }

  const uri = uriFromBundledModule(module);
  if (uri) {
    try {
      return await measureImageAspectRatio(uri);
    } catch {
      return fallback;
    }
  }

  return fallback;
}

/** Reliable on native + web (no Image.onLoad / resolveAssetSource on web). */
export async function resolveCoverAspectRatio(cover: DashboardCoverImage): Promise<number> {
  if (cover.sourceType === 'bundled') {
    return resolveBundledAspectRatio(cover.aspectRatio);
  }

  try {
    return await measureImageAspectRatio(cover.uri);
  } catch {
    return cover.aspectRatio;
  }
}

export function resolveDashboardCoverSource(cover: DashboardCoverImage) {
  if (cover.sourceType === 'bundled') {
    return DEFAULT_DASHBOARD_COVER_ASSET;
  }
  return { uri: cover.uri };
}
