import { defineConfig } from 'vitest/config';
import path from 'path';

// Tests run as a phone in India would: the dairy's day boundaries are IST.
process.env.TZ = 'Asia/Kolkata';

export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
});
