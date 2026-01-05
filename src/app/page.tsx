import { redirect } from 'next/navigation';

export default function Home() {
  // Redirect to marketing landing page
  // Logged-in users will be redirected to dashboard from there
  redirect('/marketing');
}
