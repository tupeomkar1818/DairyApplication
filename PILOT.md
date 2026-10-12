# Running the pilot

The apps now talk to the dairy's server (`mobile/.env` → `EXPO_PUBLIC_SERVICE_MODE=api`), so every phone reads and
writes the same records instead of keeping its own. This is what to do, in what order, and what to watch.

Going back is one line: set `EXPO_PUBLIC_SERVICE_MODE=mock` and restart the app. Nothing on the server is lost.

## Before anybody else can sign in

**Only people whose sign-in code you can read can get in.** No SMS goes out yet (MSG91 and the DLT registration are
not done), so the code is written to the Worker's log instead:

```bash
cd server && npm run logs
```

Leave that running, ask for a code in the app, and the line reads `[otp] 8208682688 -> 123456`. That works for any
number the dairy has added — but it means a customer cannot sign in by themselves. Until MSG91 is live, the pilot is
the dairy's own people, with somebody at the computer reading codes out.

Everything else below works today.

## Putting the dairy in

In this order, from the admin app:

1. **Products** — each product with its packs and real prices. A pack's price is what every bill is worked out
   from, so get these right first. (The server starts empty: there is nothing to correct, only to enter.)
2. **The dairy's payment details** — Payment settings: the UPI id, the name customers' UPI apps will show, whether
   cash is taken, and the note they see. Until this is in, the customer app cannot offer to pay at all.
3. **Delivery boys** — name, mobile, route, salary. The mobile number is how they sign in.
4. **Customers** — one route's worth to start with. Each needs their mobile number (that is their login), their
   address, and their subscription lines: the product, the pack, how many a day, and the day it starts. The bill
   follows from those.
5. **An offer**, if one is running. It shows in the customer app, and on the website within the minute.

## What happens on its own

The server runs the dairy's day on Cloudflare's clock — nobody has to have the app open:

| when | what |
| --- | --- |
| 6 pm | every customer with a delivery tomorrow is asked whether to change it or keep it; the dairy gets one line saying how many were asked, and a running count of the answers |
| midnight | the customers an offer starting today is for are told about it |
| 6 am | the bills whose billing day is today go out — on the 1st for a dairy that has set no billing day |

To watch one happen, keep `npm run logs` running at that time; each job logs a line (`[cron] … reminded 12
customer(s) about tomorrow`). Both the dairy's and the customers' notification lists show the result.

## The first week, day by day

- **Every morning**: the delivery boy opens the delivery app, sees the round, and marks each house delivered or not.
  That marking is what bills are built from — a day nobody marks is a day nobody is charged for.
- **During the day**: customers pause days, add one-off orders and type offer codes from their own app. Anything
  past 9 pm for tomorrow is the dairy's to change, not theirs.
- **Every evening**: check the 6 pm reminders went out, and that answers come back.
- **The 1st of next month**: the bills go out. Open a customer's bill in the admin app and check it against what was
  actually delivered before anybody is asked to pay.
- **When money comes in**: a customer says they have paid from the app; the dairy confirms it under Payments to
  review. Nothing counts as paid until the dairy confirms it.

## What is not there yet, and what it means

| missing | what the pilot sees |
| --- | --- |
| MSG91 / DLT | no SMS: codes are read from `npm run logs`, so customers cannot sign in unaided |
| R2 not enabled | no offer posters, announcement pictures or profile photos |
| no EAS project id | no push: reminders appear in the app, not on the phone's lock screen |
| `dairy.matdarraja.in` CNAME | the website is live at `amrale-dairy-site.pages.dev` only |

## Getting the app onto a phone

The web build (`cd mobile && npm run web`) runs on the computer and is enough for the dairy's own desk. For phones,
either run `npm start` and open it in Expo Go over the same Wi-Fi, or make a build with EAS — which needs the EAS
project id that push is waiting on anyway.

## If something looks wrong

- `cd server && npm run logs` shows every request and every job as it happens.
- The walk-throughs under `server/scripts` each exercise one area end to end against a server; run them against a
  local server (`npm run dev`), never against the live one — they create and delete records.
- `server/README.md` says, area by area, what the server decides and what it leaves to the apps.
