import type { inbox as En } from '@/src/i18n/en/inbox';

export const inbox: typeof En = {
  dairyName: 'अमराळे डेअरी',

  bell: {
    label: 'सूचना',
    labelUnread: (count: number) => `सूचना, ${count} न वाचलेल्या`,
  },

  inbox: {
    title: 'सूचना',
    markAll: 'सर्व वाचल्या',
    markAllLabel: 'सर्व सूचना वाचल्या म्हणून खूण करा',
    emptyTitle: 'अजून काही नाही',
    rowLabel: (title: string, body: string, unread: boolean) => `${unread ? 'न वाचलेली. ' : ''}${title}. ${body}. तपशील उघडा`,
    customerEmpty: 'ऑर्डर, डिलिव्हरी आणि बिलं इथे दिसतील.',
  },

  detail: {
    title: 'सूचना',
    notFoundTitle: 'सूचना सापडली नाही',
    notFoundText: 'ती काढून टाकली असेल. तुमच्या इतर सूचना पाहण्यासाठी मागे जा.',
    backToList: 'सूचनांकडे परत',
    received: 'मिळाली',
    forDay: 'दिवस',
    forMonth: 'महिना',
    read: 'वाचली',
  },

  notificationCategories: {
    Order: 'ऑर्डर',
    Delivery: 'डिलिव्हरी',
    'Day change': 'दिवसातील बदल',
    Subscription: 'सबस्क्रिप्शन',
    Bill: 'बिल',
    Payment: 'पेमेंट',
    Support: 'मदत',
    Announcement: 'घोषणा',
    Chat: 'चॅट',
    Update: 'अपडेट',
    Offer: 'ऑफर',
  },

  customerActions: {
    openMyDays: 'माझे दिवस उघडा',
    openMySubscription: 'माझे सबस्क्रिप्शन उघडा',
    openMyBills: 'माझी बिलं उघडा',
    openAnnouncement: 'घोषणा उघडा',
    openChat: 'चॅट उघडा',
    contactDairy: 'डेअरीशी संपर्क करा',
    openOffers: 'ऑफर उघडा',
    askDairyToChange: 'डेअरीला बदल करायला सांगा',
    changeRequestMessage: (day: string) => `नमस्कार, मला ${day} ची ऑर्डर बदलायची आहे.`,
    changeOrderUntil: (time: string) => `ऑर्डर बदला (${time} पर्यंत)`,
    keepAsItIs: 'आहे तशीच ठेवा',
    answerNote: (answer: string) => `${answer}.`,
    answerNoteAt: (answer: string, when: string) => `${answer} · ${when}.`,
  },

  reminders: {
    title: (day: string) => `उद्याची ऑर्डर · ${day}`,
    body: (items: string, amount: string, time: string) =>
      `${items} · ${amount}. ऑर्डर बदलायची आहे की आहे तशीच ठेवायची? आज ${time} पर्यंत बदलू शकता.`,
    bodyWithExtras: (items: string, n: number, amount: string, time: string) =>
      `${items} (${n === 1 ? '1 अतिरिक्त वस्तूसह' : `${n} अतिरिक्त वस्तूंसह`}) · ${amount}. ऑर्डर बदलायची आहे की आहे तशीच ठेवायची? आज ${time} पर्यंत बदलू शकता.`,
    adminSummaryTitle: (day: string) => `${day} साठी ऑर्डर रिमाइंडर पाठवले`,
    adminSummaryBody: (count: number, reminderTime: string, cutoffTime: string) =>
      `${count} ${count === 1 ? 'ग्राहकाला' : 'ग्राहकांना'} ${reminderTime} वाजता विचारले की उद्याची ऑर्डर बदलायची की आहे तशीच ठेवायची. ${cutoffTime} पर्यंत बदल करता येईल.`,
    responseKeep: 'तुम्ही ऑर्डर आहे तशीच ठेवली',
    responseChange: 'तुम्ही ऑर्डर बदलायचे ठरवले',
    answersTitle: (day: string) => `${day} साठी उत्तरे`,
    answersBody: (keep: number, change: number) =>
      `${keep} जणांनी उद्याची ऑर्डर आहे तशीच ठेवली, ${change} जणांनी बदलायचे ठरवले.`,
    answersLatestKeep: (name: string) => `शेवटचे: ${name} — आहे तशीच ठेवा.`,
    answersLatestChange: (name: string) => `शेवटचे: ${name} — बदल.`,
    channelName: 'उद्याच्या ऑर्डरचे रिमाइंडर',
    keepButton: 'आहे तशीच ठेवा',
    changeButton: 'ऑर्डर बदला',
  },

  events: {
    deliveryBoyTitle: (name: string) => `${name} यांच्यासाठी बदल`,

    addOnCount: (count: number) => `${count} अतिरिक्त ऑर्डर`,
    addOnsCancelledTitle: 'अतिरिक्त ऑर्डर रद्द',
    addOnsCancelledByDairyTitle: 'डेअरीने तुमच्या अतिरिक्त ऑर्डर रद्द केल्या',
    adminAddOnsCancelledTitle: (name: string) => `${name} यांनी अतिरिक्त ऑर्डर रद्द केल्या`,
    addOnsNoneLeftBody: (day: string, item: string) => `${day} रोजी आता अतिरिक्त ऑर्डर नाही. ${item} रद्द केले.`,
    addOnsUpdatedTitle: 'अतिरिक्त ऑर्डर बदलल्या',
    addOnsUpdatedByDairyTitle: 'डेअरीने तुमच्या अतिरिक्त ऑर्डर बदलल्या',
    adminAddOnsChangedTitle: (name: string) => `${name} यांनी अतिरिक्त ऑर्डर बदलल्या`,
    addOnCancelledBody: (item: string, day: string, list: string) => `${item} रद्द केले. ${day} रोजी अजून येणार: ${list}.`,
    addOnsOrderedTitle: (countLabel: string) => `${countLabel} दिल्या`,
    addOnsAddedByDairyTitle: (countLabel: string) => `डेअरीने तुमच्यासाठी ${countLabel} जोडल्या`,
    adminAddOnsOrderedTitle: (name: string, countLabel: string) => `${name} यांनी ${countLabel} दिल्या`,
    addOnsOrderedBody: (day: string, list: string) => `${day} साठी: ${list}.`,
    deliveryBoyAddOnsBody: (day: string, list: string) => `${day} च्या अतिरिक्त ऑर्डर: ${list}.`,
    deliveryBoyNoAddOnsBody: (day: string) => `${day} रोजी आता अतिरिक्त ऑर्डर नाही.`,

    pausedTitle: 'डिलिव्हरी थांबवली',
    pausedByDairyTitle: 'डेअरीने तुमची डिलिव्हरी थांबवली',
    pausedBody: (range: string) => `${range} रोजी डिलिव्हरी नाही. त्या दिवसांचे बिल लागणार नाही.`,
    adminPausedTitle: (name: string) => `${name} यांनी डिलिव्हरी थांबवली`,
    noDeliveryBody: (range: string) => `${range} रोजी डिलिव्हरी नाही.`,

    resumedTitle: 'डिलिव्हरी पुन्हा सुरू',
    resumedBody: (range: string) => `${range} रोजी तुमची नेहमीची डिलिव्हरी पुन्हा येईल.`,
    adminResumedTitle: (name: string) => `${name} यांनी डिलिव्हरी पुन्हा सुरू केली`,
    backOnBody: (range: string) => `${range} रोजी डिलिव्हरी पुन्हा सुरू.`,

    quantityNone: (item: string) => `${item} नाही`,
    quantityUsual: (item: string, usual: string) => `नेहमीचे ${item} (${usual})`,
    quantityBody: (what: string, range: string) => `${range} रोजी: ${what}.`,
    quantityTitle: 'प्रमाण बदलले',
    quantityByDairyTitle: 'डेअरीने प्रमाण बदलले',
    adminQuantityTitle: (name: string) => `${name} यांनी प्रमाण बदलले`,

    subscriptionStartedBody: (item: string, day: string) => `${day} पासून ${item}.`,
    subscriptionStartedTitle: 'सबस्क्रिप्शन सुरू झाले',
    subscriptionStartedByDairyTitle: 'डेअरीने सबस्क्रिप्शन सुरू केले',
    adminSubscribedTitle: (name: string) => `${name} यांनी सबस्क्रिप्शन घेतले`,
    deliveryBoyNewSubscriptionBody: (item: string, day: string) => `नवीन सबस्क्रिप्शन: ${day} पासून ${item}.`,

    subscriptionEndedBody: (item: string, day: string) => `${item}: शेवटची डिलिव्हरी ${day}.`,
    subscriptionEndedTitle: 'सबस्क्रिप्शनची शेवटची तारीख ठरली',
    subscriptionEndedByDairyTitle: 'डेअरीने तुमचे सबस्क्रिप्शन बदलले',
    adminEndDateTitle: (name: string) => `${name} यांनी शेवटची तारीख ठरवली`,

    deliveredTitle: 'डिलिव्हरी झाली',
    deliveredBody: (items: string, day: string) => `${day} रोजी ${items} पोहोचवले.`,
    notDeliveredTitle: 'डिलिव्हरी झाली नाही',
    notDeliveredBody: (day: string) => `${day} रोजी डिलिव्हरी करता आली नाही. त्याचे बिल लागणार नाही.`,
    adminNotDeliveredTitle: (name: string) => `डिलिव्हरी झाली नाही: ${name}`,
    adminNotDeliveredBody: (day: string) => `${day}.`,
    adminNotDeliveredMarkedByBody: (day: string, boy: string) => `${day} · ${boy} यांनी नोंदवले.`,

    birthdayWishTitle: 'अमराळे डेअरीकडून वाढदिवसाच्या शुभेच्छा',
    newAnnouncementTitle: 'अमराळे डेअरीकडून नवीन घोषणा',

    chatFromCustomerTitle: (name: string) => `${name} यांचा मेसेज`,
    chatFromDairyTitle: 'अमराळे डेअरीचा मेसेज',

    paymentReceivedTitle: 'पेमेंट मिळाले',
    paymentRecordedBody: (amount: string, day: string) => `${day} रोजी ${amount} मिळाले.`,
    paymentRecordedByBody: (amount: string, mode: string, day: string) => `${day} रोजी ${amount} मिळाले (${mode}).`,
    stillToPay: (amount: string) => `अजून ${amount} भरायचे बाकी.`,
    allPaidUp: 'तुमचे सगळे पेमेंट पूर्ण झाले आहे.',
    paymentModes: {
      Cash: 'रोख',
      UPI: 'UPI',
      Bank: 'बँक',
      Online: 'ऑनलाइन',
      Other: 'इतर',
    },

    billTitle: (month: string) => `${month} चे बिल`,
    billBody: (total: string) => `${total}.`,
    billDueBody: (total: string, day: string) => `${total}, ${day} पर्यंत भरा.`,

    paymentPendingTitle: 'पेमेंट बाकी',
    paymentPendingBody: (amount: string, month: string) => `${month} चे ${amount}.`,
    paymentPendingDueBody: (amount: string, month: string, day: string) => `${month} चे ${amount} ${day} पर्यंत भरायचे होते.`,

    complaintRaisedTitle: 'तुमचा मेसेज मिळाला',
    complaintRaisedBody: (subject: string) => `${subject} — डेअरी तुम्हाला लवकरच उत्तर देईल.`,
    adminComplaintTitle: (name: string) => `${name} यांनी प्रश्न विचारला`,
    complaintReplyTitle: (subject: string) => `उत्तर: ${subject}`,

    cashToCollectTitle: 'रोख पेमेंट घ्यायचे आहे',
    paymentToConfirmTitle: 'पेमेंट निश्चित करायचे आहे',
    cashPromisedBody: (name: string, amount: string) => `${name} ${amount} रोख देणार आहेत. पैसे मिळाल्यावर निश्चित करा.`,
    cashPromisedOnBody: (name: string, amount: string, day: string) =>
      `${name} ${day} रोजी ${amount} रोख देणार आहेत. पैसे मिळाल्यावर निश्चित करा.`,
    paidBody: (name: string, amount: string, method: string, day: string) =>
      `${name} यांनी ${day} रोजी ${method} ने ${amount} भरले. पैसे मिळाल्यावर निश्चित करा.`,
    paidWithRefBody: (name: string, amount: string, method: string, day: string, reference: string) =>
      `${name} यांनी ${day} रोजी ${method} ने ${amount} भरले (ref ${reference}). पैसे मिळाल्यावर निश्चित करा.`,
    methodUpi: 'UPI',
    methodOnline: 'ऑनलाइन पेमेंट',
    collectCashTitle: (name: string) => `${name} यांच्याकडून रोख घ्या`,
    collectCashBody: (name: string, amount: string) =>
      `${name} ${amount} रोख देणार आहेत. ते डेअरीकडे द्या, म्हणजे पेमेंट निश्चित करता येईल.`,

    paymentNotConfirmedTitle: 'पेमेंट निश्चित झाले नाही',
    paymentRejectedBody: (amount: string, reason: string) => `डेअरी तुमचे ${amount} चे पेमेंट निश्चित करू शकली नाही: ${reason}`,

    offerTitle: 'तुमच्यासाठी नवीन ऑफर',
    offerBody: (title: string, validity: string) => `${title} · ${validity}. पाहण्यासाठी ऑफर उघडा.`,
  },

  announcements: {
    title: 'घोषणा',
    detailTitle: 'घोषणा',
    emptyTitle: 'घोषणा नाहीत',
    emptyText: (days: number) => `मागील ${days} दिवसांतील शुभेच्छा, महत्त्वाच्या सूचना आणि डिलिव्हरी अपडेट इथे दिसतील.`,
    notFoundTitle: 'घोषणा सापडली नाही',
    notFoundText: 'डेअरीने ती काढून टाकली असेल.',
    backToList: 'घोषणांकडे परत',
    newBadge: 'नवीन',
    cardLabel: (category: string, title: string, unread: boolean) => `${unread ? 'नवीन. ' : ''}${category}: ${title}. उघडा`,
    fromDairy: 'अमराळे डेअरीकडून',
    fromSender: (name: string) => `${name} यांच्याकडून`,
    fromYourDeliveryPartner: 'तुमच्या डिलिव्हरी बॉयकडून',
    from: 'पाठवणारे',
    yourDeliveryPartner: 'तुमचा डिलिव्हरी बॉय',
    sent: 'पाठवली',
    forDay: 'दिवस',
    picture: 'घोषणेचा फोटो',
    video: 'घोषणेचा व्हिडिओ',
    openVideo: 'व्हिडिओ उघडा',
    nameFallback: 'स्नेही',
    categories: {
      Festival: 'सण',
      Birthday: 'वाढदिवस',
      Important: 'महत्त्वाचे',
      Payment: 'पेमेंट',
      Order: 'ऑर्डर',
      Delivery: 'डिलिव्हरी',
    },
    templates: {
      Festival: {
        title: 'सणाच्या हार्दिक शुभेच्छा, {name}!',
        message:
          'तुम्हाला आणि तुमच्या कुटुंबाला या सणानिमित्त आनंदाच्या आणि गोड शुभेच्छा. अमराळे डेअरी परिवाराचा भाग असल्याबद्दल धन्यवाद.',
      },
      Birthday: {
        title: 'वाढदिवसाच्या हार्दिक शुभेच्छा, {name}!',
        message: 'अमराळे डेअरीतर्फे तुम्हाला वाढदिवसाच्या खूप शुभेच्छा. येणारे वर्ष आनंदाचे आणि आरोग्यदायी जावो.',
      },
      Important: {
        title: 'महत्त्वाचे अपडेट',
        message: 'कृपया लक्षात घ्या: ',
      },
      Payment: {
        title: 'पेमेंट रिमाइंडर',
        message: 'नमस्कार {name}, तुमचे बाकी बिल भरण्याची आठवण करून देत आहोत. तपशील "माझी बिलं" मध्ये पाहू शकता.',
      },
      Order: {
        title: 'तुमच्या ऑर्डरबद्दल',
        message: 'नमस्कार {name}, ',
      },
      Delivery: {
        title: 'डिलिव्हरी अपडेट',
        message: 'नमस्कार {name}, ',
      },
    },
    delivery: {
      deliveredTitle: 'तुमची ऑर्डर पोहोचली',
      notDeliveredTitle: 'आज डिलिव्हरी करता आली नाही',
      deliveredMessage: (day: string) => `नमस्कार {name}, तुमची ऑर्डर ${day} रोजी पोहोचवली.`,
      deliveredByMessage: (day: string, boy: string) => `नमस्कार {name}, ${boy} यांनी तुमची ऑर्डर ${day} रोजी पोहोचवली.`,
      deliveredItems: (items: string) => `पोहोचवले: ${items}.`,
      notDeliveredMessage: (day: string) =>
        `नमस्कार {name}, ${day} रोजी डिलिव्हरी करता आली नाही. त्याचे बिल लागणार नाही. मदत हवी असल्यास आमच्याशी संपर्क करा.`,
    },
    media: {
      allowLibrary: 'फोटो किंवा व्हिडिओ जोडण्यासाठी फोटो गॅलरीची परवानगी द्या.',
      videoTooBig: (size: string, max: string) =>
        `हा व्हिडिओ ${size} चा आहे. ${max} पेक्षा लहान व्हिडिओ अपलोड करा, किंवा YouTube / व्हिडिओची लिंक टाका.`,
      videoUnreadable: 'तो व्हिडिओ वाचता आला नाही. दुसरी फाइल निवडा, किंवा लिंक टाका.',
    },
  },

  chat: {
    screenTitle: 'आमच्याशी चॅट करा',
    customerSubtitle: 'आम्ही साधारण काही तासांत उत्तर देतो',
    customerEmptyTitle: 'डेअरीशी चॅट करा',
    customerEmptyText: 'तुमची डिलिव्हरी, बिलं किंवा सबस्क्रिप्शनबद्दल विचारा. विषय निवडा किंवा स्वतः मेसेज लिहा.',
    starters: {
      delivery: 'माझ्या डिलिव्हरीबद्दल प्रश्न आहे.',
      bill: 'माझ्या बिलाबद्दल प्रश्न आहे.',
      subscription: 'मला माझे सबस्क्रिप्शन बदलायचे आहे.',
      quality: 'उत्पादनाची क्वालिटी चांगली नव्हती.',
    },
    sendFailed: 'मेसेज पाठवता आला नाही. पुन्हा प्रयत्न करा.',
    goBack: 'मागे जा',
    sendStarter: (text: string) => `पाठवा: ${text}`,
    seen: 'पाहिला',
    sent: 'पाठवला',
    placeholder: 'मेसेज लिहा',
    messageLabel: 'मेसेज',
    sendLabel: 'मेसेज पाठवा',
    emptyMessage: 'आधी मेसेज लिहा.',
    tooLong: (max: number) => `${max} अक्षरांपेक्षा कमी लिहा.`,
  },
};
