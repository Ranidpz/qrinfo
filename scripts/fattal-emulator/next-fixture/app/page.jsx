'use client';
import { NextIntlClientProvider } from 'next-intl';
import messages from '@source/i18n/locales/en.json';
import DotManifestApproval from '@source/app/[locale]/content-intake/DotManifestApproval';

export default function Page() {
  return <NextIntlClientProvider locale="en" timeZone="Asia/Jerusalem" messages={messages}>
    <main><h1>Isolated approval test — synthetic data only</h1><DotManifestApproval /></main>
  </NextIntlClientProvider>;
}
