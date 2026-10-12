import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

/**
 * Guards against the calendar crash coming back.
 *
 * `@react-native-community/datetimepicker` is a native component: on iOS a prop outside its native enum (e.g.
 * `display="calendar"`) aborts the whole app instead of raising an error React could catch. Every date field goes
 * through the JavaScript `DatePickerModal` instead, which renders the same on iOS, Android and web.
 */
const ROOT = path.resolve(__dirname, '../../..');
const SOURCE_DIRS = ['app', 'src', 'components'];

function sourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sourceFiles(full);
    return /\.(tsx?|jsx?)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe('date pickers', () => {
  const files = SOURCE_DIRS.flatMap((d) => sourceFiles(path.join(ROOT, d)));

  it('finds the app sources', () => {
    expect(files.some((f) => f.endsWith(path.join('shared', 'DatePickerModal.tsx')))).toBe(true);
  });

  it('never renders the native date picker component', () => {
    const offenders = files
      .filter((f) => /from\s+['"]@react-native-community\/datetimepicker['"]/.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(ROOT, f));
    expect(offenders).toEqual([]);
  });

  it('opens calendars through the shared DatePickerModal only', () => {
    const offenders = files
      .filter((f) => !f.endsWith(path.join('shared', 'DatePickerModal.tsx')))
      .filter((f) => /from\s+['"]react-native-calendars['"]/.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(ROOT, f));
    expect(offenders).toEqual([]);
  });
});
