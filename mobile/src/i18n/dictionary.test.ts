import { describe, expect, it } from 'vitest';

import { getLanguage, setLanguage } from '@/src/i18n/language';
import { dictionaryFor, strings } from '@/src/i18n/strings';

/** Marathi text is written in Devanagari. */
const DEVANAGARI = /[ऀ-ॿ]/;
/** English wording (two or more words of letters) that a Marathi reader would need translated. */
const ENGLISH_WORDING = /[A-Za-z]{2,}[^A-Za-z]+[A-Za-z]{2,}/;

type Leaf = { path: string; en: unknown; mr: unknown };

function leaves(en: unknown, mr: unknown, path = ''): Leaf[] {
  if (en && typeof en === 'object') {
    const keys = new Set([...Object.keys(en as object), ...Object.keys((mr ?? {}) as object)]);
    return [...keys].flatMap((k) =>
      leaves((en as Record<string, unknown>)[k], ((mr ?? {}) as Record<string, unknown>)[k], path ? `${path}.${k}` : k),
    );
  }
  return [{ path, en, mr }];
}

/** Sample arguments for a wording function: numbers for count-like names, text otherwise. */
function sampleArgs(fn: (...args: never[]) => unknown): unknown[] {
  const params = /\(([^)]*)\)/.exec(fn.toString())?.[1] ?? '';
  return params
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => (/^(n|count|hours24|days|qty|total|amount|number|index|minutes|hours|months|years)\b/i.test(p) ? 2 : 'X'));
}

describe('app dictionaries', () => {
  const all = leaves(dictionaryFor('en'), dictionaryFor('mr'));

  it('has the same entries in English and Marathi', () => {
    const missing = all.filter((l) => typeof l.en !== typeof l.mr).map((l) => l.path);
    expect(missing).toEqual([]);
  });

  it('has no empty wording', () => {
    const empty = all.filter((l) => (typeof l.en === 'string' && !l.en.trim()) || (typeof l.mr === 'string' && !l.mr.trim()));
    expect(empty.map((l) => l.path)).toEqual([]);
  });

  it('translates English sentences into Marathi', () => {
    const untranslated = all
      .flatMap((l) => {
        if (typeof l.en === 'string' && typeof l.mr === 'string') return [{ path: l.path, en: l.en, mr: l.mr }];
        if (typeof l.en === 'function' && typeof l.mr === 'function') {
          const args = sampleArgs(l.en as never);
          return [{ path: l.path, en: String((l.en as (...a: unknown[]) => unknown)(...args)), mr: String((l.mr as (...a: unknown[]) => unknown)(...args)) }];
        }
        return [];
      })
      .filter((l) => ENGLISH_WORDING.test(l.en.replace(/\bX\b/g, '')) && !DEVANAGARI.test(l.mr))
      .map((l) => `${l.path}: ${l.mr}`);
    expect(untranslated).toEqual([]);
  });

  it('follows the chosen language', () => {
    const before = getLanguage();
    try {
      setLanguage('mr');
      expect(strings('common').actions.save).toBe('जतन करा');
      setLanguage('en');
      expect(strings('common').actions.save).toBe('Save');
    } finally {
      setLanguage(before);
    }
  });
});
