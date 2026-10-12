# Amrale Dairy website

The public website for **dairy.matdarraja.in**, built with [Astro](https://astro.build) as plain static pages
(fast to load, good for Google, and cheap to host).

## Work on it

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static site in dist/
npm run preview  # serve the built site
```

- Contact details, address, products and the WhatsApp message live in `src/data/site.ts` — change them there.
- Brand colours and fonts are in `src/styles/global.css`.
- Images are in `public/images/` (logo and the product banner from the app).

## Offers

The home page has an **Offers** section (and an "Offers" menu link) that shows only while the dairy has an offer
running. It is hidden when there is none, so the page looks the same as without it.

- **Where the offers come from:** the dairy's server, at
  `https://amrale-dairy-api.amrale-dairy-website.workers.dev/public/offers.json`. Nothing is uploaded and nothing is
  rebuilt: an offer the admin starts in the app is on the website within a minute, and ending or deleting one takes
  it off just as fast. Offers with a code are never published.
- **Dates:** each offer shows from its first day to its last day (India date). The visitor's browser reads the
  offers and checks the date every time the page opens, so an offer also appears and disappears on its own dates.
- **Pointing the site elsewhere:** set `PUBLIC_OFFERS_URL` when building (see `.env.example`) — another server, or
  `/offers.json` to go back to a file uploaded with the site. The empty `public/offers.json` is kept for that.
- The answer's shape belongs to the app (`mobile/src/domain/offers/websiteFeed.ts`) and the server sends it
  (`server/src/offers/mapping.ts`); `src/lib/offers.ts` must be kept in step with both. The words on the offer cards
  are in `src/i18n/ui.ts` under `offers`.

## Why `overrides` pins vite, rolldown and lightningcss

This PC's Windows application-control policy blocks newly released native build files. The pinned versions are the
ones the mobile app already uses, which Windows allows. On a hosting service (Netlify, Vercel, Cloudflare Pages) the
overrides can stay — they build the same site.

## Publish

The site is hosted on **Cloudflare Pages**, project `amrale-dairy-site` (free, and allowed for a business site).
Publish a new version from this folder:

```bash
npm run build
npx wrangler pages deploy dist --project-name amrale-dairy-site --branch main
```

It is then live at `https://amrale-dairy-site.pages.dev` and, once the custom domain is attached in the Cloudflare
dashboard (Workers & Pages → the project → Custom domains), at `https://dairy.matdarraja.in`.

DNS stays with Hostinger, which also serves `matdarraja.in` itself and its email — don't move the nameservers. The
subdomain is a single CNAME record: name `dairy`, target `amrale-dairy-site.pages.dev`.

Any other static host works the same way (build command `npm run build`, output folder `dist`, base directory
`website`). The site's own address lives in `astro.config.mjs` (`site`) and `src/data/site.ts` (`site.url`); change
both, and the sitemap line in `public/robots.txt`, if the dairy moves to another address later.

`wrangler.jsonc` is for Cloudflare's newer Workers hosting (`npx wrangler deploy`), which needs the domain's DNS to
be on Cloudflare — unused for now, kept for when that changes.
