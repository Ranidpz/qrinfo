import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '';

  return NextResponse.json({
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey.length,
    apiKeyStart: apiKey.substring(0, 10),
    apiKeyEnd: apiKey.substring(apiKey.length - 5),
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'NOT SET',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'NOT SET',
  });
}
