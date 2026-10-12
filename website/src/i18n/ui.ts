/**
 * Every word on the website, in English and Marathi.
 *
 * The Marathi dictionary is typed from the English one, so a sentence added in English and forgotten in Marathi is a
 * build error rather than a gap on the page. Numbers, prices and phone numbers stay in English digits in both
 * languages — they are clearer on bills and when paying by UPI.
 */

export const languages = { en: 'English', mr: 'मराठी' } as const;
export type Lang = keyof typeof languages;
export const defaultLang: Lang = 'en';

const en = {
  htmlLang: 'en-IN',
  ogLocale: 'en_IN',
  meta: {
    homeTitle: 'Amrale Dairy — Fresh Milk & Dairy Products in Kothrud, Pune | Since 1976',
    homeDescription:
      'Amrale Dairy (Shrikrishna Dairy Farms) — Kothrud’s trusted dairy since 1976. Fresh milk delivered daily, plus curd, paneer, shrikhand, amrakhand and sitaphal rabdi. Order on WhatsApp.',
  },
  brand: {
    name: 'Amrale Dairy',
    legalName: 'Shrikrishna Dairy Farms',
    /** Second line under the name in the header. */
    sub: 'अमराळे · Since 1976',
    tagline: 'Kothrud’s trusted dairy since 1976',
  },
  a11y: {
    skip: 'Skip to content',
    home: 'Amrale Dairy home',
    openMenu: 'Open menu',
    mainNav: 'Main',
    mobileNav: 'Mobile',
    footerNav: 'Footer',
    whatsappFloat: 'Chat with Amrale Dairy on WhatsApp',
    switchLanguage: 'मराठीत वाचा',
  },
  nav: {
    offers: 'Offers',
    products: 'Products',
    how: 'How it works',
    about: 'About us',
    app: 'Our app',
    contact: 'Contact',
  },
  actions: {
    orderWhatsapp: 'Order on WhatsApp',
    call: 'Call',
    callUs: 'Call us',
  },
  whatsapp: {
    start: 'Hello Amrale Dairy, I would like to start daily milk delivery.',
    prices: 'Hello Amrale Dairy, please share your product prices and pack sizes.',
    app: 'Hello Amrale Dairy, please give me access to the Amrale app.',
  },
  hero: {
    titleLine1: 'Fresh milk at your door,',
    titleLine2: 'every morning.',
    lead: 'Amrale Dairy — Shrikrishna Dairy Farms — has served Kothrud since 1976. Get milk, curd, paneer and traditional sweets delivered to your home, every day.',
    points: ['Daily doorstep delivery', 'Change by 9 pm', 'Pay by UPI or cash'],
    yearsLabel: 'years of trust',
  },
  promises: {
    label: 'Why Amrale',
    items: [
      { title: 'Since 1976', text: 'Serving Kothrud for {years} years.' },
      { title: 'Daily delivery', text: 'Milk at your door every morning.' },
      { title: 'Change anytime', text: 'Pause or change tomorrow’s order until 9 pm.' },
      { title: 'Easy payment', text: 'One monthly bill — pay by UPI or cash.' },
    ],
  },
  /**
   * The Offers section. It is filled in the visitor's browser from the offers file, so the sentences are templates:
   * {amount} is a ₹ amount, {percent} a number, {date} a day like "15 Oct".
   */
  offers: {
    eyebrow: 'Offers',
    title: 'Offers running now',
    intro: 'For a limited time. Message us on WhatsApp to get an offer on your order or bill.',
    kinds: { price: 'Special price', combo: 'Combo', bill: 'Bill discount', subscription: 'Subscriber reward' },
    save: 'Save {amount}',
    worth: 'Worth {amount}',
    inCombo: 'In the combo',
    regularToo: 'Also on your regular daily deliveries',
    billPercent: '{percent}% off your monthly bill',
    billFlat: '{amount} off your monthly bill',
    packPercent: '{percent}% off per pack on regular deliveries',
    packFlat: '{amount} off per pack on regular deliveries',
    upTo: '{text}, up to {amount}',
    upToMonth: '{text}, up to {amount} a month',
    onProducts: 'On {products}',
    minPacks: 'On days you take {count} or more packs',
    validTill: 'Valid till {date}',
    lastDay: 'Last day today',
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    listJoin: ', ',
    whatsapp: 'Hello Amrale Dairy, I would like the offer "{title}".',
  },
  products: {
    eyebrow: 'Our products',
    title: 'Milk, milk products & sweets',
    bannerAlt: 'Amrale Dairy products: milk, curd, paneer, shrikhand, amrakhand and sitaphal rabdi',
    tags: { daily: 'Daily', fresh: 'Fresh', sweet: 'Sweets' },
    askPrices: 'Ask for prices & pack sizes',
  },
  how: {
    eyebrow: 'Daily delivery',
    title: 'How it works',
    intro: 'Start in a message. After that, your milk simply arrives — and you stay in control from your phone.',
    steps: [
      { title: 'Tell us what you need', text: 'WhatsApp or call us with the milk and quantity you want each day.' },
      { title: 'We set up your account', text: 'We add your home to a delivery route and give you access to our app with your mobile number.' },
      { title: 'Delivered every morning', text: 'Your delivery partner brings your order to your door.' },
      { title: 'Change anytime, pay monthly', text: 'Pause a day or add items until 9 pm the evening before. One bill a month, paid by UPI or cash.' },
    ],
  },
  about: {
    eyebrow: 'About us',
    title: 'Kothrud’s trusted dairy since 1976',
    body: 'Amrale Dairy began in Kothrud in 1976 and has been part of the neighbourhood’s mornings ever since. From the daily milk to shrikhand and amrakhand for festivals, we keep things simple: fresh products, delivered on time, by people you know.',
    visit: 'Visit us at Sangam Chowk, Shastri Nagar — or let us come to you.',
    years: 'years',
    sinceToday: '1976 → today',
  },
  app: {
    eyebrow: 'The Amrale app',
    title: 'Manage your milk from your phone',
    intro: 'Our customers manage their daily order in the Amrale app, signing in with the mobile number registered with the dairy.',
    features: [
      'Pause a day or a whole holiday',
      'Add curd, paneer or sweets to any day’s delivery',
      'See tomorrow’s order, with a reminder at 6 pm',
      'Check your bill and pay by UPI',
    ],
    cta: 'Ask for app access',
    mock: {
      hello: 'Good morning',
      tomorrow: 'Tomorrow',
      item: 'Cow Milk · 500 ml × 2',
      changeBy: 'Change by 9 pm tonight',
      myDays: 'My days',
      myBills: 'My bills',
      totalToPay: 'Total to pay',
      payBill: 'Pay bill',
    },
  },
  contact: {
    eyebrow: 'Contact',
    title: 'We’re here to help',
    intro: 'Start a subscription, ask about products, or tell us how we’re doing.',
    call: 'Call us',
    whatsapp: 'WhatsApp',
    email: 'Email us',
    visit: 'Visit us',
    address: 'Sangam Chowk, 164/2, Shastri Nagar, Kothrud, Pune, Maharashtra 411038',
    mapTitle: 'Map to Amrale Dairy',
  },
  closing: {
    kicker: 'ताजं दूध, रोज सकाळी',
    title: 'Start your daily milk delivery',
  },
  footer: {
    about: 'Kothrud’s trusted dairy since 1976. Fresh milk, milk products and sweets, delivered to your door.',
    explore: 'Explore',
    howDelivery: 'How daily delivery works',
    reach: 'Reach us',
    whatsappUs: 'WhatsApp us',
    rights: 'All rights reserved.',
  },
};

