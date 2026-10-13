/** The desk: ringing up a walk-in sale, and what the dairy sees of the day. */
export const counter = {
  title: 'Counter',
  greeting: (name: string) => `Good day, ${name}`,
  subtitle: 'Add what they are buying, then take the money.',

  search: 'Search the catalogue',
  noProducts: 'No products yet. The dairy adds them from the admin app.',
  noMatches: 'Nothing matches that.',
  tapToAdd: 'Tap to add',

  cart: {
    title: 'This sale',
    empty: 'Nothing on this sale yet.',
    emptyHint: 'Tap a product above to start.',
    items: (n: number) => (n === 1 ? '1 item' : `${n} items`),
    remove: 'Take off',
    fewer: 'One fewer',
    more: 'One more',
    clear: 'Clear the sale',
    clearTitle: 'Clear this sale?',
    clearBody: 'Everything on it will be taken off. Nothing has been charged yet.',
  },

  totals: {
    items: 'Items',
    discount: 'Discount',
    discountPlaceholder: '0',
    toPay: 'To pay',
  },

  payment: {
    title: 'How are they paying?',
    cash: 'Cash',
    upi: 'UPI',
    upiHint: 'Show them the QR, then place the order once it is paid.',
    noUpi: 'The dairy has not set a UPI id yet, so only cash can be taken.',
  },

  customer: {
    title: 'A regular customer?',
    hint: 'Optional. Put it on their history — the money is still taken here and now.',
    walkIn: 'Walk-in',
    search: 'Search by name or number',
    clear: 'Not a regular',
  },

  place: 'Place the order',
  placing: 'Placing…',
  note: 'Note (optional)',

  done: {
    title: (no: string) => `Bill ${no} done`,
    total: (amount: string) => `${amount} taken`,
    printing: 'Printing the bill…',
    printed: 'Bill printed.',
    printFailed: 'The bill did not print. The sale is saved — try printing it again.',
    printAgain: 'Print again',
    next: 'Next sale',
  },

  today: {
    title: "Today's sales",
    none: 'No sales yet today.',
    sales: (n: number) => (n === 1 ? '1 sale' : `${n} sales`),
    notPrinted: 'Not printed',
    openPrinter: 'Printer',
  },

  printer: {
    title: 'Bill printer',
    subtitle: 'A Bluetooth counter printer, paired with this phone.',
    connected: (name: string) => `Connected to ${name}`,
    notConnected: 'No printer connected.',
    connect: 'Connect a printer',
    disconnect: 'Disconnect',
    scanning: 'Looking for printers…',
    none: 'No printers found. Switch the printer on and keep it close.',
    test: 'Print a test bill',
    unavailable: 'Printing needs the installed app, not the web preview.',
    needsBuild:
      'This copy of the app cannot talk to a Bluetooth printer. Install the built app on the counter phone and connect the printer there.',
    permission: 'Allow Bluetooth so the app can find the printer.',
  },

  // What the dairy sees.
  day: {
    title: 'Counter sales',
    subtitle: 'Walk-in sales, paid at the counter.',
    today: 'Today',
    total: 'Taken today',
    sales: 'Sales',
    cash: 'Cash',
    upi: 'UPI',
    byDesk: 'By who sold',
    byProduct: 'What sold',
    none: 'Nothing sold at the counter today.',
    openFull: 'See every sale',
    separate: 'Counter money is kept apart from the monthly billing.',
  },

  staff: {
    deskTitle: 'Desk users',
    deskSubtitle: 'They ring up counter sales and print the bill.',
    managersTitle: 'Managers',
    managersSubtitle: 'They run the day. Prices, payment details and staff stay yours.',
    owner: 'Owner',
    add: 'Add',
    addDesk: 'Add a desk user',
    addManager: 'Add a manager',
    name: 'Full name',
    mobile: 'Mobile number',
    counterName: 'Which counter (optional)',
    noDesk: 'Nobody on the desk yet.',
    noManagers: 'No managers. You run everything yourself.',
    remove: 'Remove',
    removeDeskTitle: (name: string) => `Remove ${name}?`,
    removeDeskBody: 'They will not be able to sign in. The sales they rang up stay on the dairy’s books.',
    removeManagerTitle: (name: string) => `Remove ${name}?`,
    removeManagerBody: 'They will not be able to sign in again.',
    ownerNote: 'Only you can add or remove people, change prices, or change payment details.',
    signInHint: 'They sign in with their own mobile number the first time, then choose a 4-digit PIN.',
  },

  errors: {
    empty: 'Add something to the sale first.',
    noPayment: 'Choose how they are paying.',
    failed: 'The sale was not placed. Please try again.',
    nameRequired: 'Enter their name.',
    mobileInvalid: 'Enter a valid 10-digit mobile number.',
    mobileInUse: 'Somebody else at the dairy already uses that number.',
  },
};
