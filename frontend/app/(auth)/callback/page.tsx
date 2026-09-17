'use client';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { storeOAuthToken } from '@/lib/auth';
import { Loader2 } from 'lucide-react';
import { Suspense } from 'react';

function CallbackHandler() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const token = params.get('token');
    const error = params.get('error');
    if (error) { router.replace('/login?error=' + error); return; }
    if (token) {
      storeOAuthToken(token);
      router.replace('/files');
    } else {
      router.replace('/login?error=no_token');
    }
  }, [params, router]);

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', gap:16 }}>
      <Loader2 size={40} style={{ animation:'spin 0.7s linear infinite', color:'var(--accent-violet)' }} />
      <p style={{ color:'var(--text-secondary)', fontSize:14 }}>Completing sign in…</p>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-animated" />}>
      <CallbackHandler />
    </Suspense>
  );
}
