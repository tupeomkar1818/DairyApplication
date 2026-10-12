/** Notifications, announcements and chat. The Marathi twin is ../mr/inbox.ts. */
export const inbox = {
  dairyName: 'Amrale Dairy',

  bell: {
    label: 'Notifications',
    labelUnread: (count: number) => `Notifications, ${count} unread`,
  },

  inbox: {
    title: 'Notifications',
    markAll: 'Mark all read',
    markAllLabel: 'Mark all as read',
    emptyTitle: 'Nothing yet',
    rowLabel: (title: string, body: string, unread: boolean) => `${unread ? 'Unread. ' : ''}${title}. ${body}. Open details`,
    customerEmpty: 'Orders, deliveries and bills will show up here.',
  },

  detail: {
    title: 'Notification',
    notFoundTitle: 'Notification not found',
    notFoundText: 'It may have been cleared. Go back to see your other notifications.',
    backToList: 'Back to notifications',
    received: 'Received',
    forDay: 'For the day',
    forMonth: 'For the month',
    read: 'Read',
  },

  /** The chip on each notification: what kind of update it is. */
  notificationCategories: {
    Order: 'Order',
    Delivery: 'Delivery',
    'Day change': 'Day change',
    Subscription: 'Subscription',
    Bill: 'Bill',
    Payment: 'Payment',
    Support: 'Support',
    Announcement: 'Announcement',
    Chat: 'Chat',
    Update: 'Update',
    Offer: 'Offer',
  },

  /** Where a customer can go from a notification. */
  customerActions: {
    openMyDays: 'Open My days',
    openMySubscription: 'Open My subscription',
    openMyBills: 'Open My bills',
    openAnnouncement: 'Open announcement',
    openChat: 'Open chat',
    contactDairy: 'Contact the dairy',
    openOffers: 'Open offers',
    askDairyToChange: 'Ask the dairy to change it',
    changeRequestMessage: (day: string) => `Hi, I'd like to change my order for ${day}.`,
    changeOrderUntil: (time: string) => `Change order (until ${time})`,
    keepAsItIs: 'Keep as it is',
    answerNote: (answer: string) => `${answer}.`,
    answerNoteAt: (answer: string, when: string) => `${answer} · ${when}.`,
  },

  /** The 6 pm reminder of tomorrow's order. */
  reminders: {
    title: (day: string) => `Tomorrow's order · ${day}`,
    body: (items: string, amount: string, time: string) =>
      `${items} · ${amount}. Do you want to change it, or keep it as it is? You can change it until ${time} today.`,
    bodyWithExtras: (items: string, n: number, amount: string, time: string) =>
      `${items} (includes ${n === 1 ? '1 extra item' : `${n} extra items`}) · ${amount}. Do you want to change it, or keep it as it is? You can change it until ${time} today.`,
    adminSummaryTitle: (day: string) => `Order reminders sent for ${day}`,
    adminSummaryBody: (count: number, reminderTime: string, cutoffTime: string) =>
      `${count} ${count === 1 ? 'customer was' : 'customers were'} asked at ${reminderTime} whether to change tomorrow's order or keep it as it is. They can change it until ${cutoffTime}.`,
    responseKeep: 'You chose to keep it as it is',
    responseChange: 'You chose to change it',
    answersTitle: (day: string) => `Answers for ${day}`,
    answersBody: (keep: number, change: number) => `${keep} kept tomorrow's order as it is, ${change} chose to change it.`,
    answersLatestKeep: (name: string) => `Latest: ${name} — keep as it is.`,
    answersLatestChange: (name: string) => `Latest: ${name} — change.`,
    /** The phone's notification channel and the buttons on the reminder. */
    channelName: "Tomorrow's order reminders",
    keepButton: 'Keep as it is',
    changeButton: 'Change order',
  },

  /** Words of the notifications raised when something happens on an account. */
  events: {
    deliveryBoyTitle: (name: string) => `Change for ${name}`,

    addOnCount: (count: number) => (count === 1 ? '1 add-on' : `${count} add-ons`),
    addOnsCancelledTitle: 'Add-ons cancelled',
    addOnsCancelledByDairyTitle: 'The dairy cancelled your add-ons',
    adminAddOnsCancelledTitle: (name: string) => `${name} cancelled add-ons`,
    addOnsNoneLeftBody: (day: string, item: string) => `No add-ons on ${day} now. ${item} was cancelled.`,
    addOnsUpdatedTitle: 'Add-ons updated',
    addOnsUpdatedByDairyTitle: 'The dairy updated your add-ons',
    adminAddOnsChangedTitle: (name: string) => `${name} changed add-ons`,
    addOnCancelledBody: (item: string, day: string, list: string) => `${item} cancelled. Still coming on ${day}: ${list}.`,
    addOnsOrderedTitle: (countLabel: string) => `${countLabel} ordered`,
    addOnsAddedByDairyTitle: (countLabel: string) => `The dairy added ${countLabel} for you`,
    adminAddOnsOrderedTitle: (name: string, countLabel: string) => `${name} ordered ${countLabel}`,
    addOnsOrderedBody: (day: string, list: string) => `For ${day}: ${list}.`,
    deliveryBoyAddOnsBody: (day: string, list: string) => `Add-ons on ${day}: ${list}.`,
    deliveryBoyNoAddOnsBody: (day: string) => `No add-ons on ${day} now.`,

    pausedTitle: 'Delivery paused',
    pausedByDairyTitle: 'The dairy paused your delivery',
    pausedBody: (range: string) => `No delivery on ${range}. You will not be billed for those days.`,
    adminPausedTitle: (name: string) => `${name} paused delivery`,
    noDeliveryBody: (range: string) => `No delivery on ${range}.`,

    resumedTitle: 'Delivery back on',
    resumedBody: (range: string) => `Your usual delivery comes again on ${range}.`,
    adminResumedTitle: (name: string) => `${name} resumed delivery`,
    backOnBody: (range: string) => `Delivery back on for ${range}.`,

    quantityNone: (item: string) => `No ${item}`,
    quantityUsual: (item: string, usual: string) => `Usual ${item} (${usual})`,
    quantityBody: (what: string, range: string) => `${what} on ${range}.`,
    quantityTitle: 'Quantity changed',
    quantityByDairyTitle: 'The dairy changed a quantity',
    adminQuantityTitle: (name: string) => `${name} changed a quantity`,

    subscriptionStartedBody: (item: string, day: string) => `${item} from ${day}.`,
    subscriptionStartedTitle: 'Subscription started',
    subscriptionStartedByDairyTitle: 'The dairy started a subscription',
    adminSubscribedTitle: (name: string) => `${name} subscribed`,
    deliveryBoyNewSubscriptionBody: (item: string, day: string) => `New subscription: ${item} from ${day}.`,

    subscriptionEndedBody: (item: string, day: string) => `${item}: last delivery ${day}.`,
    subscriptionEndedTitle: 'Subscription end date set',
    subscriptionEndedByDairyTitle: 'The dairy changed your subscription',
    adminEndDateTitle: (name: string) => `${name} set an end date`,

    deliveredTitle: 'Delivered',
    deliveredBody: (items: string, day: string) => `${items} delivered on ${day}.`,
    notDeliveredTitle: 'Not delivered',
    notDeliveredBody: (day: string) => `We could not deliver on ${day}. You will not be billed for it.`,
    adminNotDeliveredTitle: (name: string) => `Not delivered: ${name}`,
    adminNotDeliveredBody: (day: string) => `${day}.`,
    adminNotDeliveredMarkedByBody: (day: string, boy: string) => `${day} · marked by ${boy}.`,

    birthdayWishTitle: 'A birthday wish from Amrale Dairy',
    newAnnouncementTitle: 'New announcement from Amrale Dairy',

    chatFromCustomerTitle: (name: string) => `Message from ${name}`,
    chatFromDairyTitle: 'Message from Amrale Dairy',

    paymentReceivedTitle: 'Payment received',
    paymentRecordedBody: (amount: string, day: string) => `${amount} on ${day}.`,
    paymentRecordedByBody: (amount: string, mode: string, day: string) => `${amount} by ${mode} on ${day}.`,
    stillToPay: (amount: string) => `${amount} still to pay.`,
    allPaidUp: 'You are all paid up.',
    paymentModes: {
      Cash: 'Cash',
      UPI: 'UPI',
      Bank: 'Bank',
      Online: 'Online',
      Other: 'Other',
    } as Record<string, string>,

    billTitle: (month: string) => `Bill for ${month}`,
    billBody: (total: string) => `${total}.`,
    billDueBody: (total: string, day: string) => `${total}, due ${day}.`,

    paymentPendingTitle: 'Payment pending',
    paymentPendingBody: (amount: string, month: string) => `${amount} for ${month}.`,
    paymentPendingDueBody: (amount: string, month: string, day: string) => `${amount} for ${month} was due on ${day}.`,

    complaintRaisedTitle: 'We got your message',
    complaintRaisedBody: (subject: string) => `${subject} — the dairy will get back to you.`,
    adminComplaintTitle: (name: string) => `${name} raised a query`,
    complaintReplyTitle: (subject: string) => `Reply: ${subject}`,

    cashToCollectTitle: 'Cash payment to collect',
    paymentToConfirmTitle: 'Payment to confirm',
    cashPromisedBody: (name: string, amount: string) => `${name} will pay ${amount} in cash. Confirm it once the money is received.`,
    cashPromisedOnBody: (name: string, amount: string, day: string) =>
      `${name} will pay ${amount} in cash on ${day}. Confirm it once the money is received.`,
    paidBody: (name: string, amount: string, method: string, day: string) =>
      `${name} paid ${amount} by ${method} on ${day}. Confirm it once the money is received.`,
    paidWithRefBody: (name: string, amount: string, method: string, day: string, reference: string) =>
      `${name} paid ${amount} by ${method} on ${day} (ref ${reference}). Confirm it once the money is received.`,
    methodUpi: 'UPI',
    methodOnline: 'online payment',
    collectCashTitle: (name: string) => `Collect cash from ${name}`,
    collectCashBody: (name: string, amount: string) =>
      `${name} will pay ${amount} in cash. Hand it to the dairy so it can be confirmed.`,

    paymentNotConfirmedTitle: 'Payment not confirmed',
    paymentRejectedBody: (amount: string, reason: string) => `The dairy could not confirm your payment of ${amount}: ${reason}`,

    offerTitle: 'New offer for you',
    offerBody: (title: string, validity: string) => `${title} · ${validity}. Open Offers to see it.`,
  },

  announcements: {
    title: 'Announcements',
    detailTitle: 'Announcement',
    emptyTitle: 'No announcements',
    emptyText: (days: number) => `Wishes, important notices and delivery updates from the last ${days} days will show up here.`,
    notFoundTitle: 'Announcement not found',
    notFoundText: 'It may have been removed by the dairy.',
    backToList: 'Back to announcements',
    newBadge: 'New',
    cardLabel: (category: string, title: string, unread: boolean) => `${unread ? 'New. ' : ''}${category}: ${title}. Open`,
    fromDairy: 'From Amrale Dairy',
    fromSender: (name: string) => `From ${name}`,
    fromYourDeliveryPartner: 'From your delivery partner',
    from: 'From',
    yourDeliveryPartner: 'Your delivery partner',
    sent: 'Sent',
    forDay: 'For the day',
    picture: 'Announcement picture',
    video: 'Announcement video',
    openVideo: 'Open video',
    /** Stands in for `{name}` when the reader's name is unknown ("Happy birthday, there!"). */
    nameFallback: 'there',
    /** What each kind of announcement is called on its chip. */
    categories: {
      Festival: 'Festival',
      Birthday: 'Birthday',
      Important: 'Important',
      Payment: 'Payment',
      Order: 'Order',
      Delivery: 'Delivery',
    },
    /** A starting point for each kind of message; the admin edits it before sending. `{name}` is the reader's first name. */
    templates: {
      Festival: {
        title: 'Happy festival, {name}!',
        message:
          'Wishing you and your family joy and sweetness this festival. Thank you for being part of the Amrale Dairy family.',
      },
      Birthday: {
        title: 'Happy birthday, {name}!',
        message: 'Everyone at Amrale Dairy wishes you a wonderful birthday and a year full of good health.',
      },
      Important: {
        title: 'Important update',
        message: 'Please note: ',
      },
      Payment: {
        title: 'Payment reminder',
        message: 'Hello {name}, a gentle reminder to clear your pending bill. You can see the details in My bills.',
      },
      Order: {
        title: 'About your orders',
        message: 'Hello {name}, ',
      },
      Delivery: {
        title: 'Delivery update',
        message: 'Hello {name}, ',
      },
    },
    /** The message a delivery attempt leaves for the customer. */
    delivery: {
      deliveredTitle: 'Your order was delivered',
      notDeliveredTitle: 'We could not deliver today',
      deliveredMessage: (day: string) => `Hello {name}, your order was delivered on ${day}.`,
      deliveredByMessage: (day: string, boy: string) => `Hello {name}, your order was delivered on ${day} by ${boy}.`,
      deliveredItems: (items: string) => `Delivered: ${items}.`,
      notDeliveredMessage: (day: string) =>
        `Hello {name}, we could not deliver on ${day}. You will not be billed for it. Please contact us if you need help.`,
    },
    media: {
      allowLibrary: 'Allow photo library access to attach a picture or video.',
      videoTooBig: (size: string, max: string) =>
        `This video is ${size}. Upload one under ${max}, or paste a YouTube or video link instead.`,
      videoUnreadable: 'Could not read that video. Try another file, or paste a link instead.',
    },
  },

  chat: {
    screenTitle: 'Chat with us',
    customerSubtitle: 'We usually reply within a few hours',
    customerEmptyTitle: 'Chat with the dairy',
    customerEmptyText: 'Ask about your deliveries, bills or subscription. Pick a topic or write your own message.',
    /** One-tap first messages a customer can start the chat with. */
    starters: {
      delivery: 'I have a question about my delivery.',
      bill: 'I have a question about my bill.',
      subscription: 'I want to change my subscription.',
      quality: 'The product quality was not good.',
    },
    sendFailed: "Couldn't send. Please try again.",
    goBack: 'Go back',
    sendStarter: (text: string) => `Send: ${text}`,
    seen: 'Seen',
    sent: 'Sent',
    placeholder: 'Type a message',
    messageLabel: 'Message',
    sendLabel: 'Send message',
    emptyMessage: 'Write a message first.',
    tooLong: (max: number) => `Keep it under ${max} characters.`,
  },
};
