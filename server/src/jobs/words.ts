/**
 * The few sentences the server writes itself, in both languages.
 *
 * Everywhere else the apps write the words and the server stores them. The evening reminders are different: nobody
 * is holding a phone when they go out, so the words are written here — and a customer reading in Marathi must get
 * Marathi. These are copies of the app's own wording and date names:
 *
 * - `mobile/src/i18n/{en,mr}/inbox.ts` → `reminders`
 * - `mobile/src/i18n/{en,mr}/common.ts` → `dates`
 * - `mobile/src/i18n/{en,mr}/offerCustomer.ts` → `notification`
 *
 * Keep them in step with those files. Everything else a reader sees still comes from the app.
 */

export type Lang = 'en' | 'mr';
export const LANGUAGES: readonly Lang[] = ['en', 'mr'];

const DATES = {
  en: {
    monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    monthsLong: [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ],
    weekdaysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    time: (hm: string, hours24: number) => `${hm} ${hours24 < 12 ? 'am' : 'pm'}`,
  },
  mr: {
    monthsShort: ['जाने', 'फेब्रु', 'मार्च', 'एप्रिल', 'मे', 'जून', 'जुलै', 'ऑग', 'सप्टें', 'ऑक्टो', 'नोव्हें', 'डिसें'],
    monthsLong: [
      'जानेवारी',
      'फेब्रुवारी',
      'मार्च',
      'एप्रिल',
      'मे',
      'जून',
      'जुलै',
      'ऑगस्ट',
      'सप्टेंबर',
      'ऑक्टोबर',
      'नोव्हेंबर',
      'डिसेंबर',
    ],
    weekdaysShort: ['रवि', 'सोम', 'मंगळ', 'बुध', 'गुरु', 'शुक्र', 'शनि'],
    time: (hm: string, hours24: number) => {
      const part = hours24 < 4 ? 'रात्री' : hours24 < 12 ? 'सकाळी' : hours24 < 16 ? 'दुपारी' : hours24 < 20 ? 'संध्याकाळी' : 'रात्री';
      return `${part} ${hm}`;
    },
  },
} as const;

