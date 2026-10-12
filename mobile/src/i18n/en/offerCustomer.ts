/** Customer: offers card and screen, offer codes, ordering offers, offer lines on bills. The Marathi twin is ../mr/offerCustomer.ts. */
export const offerCustomer = {
  /** The card on the home screen and the shortcut. */
  home: {
    bannerTitle: (n: number) => (n === 1 ? '1 offer for you' : `${n} offers for you`),
    bannerMore: (n: number) => `+${n} more`,
    bannerA11y: (title: string, validity: string) => `Offers. ${title}, ${validity}. Open offers`,
    shortcut: 'Offers',
    shortcutLive: (n: number) => (n === 1 ? '1 offer running' : `${n} offers running`),
    shortcutSub: 'Price offers and combos · Have a code?',
  },

  screen: {
    title: 'Offers',
    listTitle: 'Offers for you',
    emptyTitle: 'No offers right now',
    emptyText: 'When the dairy runs an offer, it shows up here. Got a code from the dairy? Type it above.',
    loadError: "Couldn't load offers.",
    orderingClosed: 'Ordering is closed on your account right now. Contact the dairy to order.',
  },

  code: {
    title: 'Have an offer code?',
    label: 'Offer code',
    placeholder: 'e.g. DIWALI50',
    apply: 'Apply',
    applied: (title: string) => `Code applied: ${title}. It is on your offers now.`,
    appliedStartsLater: (title: string, day: string) => `Code applied: ${title}. It starts on ${day}.`,
    saveError: "Couldn't apply the code. Please try again.",
  },

  card: {
    posterA11y: (title: string) => `Poster for ${title}`,
    order: 'Order',
    orderA11y: (item: string) => `Order ${item} at the offer price`,
    orderCombo: 'Order combo',
    packGone: 'No longer on sale',
    onBill: 'Comes off your monthly bill by itself. Nothing to order.',
    billPercent: (percent: number) => `${percent}% off your bill`,
    billPercentUpTo: (percent: number, max: string) => `${percent}% off your bill, up to ${max}`,
    billFlat: (amount: string) => `${amount} off your bill`,
    rewardPercent: (percent: number) => `${percent}% off your regular deliveries`,
    rewardPercentUpTo: (percent: number, max: string) => `${percent}% off your regular deliveries, up to ${max} a month`,
    rewardFlat: (amount: string) => `${amount} off per pack on regular deliveries`,
    onlyProducts: (list: string) => `On ${list}`,
  },

  /** The sheet for ordering an offer pack or a combo. */
  order: {
    subtitle: 'Comes with that day’s delivery and goes on your monthly bill',
    day: 'Day',
    anotherDay: 'Another day',
    noDays: 'There are no days left to order this offer.',
    dayNotCovered: 'The offer does not run on that day. Pick another day.',
    howMany: 'How many',
    each: (price: string) => `${price} each`,
    total: 'Total',
    orderFor: (day: string) => `Order for ${day}`,
    ordered: (item: string, day: string) => `Ordered ${item} for ${day}. You can see it in My days.`,
    error: "Couldn't place the order. Please try again.",
  },

  /** Offer words on a bill and on orders. */
  bill: {
    savedThisMonth: (amount: string) => `You saved ${amount} with offers this month`,
  },
};
