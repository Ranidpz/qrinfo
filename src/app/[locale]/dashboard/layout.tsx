'use client';

import UpdateNotification from '@/components/notifications/UpdateNotification';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      {/* Update notification popup */}
      <UpdateNotification />
    </>
  );
}
