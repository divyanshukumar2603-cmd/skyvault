'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, HardDrive, Shield, Key } from 'lucide-react';
import { authApi } from '@/lib/api';
import { formatBytes } from '@/lib/utils';

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => { authApi.me().then(r => setUser(r.data)).catch(() => {}); }, []);

  const pct = user ? Math.round((Number(user.storageUsed) / Number(user.storageQuota)) * 100) : 0;

  return (
    <div style={{ padding:32, minHeight:'100vh', maxWidth:720 }}>
      <h1 style={{ fontSize:24, fontWeight:800, marginBottom:4 }}>Account Settings</h1>
      <p style={{ color:'var(--text-secondary)', fontSize:14, marginBottom:32 }}>Manage your profile and storage</p>

      {user && (
        <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {/* Profile card */}
          <div className="glass" style={{ padding:24 }}>
            <h2 style={{ fontSize:16, fontWeight:700, marginBottom:20, display:'flex', alignItems:'center', gap:8 }}><User size={16}/> Profile</h2>
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div>
                <label style={{ display:'block', marginBottom:8, fontSize:13, color:'var(--text-secondary)', fontWeight:500 }}>Display Name</label>
                <input className="input" defaultValue={user.displayName ?? ''} readOnly style={{ background:'rgba(255,255,255,0.03)', cursor:'not-allowed' }}/>
              </div>
              <div>
                <label style={{ marginBottom:8, fontSize:13, color:'var(--text-secondary)', fontWeight:500, display:'flex', alignItems:'center', gap:6 }}><Mail size={13}/> Email</label>
                <input className="input" defaultValue={user.email} readOnly style={{ background:'rgba(255,255,255,0.03)', cursor:'not-allowed' }}/>
              </div>
            </div>
          </div>

          {/* Storage card */}
          <div className="glass" style={{ padding:24 }}>
            <h2 style={{ fontSize:16, fontWeight:700, marginBottom:20, display:'flex', alignItems:'center', gap:8 }}><HardDrive size={16}/> Storage</h2>
            <div style={{ marginBottom:12, display:'flex', justifyContent:'space-between', fontSize:14 }}>
              <span style={{ color:'var(--text-secondary)' }}>Used</span>
              <span style={{ fontWeight:700 }}>{formatBytes(user.storageUsed)} <span style={{ color:'var(--text-muted)', fontWeight:400 }}>/ {formatBytes(user.storageQuota)}</span></span>
            </div>
            <div style={{ height:8, background:'var(--border)', borderRadius:99, overflow:'hidden', marginBottom:8 }}>
              <motion.div initial={{ width:0 }} animate={{ width:`${pct}%` }} transition={{ duration:1 }}
                style={{ height:'100%', background: pct > 90 ? '#ef4444' : 'linear-gradient(90deg,#7c3aed,#06b6d4)', borderRadius:99 }} />
            </div>
            <p style={{ fontSize:12, color:'var(--text-muted)' }}>{pct}% of storage used</p>
          </div>

          {/* Connected accounts */}
          <div className="glass" style={{ padding:24 }}>
            <h2 style={{ fontSize:16, fontWeight:700, marginBottom:20, display:'flex', alignItems:'center', gap:8 }}><Shield size={16}/> Connected Accounts</h2>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {['google', 'github'].map(provider => {
                const linked = user.oauthAccounts?.some((o: any) => o.provider === provider);
                return (
                  <div key={provider} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', background:'var(--bg-card)', borderRadius:8, border:'1px solid var(--border)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <span style={{ textTransform:'capitalize', fontSize:14, fontWeight:500 }}>{provider}</span>
                    </div>
                    <span className={`badge ${linked ? 'badge-success' : 'badge-warning'}`}>{linked ? 'Connected' : 'Not connected'}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Account info */}
          <div className="glass" style={{ padding:24 }}>
            <h2 style={{ fontSize:16, fontWeight:700, marginBottom:20, display:'flex', alignItems:'center', gap:8 }}><Key size={16}/> Account Info</h2>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              <div style={{ padding:16, background:'var(--bg-card)', borderRadius:8, border:'1px solid var(--border)' }}>
                <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:4 }}>User ID</div>
                <div style={{ fontSize:13, fontFamily:'monospace', color:'var(--text-secondary)', overflow:'hidden', textOverflow:'ellipsis' }}>{user.id}</div>
              </div>
              <div style={{ padding:16, background:'var(--bg-card)', borderRadius:8, border:'1px solid var(--border)' }}>
                <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:4 }}>Member Since</div>
                <div style={{ fontSize:13, color:'var(--text-secondary)' }}>{new Date(user.createdAt).toLocaleDateString()}</div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