export type Dictionary = typeof en;

const mr: Dictionary = {
  htmlLang: 'mr-IN',
  ogLocale: 'mr_IN',
  meta: {
    homeTitle: 'अमराळे डेअरी — कोथरूड, पुणे येथे ताजं दूध आणि दुग्धजन्य पदार्थ | 1976 पासून',
    homeDescription:
      'अमराळे डेअरी (श्रीकृष्ण डेअरी फार्मस्) — 1976 पासून कोथरूडची विश्वासू डेअरी. रोज घरपोच ताजं दूध, तसेच दही, पनीर, श्रीखंड, आम्रखंड आणि सिताफळ रबडी. WhatsApp वर ऑर्डर करा.',
  },
  brand: {
    name: 'अमराळे डेअरी',
    legalName: 'श्रीकृष्ण डेअरी फार्मस्',
    sub: 'Amrale Dairy · 1976 पासून',
    tagline: '1976 पासून कोथरूडची विश्वासू डेअरी',
  },
  a11y: {
    skip: 'मुख्य मजकुराकडे जा',
    home: 'अमराळे डेअरी मुख्यपृष्ठ',
    openMenu: 'मेनू उघडा',
    mainNav: 'मुख्य',
    mobileNav: 'मोबाईल मेनू',
    footerNav: 'तळटीप',
    whatsappFloat: 'WhatsApp वर अमराळे डेअरीशी बोला',
    switchLanguage: 'Read in English',
  },
  nav: {
    offers: 'ऑफर',
    products: 'उत्पादने',
    how: 'सेवा कशी मिळते',
    about: 'आमच्याबद्दल',
    app: 'आमचे ॲप',
    contact: 'संपर्क',
  },
  actions: {
    orderWhatsapp: 'WhatsApp वर ऑर्डर करा',
    call: 'कॉल करा',
    callUs: 'कॉल करा',
  },
  whatsapp: {
    start: 'नमस्कार अमराळे डेअरी, मला रोजची दूध डिलिव्हरी सुरू करायची आहे.',
    prices: 'नमस्कार अमराळे डेअरी, कृपया उत्पादनांच्या किंमती आणि पॅक साईज पाठवा.',
    app: 'नमस्कार अमराळे डेअरी, मला अमराळे ॲप वापरायचं आहे.',
  },
  hero: {
    titleLine1: 'ताजं दूध थेट तुमच्या दारात,',
    titleLine2: 'रोज सकाळी.',
    lead: 'अमराळे डेअरी — श्रीकृष्ण डेअरी फार्मस् — 1976 पासून कोथरूडच्या सेवेत आहे. दूध, दही, पनीर आणि पारंपरिक मिठाई रोज तुमच्या घरी मिळवा.',
    points: ['रोज घरपोच डिलिव्हरी', 'रात्री 9 पर्यंत बदल करा', 'UPI किंवा रोख पेमेंट'],
    yearsLabel: 'वर्षांचा विश्वास',
  },
  promises: {
    label: 'अमराळे का निवडावी',
    items: [
      { title: '1976 पासून', text: '{years} वर्षे कोथरूडच्या सेवेत.' },
      { title: 'रोज डिलिव्हरी', text: 'दररोज सकाळी दूध तुमच्या दारात.' },
      { title: 'कधीही बदल', text: 'उद्याची ऑर्डर रात्री 9 पर्यंत थांबवा किंवा बदला.' },
      { title: 'सोपे पेमेंट', text: 'महिन्याचे एकच बिल — UPI किंवा रोख भरा.' },
    ],
  },
  offers: {
    eyebrow: 'ऑफर',
    title: 'सध्या चालू असलेल्या ऑफर',
    intro: 'मर्यादित काळासाठी. ऑर्डर किंवा बिलावर ऑफर मिळवण्यासाठी WhatsApp वर मेसेज करा.',
    kinds: { price: 'खास किंमत', combo: 'कॉम्बो', bill: 'बिलावर सूट', subscription: 'सबस्क्रिप्शन बक्षीस' },
    save: '{amount} ची बचत',
    worth: 'किंमत {amount}',
    inCombo: 'कॉम्बोमध्ये',
    regularToo: 'तुमच्या रोजच्या नेहमीच्या डिलिव्हरीवरही',
    billPercent: 'महिन्याच्या बिलावर {percent}% सूट',
    billFlat: 'महिन्याच्या बिलावर {amount} सूट',
    packPercent: 'नेहमीच्या डिलिव्हरीत प्रत्येक पॅकवर {percent}% सूट',
    packFlat: 'नेहमीच्या डिलिव्हरीत प्रत्येक पॅकवर {amount} सूट',
    upTo: '{text}, जास्तीत जास्त {amount}',
    upToMonth: '{text}, महिन्याला जास्तीत जास्त {amount}',
    onProducts: '{products} वर',
    minPacks: '{count} किंवा जास्त पॅक घेतलेल्या दिवशी',
    validTill: '{date} पर्यंत',
    lastDay: 'आज शेवटचा दिवस',
    months: ['जाने', 'फेब्रु', 'मार्च', 'एप्रिल', 'मे', 'जून', 'जुलै', 'ऑग', 'सप्टें', 'ऑक्टो', 'नोव्हें', 'डिसें'],
    listJoin: ', ',
    whatsapp: 'नमस्कार अमराळे डेअरी, मला "{title}" ही ऑफर हवी आहे.',
  },
  products: {
    eyebrow: 'आमची उत्पादने',
    title: 'दूध, दुग्धजन्य पदार्थ आणि मिठाई',
    bannerAlt: 'अमराळे डेअरीची उत्पादने: दूध, दही, पनीर, श्रीखंड, आम्रखंड आणि सिताफळ रबडी',
    tags: { daily: 'रोज', fresh: 'ताजे', sweet: 'मिठाई' },
    askPrices: 'किंमती आणि पॅक साईज विचारा',
  },
  how: {
    eyebrow: 'रोजची डिलिव्हरी',
    title: 'सेवा कशी मिळते',
    intro: 'एका मेसेजने सुरुवात करा. त्यानंतर दूध रोज येत राहील — आणि सगळं नियंत्रण तुमच्या फोनवर.',
    steps: [
      { title: 'तुम्हाला काय हवं ते सांगा', text: 'रोज कोणतं आणि किती दूध हवं ते WhatsApp किंवा फोनवर कळवा.' },
      { title: 'आम्ही तुमचं खातं तयार करतो', text: 'आम्ही तुमचं घर डिलिव्हरी मार्गात जोडतो आणि तुमच्या मोबाईल नंबरने आमचं ॲप वापरण्याची सोय देतो.' },
      { title: 'रोज सकाळी डिलिव्हरी', text: 'तुमचा डिलिव्हरी पार्टनर ऑर्डर तुमच्या दारात आणून देतो.' },
      { title: 'कधीही बदल, महिन्याला पेमेंट', text: 'आदल्या दिवशी रात्री 9 पर्यंत एखादा दिवस थांबवा किंवा पदार्थ जोडा. महिन्याला एकच बिल, UPI किंवा रोख भरा.' },
    ],
  },
  about: {
    eyebrow: 'आमच्याबद्दल',
    title: '1976 पासून कोथरूडची विश्वासू डेअरी',
    body: 'अमराळे डेअरीची सुरुवात 1976 मध्ये कोथरूडमध्ये झाली आणि तेव्हापासून आम्ही इथल्या प्रत्येक सकाळचा भाग आहोत. रोजच्या दुधापासून सणासुदीच्या श्रीखंड-आम्रखंडापर्यंत, आमचं तत्त्व साधं आहे: ताजे पदार्थ, वेळेवर डिलिव्हरी, ओळखीच्या माणसांकडून.',
    visit: 'संगम चौक, शास्त्रीनगर येथे आम्हाला भेट द्या — किंवा आम्ही तुमच्याकडे येऊ.',
    years: 'वर्षे',
    sinceToday: '1976 → आज',
  },
  app: {
    eyebrow: 'अमराळे ॲप',
    title: 'तुमचं दूध, तुमच्या फोनवरून',
    intro: 'आमचे ग्राहक डेअरीकडे नोंदवलेल्या मोबाईल नंबरने अमराळे ॲपमध्ये आपली रोजची ऑर्डर सांभाळतात.',
    features: [
      'एखादा दिवस किंवा सुट्टीचे दिवस थांबवा',
      'कोणत्याही दिवशी दही, पनीर किंवा मिठाई जोडा',
      'उद्याची ऑर्डर पाहा, संध्याकाळी 6 वाजता आठवण',
      'बिल पाहा आणि UPI ने भरा',
    ],
    cta: 'ॲप वापरण्यासाठी विचारा',
    mock: {
      hello: 'सुप्रभात',
      tomorrow: 'उद्या',
      item: 'गाईचं दूध · 500 ml × 2',
      changeBy: 'आज रात्री 9 पर्यंत बदला',
      myDays: 'माझे दिवस',
      myBills: 'माझी बिलं',
      totalToPay: 'भरायची रक्कम',
      payBill: 'बिल भरा',
    },
  },
  contact: {
    eyebrow: 'संपर्क',
    title: 'आम्ही मदतीसाठी आहोत',
    intro: 'सबस्क्रिप्शन सुरू करा, उत्पादनांबद्दल विचारा किंवा आमची सेवा कशी वाटली ते सांगा.',
    call: 'कॉल करा',
    whatsapp: 'WhatsApp',
    email: 'ईमेल करा',
    visit: 'भेट द्या',
    address: 'संगम चौक, 164/2, शास्त्रीनगर, कोथरूड, पुणे, महाराष्ट्र 411038',
    mapTitle: 'अमराळे डेअरीचा नकाशा',
  },
  closing: {
    kicker: 'Fresh milk, every morning',
    title: 'रोजची दूध डिलिव्हरी सुरू करा',
  },
  footer: {
    about: '1976 पासून कोथरूडची विश्वासू डेअरी. ताजं दूध, दुग्धजन्य पदार्थ आणि मिठाई थेट तुमच्या दारात.',
    explore: 'पाहा',
    howDelivery: 'रोजची डिलिव्हरी कशी मिळते',
    reach: 'संपर्क',
    whatsappUs: 'WhatsApp करा',
    rights: 'सर्व हक्क राखीव.',
  },
};

export const ui: Record<Lang, Dictionary> = { en, mr };

export function isLang(value: string | undefined): value is Lang {
  return value === 'en' || value === 'mr';
}

/** The language of a URL: /mr/… is Marathi, everything else English. */
export function langFromPath(pathname: string): Lang {
  const first = pathname.split('/').filter(Boolean)[0];
  return isLang(first) ? first : defaultLang;
}

/** A path in a language: `localePath('mr', '/#products')` → `/mr/#products`. */
export function localePath(lang: Lang, path = '/'): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return lang === defaultLang ? clean : `/${lang}${clean}`;
}

/** The same page in the other language. */
export function switchLanguagePath(pathname: string): { lang: Lang; href: string } {
  const current = langFromPath(pathname);
  const rest = current === defaultLang ? pathname : pathname.replace(/^\/mr(?=\/|$)/, '') || '/';
  const other: Lang = current === 'en' ? 'mr' : 'en';
  return { lang: other, href: localePath(other, rest) };
}

/** "Serving Kothrud for {years} years." with the number filled in. */
export function fill(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (m, key: string) => (key in values ? String(values[key]) : m));
}
