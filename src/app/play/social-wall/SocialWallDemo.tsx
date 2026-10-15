'use client';

import { useEffect, useState } from 'react';
import SocialWallViewer from '@/components/viewer/socialwall/SocialWallViewer';
import { DEMO_CODE_ID, installSocialWallDemo } from '@/components/viewer/socialwall/demo';
import type { SocialWallConfig } from '@/types/socialwall';

const BASE: SocialWallConfig = {
  eventTitle: 'יום כיף',
  groupLabel: 'המחלקה שלך',
  groups: [
    { id: 'mkt', label: 'שיווק', color: '#db2777' },
    { id: 'rnd', label: 'פיתוח', color: '#2563eb' },
    { id: 'hr', label: 'HR', color: '#7c3aed' },
    { id: 'ops', label: 'תפעול', color: '#ea580c' },
    { id: 'fin', label: 'כספים', color: '#059669' },
    { id: 'mgmt', label: 'הנהלה', color: '#0891b2' },
  ],
  captionMax: 120,
  branding: {
    logoUrl: '/play/social-wall/your-logo.svg', // the customer's logo goes here
    coverImageUrl: '/play/social-wall/cover.webp',
    primaryColor: '#5b21b6',
    secondaryColor: '#2563eb',
    welcomeTitle: 'ברוכים הבאים\nליום הכיף שלנו!',
    welcomeSubtitle: 'מצלמים. משתפים. מתחברים.',
  },
};

export default function SocialWallDemo({ reset, access }: { reset: boolean; access: 'open' | 'whatsapp' }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    installSocialWallDemo({ reset });
    setReady(true);
  }, [reset]);
  if (!ready) return null;
  return <SocialWallViewer codeId={DEMO_CODE_ID} shortId="demo" title="Social Wall" config={{ ...BASE, access }} />;
}
