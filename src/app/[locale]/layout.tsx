import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { locales, type Locale, getDirection } from '@/i18n/config';
import { Providers } from '../providers';
import ClientLayout from './ClientLayout';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Validate locale
  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  // Enable static rendering
  setRequestLocale(locale);

  // Get messages for the locale
  const messages = await getMessages();
  const direction = getDirection(locale as Locale);

  return (
    <NextIntlClientProvider messages={messages}>
      <Providers>
        <ClientLayout locale={locale} direction={direction}>
          {children}
        </ClientLayout>
      </Providers>
    </NextIntlClientProvider>
  );
}
