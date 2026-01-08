import type { ReactNode } from 'react';
import '../globals.css';

export default function RedirectLayout({ children }: { children: ReactNode }) {
  return (
    <html>
      <body>{children}</body>
    </html>
  );
}


