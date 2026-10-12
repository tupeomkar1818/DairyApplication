# App languages: English and Marathi

Every word the app shows comes from a dictionary here, in English (`en/`) and Marathi (`mr/`). The reader picks the
language on the sign-in screen or in their profile; it applies to all three apps at once and is remembered on the phone
(`languageStorage.ts`). English is the default unless the phone itself is set to Marathi.

## Using it

```tsx
import { useStrings } from '@/src/i18n/useStrings';

const t = useStrings('billing');         // re-renders when the language changes
<Text>{t.title}</Text>
<Text>{t.dueOn(formatDay(bill.dueYmd))}</Text>
```

Outside React (validation messages, service errors, notification text, report builders):

```ts
import { strings } from '@/src/i18n/strings';

throw new DomainError('CUSTOMER_NOT_FOUND', strings('customers').errors.notFound);
```

- **One namespace per area** (`en/<namespace>.ts`), and its Marathi twin `mr/<namespace>.ts` typed `typeof En`, so a
  missing or extra Marathi entry is a TypeScript error. `common` holds words used everywhere (Save, Cancel, dates).
- **Sentences with values are functions**, so each language can order the words its own way:
  `paidOn: (amount: string, day: string) => \`${amount} paid on ${day}\`` / `(amount, day) => \`${day} रोजी ${amount} भरले\``.
  Pass values already formatted (`formatMoney`, `formatDay`); dictionary files import nothing.
- **Plurals** are functions too: `(n: number) => \`${n} ${n === 1 ? 'day' : 'days'}\``.
- **Read text when it is shown**, never into a module-level constant (it would stay in the language the app started
  in). A constant list of options keeps keys/ids; the label is looked up at render. When `useMemo` builds text, put
  `useLanguage()` in its deps.
- **zod messages** use the function form so they follow the language: `.min(1, { error: () => strings('customers').errors.nameRequired })`.
- **Dates** come from `@/src/utils/format` (`formatDay`, `formatMonth`, `formatTime`, …), which already follow the
  language. Digits stay 0-9 in both languages; money stays `₹1,234`.
- **Data people typed** (customer and product names, addresses, pack labels such as "500 ml") is shown as entered.
- The English wording must stay exactly as it was: tests read it.

`dictionary.test.ts` fails when a Marathi entry is missing, empty, or still an English sentence.

## Marathi wording

Plain, everyday Marathi as spoken in Pune — the way the dairy talks to its customers, not formal or Sanskritised
Marathi. Use the polite plural for the reader (तुम्ही, तुमचे, "करा"). Keep English words people already use in Marathi
(डिलिव्हरी, बिल, पेमेंट, ॲप, OTP, UPI, WhatsApp) instead of inventing translations. Buttons are short verbs
(जतन करा, रद्द करा).

| English | Marathi |
| --- | --- |
| Amrale Dairy | अमराळे डेअरी |
| Admin | ॲडमिन |
| Customer | ग्राहक |
| Delivery boy / delivery partner | डिलिव्हरी बॉय |
| Delivery | डिलिव्हरी |
| Subscription / plan | सबस्क्रिप्शन / प्लॅन |
| Add-on (extra item for a day) | अतिरिक्त ऑर्डर |
| Order | ऑर्डर |
| Product | उत्पादन (plural उत्पादने) |
| Milk / Cow milk / Buffalo milk | दूध / गाईचे दूध / म्हशीचे दूध |
| Curd / Paneer / Ghee / Butter | दही / पनीर / तूप / लोणी |
| Pack, pack size | पॅक, पॅक साईज |
| Quantity | प्रमाण |
| Price / Rate | किंमत / दर |
| Bill / Bills | बिल / बिलं |
| Payment / Pay | पेमेंट / भरा |
| Paid / Due / Outstanding / Advance | भरले / बाकी / थकबाकी / आगाऊ |
| Amount / Total | रक्कम / एकूण |
| Cash | रोख |
| Pause / Resume / Skip a day | थांबवा / पुन्हा सुरू करा / एक दिवस रद्द करा |
| Today / Tomorrow / Yesterday | आज / उद्या / काल |
| Month / This month | महिना / हा महिना |
| Route / Area | मार्ग / भाग |
| Stop (a house on the route) | घर |
| Attendance / Present / Absent / Leave | हजेरी / हजर / गैरहजर / रजा |
| Salary | पगार |
| Report | अहवाल |
| Notification | सूचना |
| Announcement | घोषणा |
| Chat / Message | चॅट / मेसेज |
| Profile | प्रोफाइल |
| Sign in / Log out | साइन इन / लॉग आउट |
| Mobile number | मोबाइल नंबर |
| Settings | सेटिंग्ज |
| Save / Cancel / Delete / Edit | जतन करा / रद्द करा / हटवा / बदला |
| Pending / Confirmed / Rejected / Cancelled | प्रलंबित / निश्चित / नाकारले / रद्द |
| Active / Inactive | सक्रिय / निष्क्रिय |
| Search | शोधा |
| Category | प्रकार |
| Litre / ml / kg | लिटर / ml / kg (units stay as written) |

The Marathi text should be read by someone at the dairy before release; wording fixes only touch `mr/*.ts`.
