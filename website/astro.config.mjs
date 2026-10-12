// @ts-check
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

// https://docs.astro.build/en/reference/configuration-reference/
export default defineConfig({
  site: 'https://dairy.matdarraja.in',

  // English at /, Marathi at /mr/.
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'mr'],
    routing: { prefixDefaultLocale: false },
  },

  integrations: [
    sitemap({
      // Tells search engines each page's other-language version.
      i18n: { defaultLocale: 'en', locales: { en: 'en-IN', mr: 'mr-IN' } },
    }),
  ],

  trailingSlash: 'ignore',
});