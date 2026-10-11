'use client';
import { useEffect, useState } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import english from '@source/i18n/locales/en.json';
import hebrew from '@source/i18n/locales/he.json';
import DotWriteGrant from '@source/app/[locale]/content-intake/DotWriteGrant';
import { FATTAL_BOOKLET_TARGETS } from '@source/lib/content-intake/fattal';
import DotManifestApproval from '@source/app/[locale]/content-intake/DotManifestApproval';

export default function Page() {
  const [locale, setLocale] = useState('en');
  useEffect(() => { if (new URLSearchParams(location.search).get('locale') === 'he') setLocale('he'); }, []);
  return <NextIntlClientProvider locale={locale} timeZone="Asia/Jerusalem" messages={locale === 'he' ? hebrew : english}>
    <main dir={locale === 'he' ? 'rtl' : 'ltr'}><h1>Isolated approval test — synthetic data only</h1><DotManifestApproval /><DotWriteGrant ownerId="synthetic-owner" ownerEmail="synthetic-owner@example.invalid" projectId="demo-fattal-acceptance" targets={FATTAL_BOOKLET_TARGETS} /></main>
  </NextIntlClientProvider>;
}
