import path from 'path';
import { defineConfig } from 'vitest/config';

// Tests run as a phone in India would: `new Date(2026, 8, 15, 21, 0)` is 9 pm on that phone, on any machine.
process.env.TZ = 'Asia/Kolkata';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
