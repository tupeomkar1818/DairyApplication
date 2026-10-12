import type { offerCustomer as En } from '@/src/i18n/en/offerCustomer';

export const offerCustomer: typeof En = {
  home: {
    bannerTitle: (n: number) => (n === 1 ? 'तुमच्यासाठी 1 ऑफर' : `तुमच्यासाठी ${n} ऑफर`),
    bannerMore: (n: number) => `आणखी ${n}`,
    bannerA11y: (title: string, validity: string) => `ऑफर. ${title}, ${validity}. ऑफर उघडा`,
    shortcut: 'ऑफर',
    shortcutLive: (n: number) => (n === 1 ? '1 ऑफर चालू आहे' : `${n} ऑफर चालू आहेत`),
    shortcutSub: 'किंमत ऑफर आणि कॉम्बो · कोड आहे?',
  },

  screen: {
    title: 'ऑफर',
    listTitle: 'तुमच्यासाठी ऑफर',
    emptyTitle: 'सध्या कोणतीही ऑफर नाही',
    emptyText: 'डेअरीने ऑफर सुरू केली की ती इथे दिसेल. डेअरीकडून कोड मिळाला आहे? तो वर टाका.',
    loadError: 'ऑफर दिसू शकल्या नाहीत.',
    orderingClosed: 'सध्या तुमच्या खात्यावर ऑर्डर बंद आहे. ऑर्डरसाठी डेअरीशी संपर्क करा.',
  },

  code: {
    title: 'ऑफर कोड आहे?',
    label: 'ऑफर कोड',
    placeholder: 'उदा. DIWALI50',
    apply: 'वापरा',
    applied: (title: string) => `कोड लागू झाला: ${title}. ही ऑफर आता तुमच्या ऑफरमध्ये आहे.`,
    appliedStartsLater: (title: string, day: string) => `कोड लागू झाला: ${title}. ही ऑफर ${day} पासून सुरू होईल.`,
    saveError: 'कोड लागू करता आला नाही. पुन्हा प्रयत्न करा.',
  },

  card: {
    posterA11y: (title: string) => `${title} चे पोस्टर`,
    order: 'ऑर्डर करा',
    orderA11y: (item: string) => `${item} ऑफर किमतीत ऑर्डर करा`,
    orderCombo: 'कॉम्बो ऑर्डर करा',
    packGone: 'आता विक्रीला नाही',
    onBill: 'ही सूट महिन्याच्या बिलावर आपोआप लागते. काही ऑर्डर करायची गरज नाही.',
    billPercent: (percent: number) => `तुमच्या बिलावर ${percent}% सूट`,
    billPercentUpTo: (percent: number, max: string) => `तुमच्या बिलावर ${percent}% सूट, जास्तीत जास्त ${max}`,
    billFlat: (amount: string) => `तुमच्या बिलावर ${amount} सूट`,
    rewardPercent: (percent: number) => `नेहमीच्या डिलिव्हरीवर ${percent}% सूट`,
    rewardPercentUpTo: (percent: number, max: string) => `नेहमीच्या डिलिव्हरीवर ${percent}% सूट, महिन्याला जास्तीत जास्त ${max}`,
    rewardFlat: (amount: string) => `नेहमीच्या डिलिव्हरीवर प्रत्येक पॅकमागे ${amount} सूट`,
    onlyProducts: (list: string) => `फक्त ${list} वर`,
  },

  order: {
    subtitle: 'त्या दिवशीच्या डिलिव्हरीसोबत येईल आणि महिन्याच्या बिलात लागेल',
    day: 'दिवस',
    anotherDay: 'दुसरा दिवस',
    noDays: 'ही ऑफर ऑर्डर करण्यासाठी आता दिवस उरलेले नाहीत.',
    dayNotCovered: 'त्या दिवशी ही ऑफर नाही. दुसरा दिवस निवडा.',
    howMany: 'किती',
    each: (price: string) => `प्रत्येकी ${price}`,
    total: 'एकूण',
    orderFor: (day: string) => `${day} साठी ऑर्डर करा`,
    ordered: (item: string, day: string) => `${day} साठी ${item} ऑर्डर झाले. ते माझे दिवस मध्ये दिसेल.`,
    error: 'ऑर्डर करता आली नाही. पुन्हा प्रयत्न करा.',
  },

  bill: {
    savedThisMonth: (amount: string) => `या महिन्यात ऑफरमुळे तुमची ${amount} बचत झाली`,
  },
};
