/** Admin: a customer's subscription tab, plans editor, calendar and history. The Marathi twin is ../mr/subscriptionEditor.ts. */
export const subscriptionEditor = {
  /** Display labels for stored enum values (the stored value is the key). */
  enums: {
    frequency: {
      Daily: 'Daily',
      'Alternate Day': 'Alternate Day',
      Weekly: 'Weekly',
      'Specific Days': 'Specific Days',
      'Weekend Only': 'Weekend Only',
      'Morning Only': 'Morning Only',
      'Evening Only': 'Evening Only',
      'Morning and Evening': 'Morning and Evening',
    },
    deliveryTime: {
      Morning: 'Morning',
      Evening: 'Evening',
      Both: 'Both',
    },
    planStatus: {
      Active: 'Active',
      Paused: 'Paused',
      Expired: 'Expired',
      Cancelled: 'Cancelled',
      Inactive: 'Inactive',
    },
  },
  /** "Cow Milk 500 ml (Packet) · Quantity 2" — `pack` already includes the unit. */
  orderExample: (product: string, pack: string, qty: number) => `${product} ${pack} · Quantity ${qty}`,
  /** "September 1 – September 30". */
  billingCycleRange: (month: string, lastDay: number) => `${month} 1 – ${month} ${lastDay}`,
  fields: {
    packSize: 'Pack / size',
    qty: 'Qty',
    pricePerDelivery: 'Price / delivery',
    startDate: 'Start date',
    endDate: 'End date',
  },
  tab: {
    loading: 'Loading subscription…',
    calendarLegend:
      'Blue dot: subscription delivery that day (none on skipped days) · Green dot: add-on that day. Tap a date to see or change its add-ons.',
    productSubscriptionTitle: 'Product subscription',
    productSubscriptionSubtitleShared: (month: string) =>
      `Only plans that overlap ${month}; pause-only months may show no rows.`,
    productSubscriptionSubtitle: (month: string) =>
      `Only plans that overlap ${month}. Tap the month to pick another; pause-only months may show no rows.`,
    tapToChangeMonth: 'Tap to change month',
    addOnsTitle: 'Add-ons',
    addOnsSubtitle: (month: string) =>
      `Add-ons for ${month} — ordered by the customer or added here. The customer and the delivery boy see the same list.`,
    toDeliver: 'To deliver',
    byDairy: 'the dairy',
    byCustomer: 'the customer',
    addOnStatusLine: (status: string, addedBy: string) => `${status} · added by ${addedBy}`,
    noAddOns: (month: string) => `No add-ons in ${month}.`,
    lockedDay: (reason: string) => `${reason} Add-ons for it can no longer change.`,
    addAddOnProduct: 'Add add-on product',
    editAddOnProduct: 'Edit add-on product',
    noActiveProducts: 'No active products in the catalogue. Add products under Admin Products first.',
    selectProduct: 'Select product',
    saveLine: 'Save line',
    couldNotSave: "Couldn't save. Please try again.",
    couldNotRemove: "Couldn't remove it. Please try again.",
    productGone: 'That product is no longer in the catalogue.',
    pickPackSize: (product: string) => `Pick one of ${product}'s pack sizes.`,
    monthPickerTitle: 'Product subscription month',
    removeAddOnTitle: 'Remove add-on?',
    removeAddOnBody: (product: string) => `“${product}” will be removed for this date only.`,
  },
  plansEditor: {
    title: 'Basic subscription details',
    noMilkProducts: 'No active milk catalogue products (Milk / Milk Product type). Add them under Admin Products first.',
    overlapShared: (month: string) => `Only milk lines that overlap ${month}.`,
    overlap: (month: string) => `Only milk lines that overlap ${month}. Step through months or tap the label to pick.`,
    update: 'Update',
    updateA11y: (product: string) => `Update ${product} subscription`,
    removeA11y: (product: string) => `Remove ${product} from subscription`,
    noLinesInMonth: (month: string) =>
      `No milk lines overlap ${month}. Use the month stepper to view other months, or add a line (dates can span this month).`,
    addMilkProduct: 'Add milk product',
    endDateHint:
      'End date defaults to month-end when you set the start date; you can edit it or use the calendar. End must be on or after the start date (same day is allowed to expire a line).',
    updateSubscription: 'Update subscription',
    saveSubscription: 'Save subscription',
    monthPickerTitle: 'Basic subscription month',
    duplicateTitle: 'Same milk product',
    duplicateBody:
      'This uses the same milk product as an existing basic subscription line. To save anyway, the existing line’s end date is set to the day before the new line’s start date (never earlier than the existing line’s start). The new line reuses the previous subscription’s end date when it is still on or after the new start. Subscription history keeps both segments; amounts in history use real delivery days and quantities, with a single segment credited per day when identical line details overlap on one day.',
    existing: (example: string) => `Existing: ${example}`,
    endPreviousAndSave: 'End previous & save',
    removeTitle: 'Remove milk subscription?',
    removeBody: (product: string) => `Remove “${product}” from this customer’s basic milk subscription?`,
    errors: {
      checkFields: 'Please check subscription fields',
      saveFailed: 'Unable to save subscription. Please try again.',
      removeInvalid: 'Unable to remove this line',
      cannotRemove: 'Cannot remove',
      removeFailed: 'Unable to remove subscription line. Please try again.',
      removeFailedTitle: 'Remove failed',
      closeLineInvalid:
        'Unable to close this line with a valid end date. Check start/end fields on the existing line.',
      newEndInvalid:
        'Adjust the new line’s end date so it is on or after its start (inherited from the previous line when possible).',
    },
  },
  lineFields: {
    milkProduct: 'Milk product',
    selectMilkProduct: 'Select milk product',
    searchProduct: 'Search product',
  },
  daySheet: {
    info: 'Add-ons added here go straight to the customer’s My days, the delivery boy’s run sheet and the bill — the same as when the customer orders them.',
    noActiveSubscriptions: 'No active subscriptions',
    noLinesForDay: (day: string) => `No subscription lines are scheduled for ${day}.`,
    thisDay: 'this day',
    day: 'Day',
    scheduledDetails: 'SCHEDULED DELIVERY DETAILS',
    subscriptionProducts: 'SUBSCRIPTION PRODUCTS',
    addOnProducts: 'ADD-ON PRODUCTS',
    itemCount: (n: number) => `${n} item${n === 1 ? '' : 's'}`,
    qty: (qty: number) => `Qty ${qty}`,
    noAddOnsYet: 'No add-ons yet. Add products for this date using the button below.',
    noSubscriptionDay: 'No subscription delivery this day. You can still add products for it — the customer can too.',
  },
  history: {
    title: 'Subscription history',
    titleForMonth: (month: string) => `Subscription history · ${month}`,
    blurb: 'Amount = times delivered × price per delivery, counted from the delivery records.',
    footnote:
      'Deliveries are counted from the calendar and delivery records, not from subscription date edits. A line that was closed and reopened counts each day once, on the segment with the latest start date.',
    kindAddOn: 'Add-on',
    kindBasic: 'Basic',
    timesDelivered: 'Times delivered',
    quantityDelivered: 'Quantity delivered',
    lastDelivery: 'Last delivery',
    issueDate: 'Issue date',
    amountValue: (amount: string) => `Amount ${amount}`,
    totalDelivered: 'Total delivered',
    totalDeliveredIn: (month: string) => `Total delivered in ${month}`,
    emptyForMonth: (month: string) =>
      `No subscription line ran in ${month}. Use the month stepper above to look at another month.`,
    empty: 'No subscription plan lines yet. Add basic milk lines under Basic subscription details.',
  },
  historyTable: {
    type: 'Type',
    start: 'Start',
    end: 'End',
    deliveredLast: 'Delivered (last)',
    qtyDelivered: 'Qty delivered',
    times: 'Times',
    empty:
      'No subscription plan lines yet. Add basic milk lines under Basic subscription details; delivery counts use saved day orders on the calendar and delivered rows on the customer profile when present.',
    mobileBlurb:
      'Amount = times delivered × price per delivery (plan line total), using calendar and delivery records—not subscription date edits alone. If the same subscription line (matching product, pack, and schedule) was closed and reopened, each day is counted once on the segment with the latest start date. Issue date is when the line was recorded in the system.',
    desktopBlurb:
      'Amount = times delivered × price per delivery. Issue date is system record time for the line; last delivery uses calendar day orders or profile deliveries.',
    priceLine: (amount: string) => `Price / delivery ${amount}`,
    datesLine: (issue: string, start: string, end: string) => `Issue ${issue} · Start ${start} · End ${end}`,
    deliveryLine: (last: string, qty: number, count: number) =>
      `Last delivery ${last} · Qty delivered ${qty} · Times ${count}`,
  },
  tactile: {
    previousMonth: 'Previous month',
    nextMonth: 'Next month',
    estimatedMonthlyTotal: 'Estimated Monthly Total',
    billingCycle: (range: string) => `Billing cycle: ${range}`,
    viewDetailedBill: 'View Detailed Bill',
  },
  calendar: {
    defaultLegend:
      'Base online catalog applies every day. Blue: profile line on that date · Green: saved day order and/or calendar add-on (tap a date to view or edit)',
  },
};
