/**
 * Everything the website says about the dairy in one place — the same details as the app's Contact Us screen, so the
 * two never disagree. Change a phone number or the address here and every page follows.
 */

export const site = {
  name: 'Amrale Dairy',
  legalName: 'Shrikrishna Dairy Farms',
  nameMarathi: 'अमराळे',
  legalNameMarathi: 'श्रीकृष्ण डेअरी फार्मस्',
  foundedYear: 1976,
  url: 'https://dairy.matdarraja.in',
  taglineMarathi: 'कोथरूड मधील सुप्रसिद्ध डेअरी',
  tagline: "Kothrud's trusted dairy since 1976",
  categoriesMarathi: ['मिल्क', 'मिल्क प्रॉडक्ट्स', 'स्वीट्स'],

  phoneDisplay: '+91 99224 43636',
  phoneDial: '+919922443636',
  whatsappNumber: '919922443636',
  email: 'support@amraledairy.com',

  address: {
    line1: 'Sangam Chowk, 164/2, Shastri Nagar',
    area: 'Kothrud',
    city: 'Pune',
    region: 'Maharashtra',
    postalCode: '411038',
    country: 'IN',
  },
  mapShareUrl: 'https://share.google/QGK4LkSidDv5S1bcu',
  geo: { latitude: 18.5035, longitude: 73.8138 },
} as const;

export const fullAddress = `${site.address.line1}, ${site.address.area}, ${site.address.city}, ${site.address.region} ${site.address.postalCode}`;

export const mapEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(`${site.name}, ${fullAddress}`)}&z=16&output=embed`;

/** A WhatsApp chat with the dairy, with an opening message typed in for the customer. */
export function whatsappLink(message: string): string {
  return `https://wa.me/${site.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

export const yearsServing = new Date().getFullYear() - site.foundedYear;

export type Product = {
  id: string;
  name: string;
  nameMarathi: string;
  description: { en: string; mr: string };
  kind: 'daily' | 'fresh' | 'sweet';
};

/** The products on the dairy's own banner. Prices and pack sizes are confirmed with the dairy before they go up. */
export const products: Product[] = [
  {
    id: 'milk',
    name: 'Milk',
    nameMarathi: 'दूध',
    description: {
      en: 'Fresh milk delivered to your door every morning, in the pack size you choose.',
      mr: 'तुम्ही निवडलेल्या पॅकमध्ये, दररोज सकाळी ताजं दूध तुमच्या दारात.',
    },
    kind: 'daily',
  },
  {
    id: 'curd',
    name: 'Curd',
    nameMarathi: 'दही',
    description: {
      en: 'Fresh curd for every meal — add it to any day’s delivery.',
      mr: 'रोजच्या जेवणासाठी ताजं दही — कोणत्याही दिवसाच्या डिलिव्हरीत जोडा.',
    },
    kind: 'fresh',
  },
  {
    id: 'paneer',
    name: 'Paneer',
    nameMarathi: 'पनीर',
    description: { en: 'Fresh paneer for home cooking.', mr: 'घरच्या स्वयंपाकासाठी ताजं पनीर.' },
    kind: 'fresh',
  },
  {
    id: 'shrikhand',
    name: 'Shrikhand',
    nameMarathi: 'श्रीखंड',
    description: { en: 'The classic Maharashtrian sweet.', mr: 'पारंपरिक महाराष्ट्रीय गोड पदार्थ.' },
    kind: 'sweet',
  },
  {
    id: 'amrakhand',
    name: 'Amrakhand',
    nameMarathi: 'आम्रखंड',
    description: { en: 'Shrikhand with mango.', mr: 'आंब्याचं श्रीखंड.' },
    kind: 'sweet',
  },
  {
    id: 'sitaphal-rabdi',
    name: 'Sitaphal Rabdi',
    nameMarathi: 'सिताफळ रबडी',
    description: { en: 'Rabdi with custard apple (sitaphal).', mr: 'सिताफळाची रबडी.' },
    kind: 'sweet',
  },
];
