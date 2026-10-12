# Amrale Dairy backend (Cloudflare Workers + D1)

The shared server the three apps talk to. Until it is live, each phone keeps its own copy of the data
(`EXPO_PUBLIC_SERVICE_MODE=mock` in the app); when it is, the app switches to `api` and every phone sees the same
dairy.

- **Worker** (this folder): the HTTP API, written in TypeScript.
- **D1**: the SQLite database Cloudflare runs, where every record lives.
- **R2**: pictures and videos (offer posters, announcement pictures) — **written, waiting for R2 to be turned on**
  for the account (see **Pictures**).
- **Cron Triggers**: the 6 pm order reminders, the offers starting today, and the monthly bills *(running)*.
- **KV**: small hot values (an OTP's resend window, rate limits).

## Why these

The website is already on this account, D1 and R2 cost nothing at the dairy's size, and Workers run close to India.
The one thing Cloudflare does not hand us is sign-in, so OTP and sessions are written here (see `auth.md`).

## The shape of the API

One route per thing the app needs, grouped the way the app's services are grouped today
(`mobile/src/domain/*/service.interface.ts`):

| Area | Routes |
| --- | --- |
| Auth | `POST /auth/otp/request`, `POST /auth/otp/verify`, `POST /auth/logout`, `GET /auth/me` |
| Customers | `GET/POST /customers`, `GET/PATCH/DELETE /customers/:id` (a customer patches only their own, see **Customer self-service**), `GET /me/customer` |
| Products | `GET/POST /products`, `GET/PATCH/DELETE /products/:id`, categories |
| Subscriptions | `PATCH /customers/:id/plans`, `POST /customers/:id/days` (skip, quantity, add-on) |
| Deliveries | `GET /deliveries?ymd=`, `POST /deliveries/mark`, `GET /runs/today` |
| Billing | `GET /customers/:id/bills?month=` *(done)*; payments and payment requests ride on the customer record |
| Delivery boys | `GET/POST /delivery-boys`, attendance, advances, salary |
| Offers | `GET/POST /offers`, `GET/PATCH/DELETE /offers/:id`, `POST /offers/claim`, `GET /public/offers.json` (the website, no sign-in) |
| Announcements | `GET /announcements`, `GET /announcements/:id`, `PUT /announcements/:id`, `DELETE /announcements/:id`, `POST /announcements/:id/read` |
| Chat | `GET /chat`, `POST /chat`, `POST /chat/read` |
| Notifications | `GET /notifications` (`?scope=all` for the dairy), `POST /notifications`, `POST /notifications/read`, `POST /notifications/:id/response` |
| Push | `POST /push/tokens`, `DELETE /push/tokens/:token` |
| Pictures | `POST /media`, `GET /media/*` (no sign-in), `DELETE /media/*` |
| Settings | `GET /settings`, `PUT /settings/cover`, `PUT /settings/payment` |
| Profile | `GET/PATCH /me/profile`, `POST /me/profile/otp`, `PUT /me/profile/avatar`, `POST /me/profile/mobile/{old,new}/{otp,verify}` |
| Reports | the app builds reports from the data it already fetches; no extra routes at first |

Rules the app already owns (bills, offers, salary) stay in `mobile/src/domain/**`. The server stores and serves
records; it re-checks only what must not be trusted to a phone: who you are, what you may read or write, and the
9 pm cut-off.

## Order of work

1. **Groundwork** — this Worker, the D1 schema, health check, local dev. *(done)*
2. **Sign-in** — OTP by SMS (MSG91 still to come), sessions, roles. *(done)*
3. **Customers and products** — first area end to end; the app's mock service for these is replaced. *(done)*
4. **The rest of the data** — subscriptions, days, deliveries, billing, payments *(done)*, delivery boys *(done)*,
   offers *(done)*, customer self-service *(done)*, announcements, chat and notifications *(done)*.
5. **Jobs and extras** — the 6 pm reminders, the offer notices and the monthly bills as jobs of the server’s own,
   with push *(done)*; pictures in R2 *(written, R2 to be turned on)*; the dairy’s settings *(done)*; everybody’s
   own profile *(done)*.
6. **Pilot** — a few routes and real customers, then launch.

## Running it

```bash
npm install
npm run db:migrate:local   # applies migrations/ to the local D1 copy
npm run dev                # http://localhost:8787
npm test
```

Deploying (once the first area is ready) is `npm run deploy`; secrets go in with `npx wrangler secret put NAME`.

## Running the apps against this server

In `mobile/.env`:

```
EXPO_PUBLIC_SERVICE_MODE=api
EXPO_PUBLIC_API_BASE_URL=http://localhost:8787
```

Then `npm run dev` here and `npm run web` (or `npm start`) in `mobile`. A phone on the same Wi-Fi uses the
computer's address instead of `localhost`, e.g. `http://192.168.0.5:8787`.

`api` moves only the areas this server keeps — signing in, customers (the dairy’s screens and the customer’s own),
products, the delivery team, offers, announcements, chat and notifications. Everything else still keeps its records
on the phone, so the app works while the rest is built. Back to the way it was: `EXPO_PUBLIC_SERVICE_MODE=mock`.

Signing in needs a number the dairy knows: the admin login created by `migrations/0003_admin_login.sql`, or a
customer or delivery boy the admin has added. With `SMS_PROVIDER=log` no SMS is sent — the code is written to the
Worker's log and shown in the app's demo banner.

## Customer self-service

The customer app writes on the customer’s own record: a one-off order, a paused day, a different everyday quantity,
a new subscription line, "I have paid by UPI". Those go through the same `PATCH /customers/:id` the dairy uses, and
the apps send a whole list back whenever anything in it changes.

From the dairy that is fine — the dairy owns the record. From a customer it is not, so a customer’s patch is never
written as it arrives: `src/customers/selfService.ts` rebuilds each list from what is stored and takes only the
changes a customer may make. What it holds to, whatever a phone sends:

- **Their own record only.** Another customer’s id is refused before the record is even read, so it answers the same
  whether that customer exists or not. Anything outside `subscriptionPlans`, `subscriptionExceptions`, `extraOrders`,
  `paymentRequests` and `deliveries` — the route, the discount, recorded payments, the status — is the dairy’s.
- **The cut-off.** A day can be changed until 9 pm the evening before, dairy time, and never once a delivery is
  marked for it. Today is never orderable: the crates went out this morning. A day already arranged can only be held
  at the quantity it was arranged with, which is what the app writes when the everyday quantity changes.
- **Money.** An order’s price must be the catalog’s price for that pack, or the price of an offer this customer has
  on that day — and the offer’s wording and "was" price are taken from the offer, not from the phone. A new
  subscription line is priced from the catalog too.
- **History stays.** Nothing is removed by being left out of a list. An order is cancelled and a payment request
  withdrawn, both of which keep the row; a delivered day cannot be changed, except to record how many packs it had
  when it never recorded one; only the dairy confirms a payment.

The rules are the ones the customer app already works by (`mobile/src/components/customer/customerActions.ts`,
`subscriptionActions.ts`), checked again here because a phone cannot be trusted to check them. A refusal comes back
as a code the app can act on (`DAY_CLOSED`, `ORDER_PRICE_MISMATCH`, `PAYMENT_ALREADY_REVIEWED`…).

Not here yet: changing one’s own name, address or mobile number. That is the profile area, which needs its own OTP
flow (`mobile/src/domain/profile/service.interface.ts`), and it still runs on the phone.

Walk through it against a running server with `npm run e2e:self`.

## Offers

Bills are worked out from offers, so the server keeps them honest whatever a screen sends:

- An offer that has **started** (its first day has passed, or the dairy ended it) keeps its kind, prices, code and
  first day. Only the wording, the poster, the last day and ending it may change, and it cannot be deleted — it is
  ended instead, so every bill that already counted it stays as it was.
- A **first day in the past** is refused, for the same reason.
- A **code** belongs to one offer for good. `POST /offers/claim` looks the code up here, so a coded offer is never
  sent to a phone that has not unlocked it; the claim is written to `offer_claims` and rides back on the customer’s
  record (`offerClaims`). Nothing else writes claims — a saved customer record cannot add or drop one.
- `GET /public/offers.json` is the website’s: the offers running today that need no code, in the shape
  `mobile/src/domain/offers/websiteFeed.ts` defines, with no ids, no codes and no sign-in. The website reads it
  every time a visitor opens the page, so an offer appears and disappears on its own (`website/src/lib/offers.ts`).

Walk through the whole area against a running server with `npm run e2e:offers`.

## Messages

Three areas that all answer the same question — who may say what to whom.

**Announcements** are written by the dairy, and by a delivery boy’s app when it marks a day (one message, about
that day, to that house). The app chooses the id, so sending is `PUT /announcements/:id`: a delivery announcement’s
id is made from the customer and the day, and marking the day again corrects the message instead of sending a
second one — which is why a corrected message is unread again for everybody. A customer is given the ones sent to
them, with their own read mark and never another household’s, and `POST /announcements/:id/read` records that they
opened it.

**Chat** is one conversation per customer. A customer reads and writes only their own, whatever the phone sends;
the dairy reads them all, which is what the admin app’s list of chats is built from. Opening a conversation marks
the other side’s messages in it as seen.

**Notifications** are addressed, not broadcast, so each app is handed its own inbox. The apps raise them as things
happen (`mobile/src/domain/notifications/events.ts`) — and may only write to inboxes they have business writing to:
a customer’s app tells the dairy what the customer did and tells the customer themselves; a delivery boy’s app the
dairy, itself, and the houses on its round; the dairy anyone. A row about the same subject as a recent one replaces
it, so one change made in a few taps reads as one notification, exactly as it does on a phone of its own.
`?scope=all` hands the dairy every row, which its reports are built from.

The evening reminders are the server’s own job now (see **The dairy’s day** below), and a customer’s answer to
one keeps the dairy’s running tally for that evening up to date.

Walk through all three with `npm run e2e:messages`.

## The dairy’s day

Two jobs run on Cloudflare’s clock (`triggers.crons` in `wrangler.jsonc`, in UTC because that is the only clock
cron knows):

- **6 pm, the dairy’s time** (`30 12 * * *`) — every customer with a delivery tomorrow is told what is coming and
  asked whether to change it or keep it as it is, while there is still time before the 9 pm cut-off. The dairy
  gets one line saying how many were asked, and a second line that keeps count of the answers as they come in.
- **Midnight, the dairy’s time** (`30 18 * * *`) — the offers that start today are told to the customers they are
  for: everybody, or the customers who have typed the code.
- **6 am, the dairy’s time** (`30 0 * * *`) — the monthly bills whose billing day is today (see **Bills**).

All three are safe to run twice — a customer already asked about tomorrow, already told about an offer, or
already sent a month’s bill, is left alone — so a missed or repeated run costs nothing. Run one by hand against
a local server, for a day of your choosing:

```bash
curl "http://127.0.0.1:8787/cdn-cgi/local/scheduled?cron=30+12+*+*+*"
```

The words come from `src/jobs/words.ts` — the only place the server writes a sentence of its own, because nobody
is holding a phone at 6 pm. They are copies of the app’s wording and date names, and the file says which app
files to keep them in step with. What is going to a house that day is worked out by `src/jobs/schedule.ts`, a
port of the apps’ own day rules.

## Bills

A month’s bill is what was delivered — the subscription days and the one-off orders — less the customer’s own
discount and what the dairy’s offers took off, with whatever earlier months left unpaid carried into it.
Payments settle the oldest bill first, whatever month they were made in.

`src/billing/` is a **port** of the billing the apps already do (`mobile/src/components/admin/billingTimeline.ts`,
`customerSubscriptionMonthUtils.ts`, `mobile/src/domain/offers/offers.ts`). It has to be: a phone with no signal
still shows a bill, so both sides work the same sums out. `src/billing/timeline.test.ts` is the apps’ own test
cases with the apps’ own numbers — if a change here makes them differ, one of the two is wrong.

`GET /customers/:id/bills?month=` hands back that month and every month before it, with what is outstanding,
what is overdue and what has been paid in advance. The dairy may ask for anyone; a customer only for themselves.

The one thing decided here and not in the apps is **when** a bill is announced: once the month it covers is over,
on the dairy’s billing day — the customer’s `billingCycleDate` in the month after it, or the 1st where the dairy
has set no day, and the last day of a short month when the billing day is past its end. The amount and the due
date are that month’s own row, arrears included.

In `mock` mode no bill notification is raised at all (a phone has no monthly job); with the server, one is.

Walk through it with `npm run e2e:bills`.

## Push

The apps are Expo apps, so a phone is reached through Expo’s push service. The app registers the token Expo gave
it when somebody signs in (`POST /push/tokens`, with the language that phone is set to) and forgets it when they
sign out, so a shared phone never keeps the last person’s notifications. A token Expo reports as dead
(`DeviceNotRegistered`) is dropped.

Push is only for what the server raises while nobody is looking — the evening reminder and an offer starting.
Anything an app raises while somebody is using it is already on their screen.

Before this reaches a real phone the app needs an EAS project id in `mobile/app.json`
(`expo.extra.eas.projectId`) and a development or production build: Expo Go on Android has had no push since
SDK 53, and without a project id a build cannot ask Expo for a token. Until then the registration is simply
skipped — the reminder is still in the app when the customer opens it — and the rest of this works as it will
with push.

Walk through the jobs and the push registration with `npm run e2e:jobs` (against `npm run dev`).

## Everybody’s own profile

A customer, a delivery boy and the dairy itself all open the same profile screen: their name, where they live,
their photo — and the number they sign in with.

- **Changing a detail** asks for a code on the number they already use (`POST /me/profile/otp`, then
  `PATCH /me/profile` with it). A profile is what the dairy’s screens and the delivery round read off, so it is
  not something a phone left on a table can quietly rewrite.
- **Changing the number itself** asks twice: once on the old number, to prove the person asking is the one who
  has it, and once on the new one, to prove the new number is theirs. The new number must not already belong to
  anybody — checked when the code is sent *and* again when it is answered, because a number can be given to
  somebody else in between. Between the two steps the only thing remembered is that the old number answered
  (`profile_mobile_changes`).
- **The photo** goes to R2 like every other picture; a record keeps its address.

A customer’s name and address are also on the customer record the dairy keeps, and a delivery boy’s on theirs, so
both are written: what somebody changes about themselves is what the dairy’s screens then show. The session
belongs to the login, not to the number, so changing the number leaves everyone signed in — and from then on the
new number is the one that signs in.

The codes are the sign-in codes’ twins (`profile/otp.ts`): a minute to answer, a minute between codes, five
tries, the same table, told apart by what the code is for. Signing in keeps its own, because there the number
has to be one the dairy already knows and a session comes out of it.

Walk through it with `npm run e2e:profile`.

## The dairy’s settings

Two things the dairy decides once and every app then shows:

- **the cover picture** on the home screen of all three apps;
- **how customers pay** — the dairy’s UPI id, the name their UPI app shows as the payee, whether cash is taken,
  and a line of instructions. Without these the customer app cannot offer to pay at all, which is exactly why
  they belong here and not on whichever phone the admin happened to use.

`GET /settings` is read by any signed-in app; only the dairy writes. An empty UPI id means "no UPI" — then cash
has to be accepted, or customers would have no way to pay. A cover pasted in as a `data:` URI is refused: it goes
to R2 like every other picture (see **Pictures**). Where the dairy has set nothing, the server says so and the
apps show what they always showed — the cover they ship with, and no payment options.

**The FAQ, the contact details and the privacy policy are deliberately not here.** They read like settings, but
they are fixed app content written in both languages (`mobile/src/i18n/{en,mr}/help.ts`) and nothing in the app
edits them — moving them to the server would leave a customer reading Marathi an English page, and give the dairy
nothing it could change. They stay in the apps until there is a reason for the dairy to edit them, which would
mean an editor and a column per language.

Walk through it with `npm run e2e:settings`.

## Pictures

An offer poster or the picture on an announcement used to travel inside the record itself — a `data:` URI in the
row, or a file path that meant something only on the phone that picked it. Neither works for a dairy with more
than one phone: one is read back on every screen that shows that record, the other shows nothing to anybody else.

So a picture goes up once (`POST /media`, the bytes as they are with the type in the header) and the record keeps
its address. Reading one needs no sign-in — an `<img>` tag cannot carry a token, and an offer poster belongs on the
public website — so the addresses are random and unguessable, and nothing that must be kept from whoever has the
link belongs here. A key is never reused, so a picture is cached for a year. The dairy may take one down; a
customer may not. Photos and videos only, up to 10 MB.

A record that arrives with a picture pasted into it (a `data:` URI over 64 KB) is refused with
`PICTURE_NOT_UPLOADED`, so a row never carries a photograph again.

### Turning R2 on

This is the one thing the dairy has to do in the Cloudflare dashboard: **R2 → Enable** (it asks for a payment
method; the free tier covers far more than this dairy will use). Then:

```bash
npx wrangler r2 bucket create amrale-dairy-media
# uncomment the "r2_buckets" line in wrangler.jsonc
npm run deploy
```

Until that is done the Worker simply runs without the bucket: `/media` answers `MEDIA_NOT_SET_UP`, and the apps
keep a picture as they picked it, exactly as they did before. `npm run e2e:media` walks the whole thing through
`npm run dev`, which simulates R2 locally whether or not the account has it.

## Live

- **API:** `https://amrale-dairy-api.amrale-dairy-website.workers.dev` (Cloudflare Workers, free plan)
- **Database:** D1 `amrale-dairy`, daily backups kept by Cloudflare
- **Secret:** `OTP_PEPPER` (set with `wrangler secret put OTP_PEPPER`; changing it signs everyone out)

Deploy a new version: `npm run deploy`. Apply new migrations to the live database first: `npm run db:migrate`.

### Signing in while there is no SMS provider

`SMS_PROVIDER=log` and `OTP_DEV_ECHO=false` on the live server: the code is written to the Worker's log and
**never** returned in the answer, so a stranger who knows the dairy's number cannot sign in. To read a code while
testing, run `npm run logs` and ask for the code from the app — the line reads `[otp] 8208682688 -> 123456`.

When the MSG91 account and the DLT registration are through:

```bash
npx wrangler secret put MSG91_AUTH_KEY
npx wrangler secret put MSG91_TEMPLATE_ID
# then set "SMS_PROVIDER": "msg91" in wrangler.jsonc and `npm run deploy`
```
