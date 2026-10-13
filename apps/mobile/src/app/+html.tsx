import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Wurzel-HTML der Web-App: `viewport-fit=cover`, damit das Plakat auf dem Handy unter die Statusleiste
 * reicht; Hintergrund und `theme-color` setzt die App je Theme (siehe `useWebChrome` in `_layout.tsx`).
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="de">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta name="theme-color" content="#0B120E" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: 'html,body{background-color:#0B120E}' }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
