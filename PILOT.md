# Running the pilot

The apps now talk to the dairy's server (`mobile/.env` → `EXPO_PUBLIC_SERVICE_MODE=api`), so every phone reads and
writes the same records instead of keeping its own. This is what to do, in what order, and what to watch.

Going back is one line: set `EXPO_PUBLIC_SERVICE_MODE=mock` and restart the app. Nothing on the server is lost.

## Who can do what

You are the **owner**. Prices, the dairy's payment details, and taking people on or letting them go are yours
alone — nobody else can change them, however much else they can do.

- A **manager** is somebody you add to run the day: customers, rounds, attendance, offers, announcements, chat,
  confirming payments, and the counter's takings. They cannot re-price the milk or add staff.
- A **desk user** rings up walk-in sales at the counter and prints the bill. They see their own sales and the
  catalogue, and nothing else of the dairy's.

Add either from **Desk users** on your dashboard. They sign in like everybody else: their own mobile number the
first time, then a PIN of their own.

## The counter

For somebody who walks in and pays on the spot. The desk opens the app, taps what they are buying, takes cash or
UPI, and presses **Place the order** — the bill prints and the sale is done. It never goes near a monthly bill.

You see the day's takings under **Counter sales**: the total, split by cash and UPI, by who sold, and what sold.
It is kept apart from the milk round's money so you can tell which of the two is paying for the dairy.

**The printer is the one thing still to set up.** Printing to a Bluetooth counter printer needs the app installed
as a build (not the Expo preview), which is the same EAS step that push notifications need. Until then a sale is
still rung up and saved, and the desk is simply told the bill did not print.

## How everybody signs in

No SMS and no codes. Each person signs in with their **mobile number and a 4-digit PIN of their own**:

1. **The first time**, they type their own mobile number in both boxes — the number is the password.
2. The app then asks them to **choose a PIN**. They pick any four digits and type them twice. Nothing else in the
   app opens until they have.
3. **From then on** it is their number and that PIN. Their mobile number stops working as a password the moment a
   PIN is chosen.

So tell a new customer only this: *"Open the app, put your mobile number in both boxes, then choose a 4-digit PIN
you will remember."*

Things to know:

- **Only numbers already in the dairy's records can sign in at all.** Adding the customer or delivery boy is what
  creates their login; anyone else is told the number is not registered. Remove them and the login goes too — the
  PIN they chose stops working that moment.
- **Marking somebody Inactive (or switching App access off) shuts them out at once** — they cannot sign in, and
  a phone already signed in stops working on its next tap. Switch them back on and they are in again with the
  same PIN. Use this rather than deleting somebody you may want back.
- **Correcting somebody’s mobile number moves their login with it.** The old number stops working straight away;
  they keep the same PIN and stay signed in.
- **Five wrong PINs locks that person out for 15 minutes.** Waiting is enough; nothing is lost.
- **Forgotten PIN?** Open that customer in the admin app and press **Reset app PIN** on their card. They then sign
  in with their own mobile number again and choose a new one. Only the dairy can do this.
- **Nobody at the dairy can see a PIN**, not even in the database — only the person knows it.

Everything else below works today.

## Putting the dairy in

Two ways. **From one file** is quicker for the first load and much easier to correct:

```bash
cd server && cp data/dairy.example.json data/dairy.json
```

Fill that in — every product with its packs and real prices, the delivery team, the first customers and what
each of them takes every day — then:

```bash
cd server && npm run import -- --live --pin 1234 --dry-run
```

That writes nothing; it just says what it would do, and lists anything still missing (a price left at 0, a
customer with no mobile number, a plan naming a pack that does not exist). When it reads right, run it again
without `--dry-run`.

**Run it as often as you like.** Products are matched by name and people by mobile number, so a second run
corrects what is there rather than making a second copy. Change a price in the file, run it again, and every
customer taking that pack moves to the new price. `data/dairy.json` is kept out of the repo, because it holds
customers’ names, numbers and addresses.

The other way is **from the admin app**, screen by screen, which is how everything is edited from day two
anyway. In this order:

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
| MSG91 / DLT | no SMS at all: sign-in does not need it, but changing one’s own mobile number in the app does |
| R2 not enabled | no offer posters, announcement pictures or profile photos |
| no EAS project id | no push (reminders stay inside the app), and no Bluetooth bill printing at the counter |
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
