# Building the app for a phone

Everything in the app runs in Expo Go except two things, and both need a real build: **push notifications** and
**printing a bill at the counter**. A Bluetooth socket is native work, and Expo Go does not carry the native side
of it. So the counter phone needs the built app installed.

The build is made by EAS, which is Expo's own build service. It runs on their machines, so nothing has to be
installed here beyond the command below — no Android Studio, no SDK.

## What is already done

- `react-native-bluetooth-classic` is installed; the app talks to the printer through it.
- `app.json` names the app **Amrale Dairy**, gives it the identity `in.amraledairy.app`, and asks for the four
  Bluetooth permissions Android wants (two for Android 12 and newer, two for older phones).
- `eas.json` has three build profiles, each pointed at the dairy's live server.

## What is left, and why it needs you

An EAS build belongs to an Expo account. Signing in to one is yours to do.

```bash
cd mobile
npx eas-cli login
```

Then, once, to make the project on that account and write its id into `app.json`:

```bash
npx eas-cli init
```

Then build the counter phone's app:

```bash
npx eas-cli build --profile counter --platform android
```

It takes about fifteen minutes and ends with a link. Open that link on the counter phone and install it — Android
will ask whether to allow an app from outside the Play Store, which is expected for a shop's own app.

The free plan builds slowly at busy times but is otherwise enough for a dairy: builds are only needed when the app
itself changes, not when prices or customers do.

## Pairing the printer

Once, on the counter phone:

1. Switch the printer on and hold its feed button if it needs to be made discoverable (most 58mm printers do not).
2. Android **Settings → Bluetooth → Pair new device**, and pair it. It usually asks for `0000` or `1234`.
3. Open the app, sign in as the desk user, go to **Today's sales → Connect a printer**, and choose it.

The app only lists printers already paired with the phone. Pairing is fiddly and belongs to Android; it is done
once per printer, and the app remembers which one it is connected to.

## The other two profiles

- `preview` — the same app for a customer's, a delivery boy's or your own phone. Same command, `--profile preview`.
- `production` — an app bundle for the Play Store, for when the dairy gets there.

## When push is wanted too

`eas init` is also what push notifications are waiting for: it is the project id that lets Expo's push service
know which app a message is for. Once the project exists, push works on any installed build with no further setup
here.
