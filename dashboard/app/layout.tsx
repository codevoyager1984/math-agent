import '@mantine/core/styles.css';

import { ColorSchemeScript, mantineHtmlProps } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';

import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/tiptap/styles.css';

import { Toaster } from 'sonner';
import ThemeProvider from '../components/ThemeProvider';

import './page.module.css';

export const metadata = {
  title: 'Math Agent',
  description: 'Math Agent',
};

export default function RootLayout({ children }: { children: any }) {
  return (
    <html lang="en" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript />
        <meta
          name="viewport"
          content="minimum-scale=1, initial-scale=1, width=device-width, user-scalable=no"
        />
      </head>
      <body>
        <ThemeProvider>
          <Toaster
            richColors
            closeButton
            visibleToasts={10}
            className="pointer-events-auto"
            position={'top-right'}
          />

          <Notifications position="top-right" zIndex={1000} />
          <ModalsProvider>{children}</ModalsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
