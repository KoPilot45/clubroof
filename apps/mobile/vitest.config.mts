import { defineConfig } from 'vitest/config';

// Modultests für reine Logik (Warteschlange, Zwischenspeicher); Bildschirme prüft das Browserskript.
export default defineConfig({
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
});
