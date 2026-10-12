import { getLanguage, type Lang } from '@/src/i18n/language';

/**
 * Notes the app itself writes into records in English — change history ("Status updated"), reasons on a day
 * ("Paused from the app"), payment notes — shown in the reader's language. The records keep the English (code and
 * older data match on it); only the display changes. Text a person typed is not in this table and shows as typed.
 *
 * Add an entry here whenever code starts saving a new fixed phrase that people read.
 */

/** Whole notes, English → Marathi. */
const EXACT_MR: Record<string, string> = {
  // Delivery boy change history
  'Joined company': 'कामावर रुजू झाले',
  'Aadhaar updated': 'आधार बदलला',
  'Additional route updated': 'अतिरिक्त मार्ग बदलला',
  'Address updated': 'पत्ता बदलला',
  'Alternate mobile updated': 'पर्यायी मोबाइल बदलला',
  'App access updated': 'ॲप वापराची परवानगी बदलली',
  'Assigned routes updated': 'दिलेले मार्ग बदलले',
  'Bank details updated': 'बँक तपशील बदलला',
  'Emergency contact name updated': 'आपत्कालीन संपर्काचे नाव बदलले',
  'Emergency contact number updated': 'आपत्कालीन संपर्क नंबर बदलला',
  'Extra route payment default updated': 'अतिरिक्त मार्गाचे ठरलेले पेमेंट बदलले',
  'Full name updated': 'पूर्ण नाव बदलले',
  'Incentive amount updated': 'प्रोत्साहन रक्कम बदलली',
  'Joining date updated': 'रुजू तारीख बदलली',
  'Leave salary rule updated': 'रजेच्या पगाराचा नियम बदलला',
  'Mobile number updated': 'मोबाइल नंबर बदलला',
  'Monthly salary updated': 'मासिक पगार बदलला',
  'PAN updated': 'PAN बदलला',
  'Paid leave allowance (per month) updated': 'पगारी रजा (दरमहा) बदलली',
  'Per day salary updated': 'रोजचा पगार बदलला',
  'Photo updated': 'फोटो बदलला',
  'Primary route updated': 'मुख्य मार्ग बदलला',
  'Reason for leaving updated': 'काम सोडण्याचे कारण बदलले',
  'Replacement payment default updated': 'बदली कामाचे ठरलेले पेमेंट बदलले',
  'Replacement per-day salary updated': 'बदली कामाचा रोजचा पगार बदलला',
  'Salary type updated': 'पगाराचा प्रकार बदलला',
  'Shift timing updated': 'कामाची वेळ बदलली',
  'Sick leave paid flag updated': 'आजारपणाची रजा पगारी की नाही ते बदलले',
  'Status updated': 'स्थिती बदलली',
  'Temporary replacement allowed updated': 'तात्पुरत्या बदलीची परवानगी बदलली',
  'UPI ID updated': 'UPI आयडी बदलला',
  'Weekly off updated': 'साप्ताहिक सुट्टी बदलली',
  'Backup delivery boy updated': 'पर्यायी डिलिव्हरी बॉय बदलला',
  'Replacement assignee updated': 'बदली व्यक्ती बदलली',
  'Last working date updated': 'कामाचा शेवटचा दिवस बदलला',
  'Replacement start date updated': 'बदली सुरू होण्याची तारीख बदलली',
  'Replacement end date updated': 'बदली संपण्याची तारीख बदलली',
  'Previous image': 'आधीचा फोटो',
  'New image': 'नवीन फोटो',
  Removed: 'काढला',
  // Attendance history
  Created: 'नोंद केली',
  'Status Updated': 'स्थिती बदलली',
  Deleted: 'हटवली',
  'Marked Absent from admin attendance': 'ॲडमिनने हजेरीत गैरहजर नोंदवले',
  'From attendance': 'हजेरीवरून',
  'Attendance row deleted by admin': 'ॲडमिनने हजेरीची नोंद हटवली',
  // Reasons on a customer's day
  'Paused from the app': 'ॲपमधून थांबवले',
  'Kept at the old quantity: already arranged when the daily quantity changed':
    'जुन्या प्रमाणातच ठेवले: रोजचे प्रमाण बदलले तेव्हा आधीच तयारी झाली होती',
  'Marked not delivered by delivery app': 'डिलिव्हरी ॲपमधून डिलिव्हर झाले नाही अशी नोंद',
  // Records
  Unassigned: 'कोणालाही दिलेले नाही',
  Admin: 'ॲडमिन',
};

/** Notes with a value inside, English pattern → Marathi. */
const PATTERNS_MR: [RegExp, (...groups: string[]) => string][] = [
  [/^Route cover \(([^)]*)\)$/, (name) => `मार्ग बदली (${name})`],
  [/^Bill payment for (\d{4}-\d{2})$/, (month) => `${month} चे बिल पेमेंट`],
  [/^Paid from the customer app \(([^)]*)\)(.*)$/s, (method, rest) => `ग्राहक ॲपमधून भरले (${method})${rest}`],
  [/^App payment confirmed \((.*)\)$/s, (detail) => `ॲपमधील पेमेंट निश्चित केले (${detail})`],
  [/^Payment marked paid for (\S+) \((full|partial) (.*)\)$/s, (month, kind, amount) =>
    `${month} चे पेमेंट भरले म्हणून नोंदवले (${kind === 'full' ? 'पूर्ण' : 'अंशतः'} ${amount})`],
  [/^Payment marked unpaid for (\S+)$/, (month) => `${month} चे पेमेंट न भरलेले म्हणून नोंदवले`],
  [/^Status updated to (.*)$/, (status) => `स्थिती बदलून ${status} केली`],
];

/** A note the app saved, in `lang` (the app's language by default). Unknown text is returned as it is. */
export function storedText(text: string | null | undefined, lang: Lang = getLanguage()): string {
  const value = String(text ?? '');
  if (lang === 'en' || !value) return value;
  const trimmed = value.trim();
  const exact = EXACT_MR[trimmed];
  if (exact) return exact;
  for (const [pattern, build] of PATTERNS_MR) {
    const m = trimmed.match(pattern);
    if (m) return build(...m.slice(1));
  }
  // "Route cover (Sagar), Route cover (Amit)" — a list of notes.
  if (trimmed.includes(', ') && trimmed.split(', ').every((part) => PATTERNS_MR.some(([p]) => p.test(part)) || EXACT_MR[part])) {
    return trimmed
      .split(', ')
      .map((part) => storedText(part, lang))
      .join(', ');
  }
  return value;
}

/** For tests: every whole note that has a Marathi version. */
export const STORED_TEXT_EXACT_KEYS = Object.keys(EXACT_MR);
