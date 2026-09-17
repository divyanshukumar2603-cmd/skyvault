'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Shield, Mail, Lock, Eye, EyeOff, User, Loader2 } from 'lucide-react';
import { registerAndStore } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const strength = (() => {
    const p = form.password;
    if (p.length === 0) return 0;
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  })();

  const strengthColors = ['', '#ef4444', '#f59e0b', '#10b981', '#06b6d4'];
  const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong'];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true); setError('');
    try {
      await registerAndStore(form.email, form.password, form.name);
      router.push('/files');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-animated">
      <div style={{ position:'fixed', top:'20%', right:'15%', width:400, height:400, background:'radial-gradient(circle, rgba(79,70,229,0.15) 0%, transparent 70%)', pointerEvents:'none' }} />
      <div style={{ position:'fixed', bottom:'20%', left:'10%', width:300, height:300, background:'radial-gradient(circle, rgba(124,58,237,0.1) 0%, transparent 70%)', pointerEvents:'none' }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass w-full max-w-md p-8"
        style={{ boxShadow:'0 25px 60px rgba(0,0,0,0.5)' }}
      >
        <div className="text-center mb-8">
          <div style={{ width:56, height:56, background:'linear-gradient(135deg,#7c3aed,#06b6d4)', borderRadius:16, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
            <Shield size={28} color="white" />
          </div>
          <h1 className="gradient-text" style={{ fontSize:28, fontWeight:800, marginBottom:6 }}>Create Account</h1>
          <p style={{ color:'var(--text-secondary)', fontSize:14 }}>Start securing your files today</p>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:24 }}>
          <a href={`${API_URL}/api/auth/google`} className="btn btn-secondary" style={{ justifyContent:'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Google
          </a>
          <a href={`${API_URL}/api/auth/github`} className="btn btn-secondary" style={{ justifyContent:'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
            GitHub
          </a>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
          <div style={{ flex:1, height:1, background:'var(--border)' }} />
          <span style={{ color:'var(--text-muted)', fontSize:12 }}>or register with email</span>
          <div style={{ flex:1, height:1, background:'var(--border)' }} />
        </div>

        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {error && <div style={{ padding:'12px 16px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, color:'#f87171', fontSize:14 }}>{error}</div>}
          <div>
            <label style={{ display:'block', marginBottom:8, fontSize:13, color:'var(--text-secondary)', fontWeight:500 }}>Display Name</label>
            <div style={{ position:'relative' }}>
              <User size={16} style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }} />
              <input type="text" className="input" style={{ paddingLeft:42 }} placeholder="Your name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
          </div>
          <div>
            <label style={{ display:'block', marginBottom:8, fontSize:13, color:'var(--text-secondary)', fontWeight:500 }}>Email</label>
            <div style={{ position:'relative' }}>
              <Mail size={16} style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }} />
              <input type="email" required className="input" style={{ paddingLeft:42 }} placeholder="you@example.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            </div>
          </div>
          <div>
            <label style={{ display:'block', marginBottom:8, fontSize:13, color:'var(--text-secondary)', fontWeight:500 }}>Password</label>
            <div style={{ position:'relative' }}>
              <Lock size={16} style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }} />
              <input type={showPw ? 'text' : 'password'} required className="input" style={{ paddingLeft:42, paddingRight:42 }} placeholder="Min. 8 characters" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
              <button type="button" onClick={() => setShowPw(!showPw)} style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {form.password && (
              <div style={{ marginTop:10 }}>
                <div style={{ display:'flex', gap:4, marginBottom:6 }}>
                  {[1,2,3,4].map(i => (
                    <div key={i} style={{ flex:1, height:3, borderRadius:99, background: i <= strength ? strengthColors[strength] : 'var(--border)', transition:'background 0.3s' }} />
                  ))}
                </div>
                <span style={{ fontSize:12, color: strengthColors[strength] }}>{strengthLabels[strength]}</span>
              </div>
            )}
          </div>
          <button type="submit" disabled={loading} className="btn btn-primary" style={{ width:'100%', justifyContent:'center', marginTop:4 }}>
            {loading ? <Loader2 size={16} style={{ animation:'spin 0.7s linear infinite' }} /> : null}
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p style={{ textAlign:'center', marginTop:24, fontSize:14, color:'var(--text-secondary)' }}>
          Have an account?{' '}
          <Link href="/login" style={{ color:'#a78bfa', textDecoration:'none', fontWeight:500 }}>Sign in</Link>
        </p>
      </motion.div>
    </div>
  );
}