/** "Mon, 12 Oct" / "सोम, 12 ऑक्टो" — the dairy's own day, whatever time zone the server thinks it is in. */
export function formatDay(ymd: string, lang: Lang, options: { weekday?: boolean } = {}): string {
  const date = new Date(`${ymd}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return ymd;
  const names = DATES[lang];
  // Digits stay 0-9 in both languages, as they do in the apps.
  const day = `${String(date.getUTCDate()).padStart(2, '0')} ${names.monthsShort[date.getUTCMonth()]}`;
  return options.weekday ? `${names.weekdaysShort[date.getUTCDay()]}, ${day}` : day;
}

/** "September 2026" / "सप्टेंबर 2026". */
export function formatMonth(yyyyMm: string, lang: Lang): string {
  const m = String(yyyyMm ?? '').match(/^(\d{4})-(\d{2})$/);
  if (!m) return yyyyMm;
  return `${DATES[lang].monthsLong[Number(m[2]) - 1]} ${m[1]}`;
}

/** "6 pm" / "संध्याकाळी 6". */
export function timeLabel(hour: number, lang: Lang): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return DATES[lang].time(String(h12), hour);
}

/** ₹ with Indian grouping and English digits in both languages: ₹1,25,000 · ₹32.50. */
export function money(amount: number): string {
  const rounded = Math.round(Math.abs(amount) * 100) / 100;
  const whole = Math.floor(rounded);
  const paise = Math.round((rounded - whole) * 100);
  const digits = String(whole);
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  const grouped = rest ? `${rest},${last3}` : last3;
  return `${amount < 0 ? '-' : ''}₹${grouped}${paise ? `.${String(paise).padStart(2, '0')}` : ''}`;
}

export const WORDS = {
  en: {
    reminderTitle: (day: string) => `Tomorrow's order · ${day}`,
    reminderBody: (items: string, amount: string, time: string) =>
      `${items} · ${amount}. Do you want to change it, or keep it as it is? You can change it until ${time} today.`,
    reminderBodyWithExtras: (items: string, n: number, amount: string, time: string) =>
      `${items} (includes ${n === 1 ? '1 extra item' : `${n} extra items`}) · ${amount}. Do you want to change it, or keep it as it is? You can change it until ${time} today.`,
    adminSummaryTitle: (day: string) => `Order reminders sent for ${day}`,
    adminSummaryBody: (count: number, reminderTime: string, cutoffTime: string) =>
      `${count} ${count === 1 ? 'customer was' : 'customers were'} asked at ${reminderTime} whether to change tomorrow's order or keep it as it is. They can change it until ${cutoffTime}.`,
    answersTitle: (day: string) => `Answers for ${day}`,
    answersBody: (keep: number, change: number) => `${keep} kept tomorrow's order as it is, ${change} chose to change it.`,
    answersLatestKeep: (name: string) => `Latest: ${name} — keep as it is.`,
    answersLatestChange: (name: string) => `Latest: ${name} — change.`,
    offerTitle: 'A new offer for you',
    offerBody: (title: string, validity: string) => `${title}. ${validity}`,
    offerValidTill: (day: string) => `Valid till ${day}.`,
    offerUntilEnded: 'Running until the dairy ends it.',
    billTitle: (month: string) => `Bill for ${month}`,
    billBody: (total: string) => `${total}.`,
    billDueBody: (total: string, day: string) => `${total}, due ${day}.`,
    billsAdminTitle: (month: string) => `Bills for ${month}`,
    billsAdminBody: (count: number, total: string) =>
      `${count} ${count === 1 ? 'bill' : 'bills'} came to ${total} in all.`,
  },
  mr: {
    reminderTitle: (day: string) => `उद्याची ऑर्डर · ${day}`,
    reminderBody: (items: string, amount: string, time: string) =>
      `${items} · ${amount}. ऑर्डर बदलायची आहे की आहे तशीच ठेवायची? आज ${time} पर्यंत बदलू शकता.`,
    reminderBodyWithExtras: (items: string, n: number, amount: string, time: string) =>
      `${items} (${n === 1 ? '1 अतिरिक्त वस्तूसह' : `${n} अतिरिक्त वस्तूंसह`}) · ${amount}. ऑर्डर बदलायची आहे की आहे तशीच ठेवायची? आज ${time} पर्यंत बदलू शकता.`,
    adminSummaryTitle: (day: string) => `${day} साठी ऑर्डर रिमाइंडर पाठवले`,
    adminSummaryBody: (count: number, reminderTime: string, cutoffTime: string) =>
      `${count} ${count === 1 ? 'ग्राहकाला' : 'ग्राहकांना'} ${reminderTime} वाजता विचारले की उद्याची ऑर्डर बदलायची की आहे तशीच ठेवायची. ${cutoffTime} पर्यंत बदल करता येईल.`,
    answersTitle: (day: string) => `${day} साठी उत्तरे`,
    answersBody: (keep: number, change: number) => `${keep} जणांनी उद्याची ऑर्डर आहे तशीच ठेवली, ${change} जणांनी बदलायचे ठरवले.`,
    answersLatestKeep: (name: string) => `शेवटचे: ${name} — आहे तशीच ठेवा.`,
    answersLatestChange: (name: string) => `शेवटचे: ${name} — बदल.`,
    offerTitle: 'तुमच्यासाठी नवीन ऑफर',
    offerBody: (title: string, validity: string) => `${title}. ${validity}`,
    offerValidTill: (day: string) => `${day} पर्यंत.`,
    offerUntilEnded: 'डेअरी थांबवेपर्यंत सुरू.',
    billTitle: (month: string) => `${month} चे बिल`,
    billBody: (total: string) => `${total}.`,
    billDueBody: (total: string, day: string) => `${total}, ${day} पर्यंत भरा.`,
    billsAdminTitle: (month: string) => `${month} ची बिले`,
    billsAdminBody: (count: number, total: string) => `${count} बिले, एकूण ${total}.`,
  },
} as const;

/** The same row written in every language: English in `title` / `body`, the rest in `translations`. */
export function inEveryLanguage(write: (lang: Lang) => { title: string; body: string }): {
  title: string;
  body: string;
  translations?: { mr: { title: string; body: string } };
} {
  const en = write('en');
  const mr = write('mr');
  const same = mr.title === en.title && mr.body === en.body;
  return { title: en.title, body: en.body, ...(same ? {} : { translations: { mr } }) };
}
