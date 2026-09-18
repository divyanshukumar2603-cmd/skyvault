'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Files, Database, Settings, LogOut, Shield, ChevronLeft, ChevronRight, RefreshCw, Sparkles, BarChart3 } from 'lucide-react';
import { authApi, setAccessToken, getAccessToken, tryRefresh } from '@/lib/api';
import { logout } from '@/lib/auth';

const NAV = [
  { href: '/files',    icon: Files,      label: 'Files' },
  { href: '/shop',     icon: Sparkles,   label: 'Shop' },
  { href: '/analytics',icon: BarChart3,  label: 'Analytics' },
  { href: '/backups',  icon: Database,   label: 'Backups' },
  { href: '/settings', icon: Settings,   label: 'Settings' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        // Try to refresh token first if no access token
        if (!getAccessToken()) {
          const refreshed = await tryRefresh();
          if (!refreshed) { router.replace('/login'); return; }
        }
        const me = await authApi.me();
        setUser(me.data);
      } catch {
        router.replace('/login');
      } finally { setChecking(false); }
    }
    init();
  }, [router]);

  if (checking) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh' }}>
        <div className="spinner" style={{ width:40, height:40 }} />
      </div>
    );
  }

  const sidebarW = collapsed ? 72 : 240;

  return (
    <div style={{ display:'flex', minHeight:'100vh' }}>
      {/* Sidebar */}
      <motion.nav
        animate={{ width: sidebarW }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        style={{
          position:'fixed', top:0, left:0, bottom:0, zIndex:50,
          background:'rgba(10,10,20,0.9)',
          borderRight:'1px solid var(--border)',
          backdropFilter:'blur(20px)',
          display:'flex', flexDirection:'column',
          overflow:'hidden', flexShrink:0,
        }}
      >
        {/* Logo */}
        <div style={{ padding: collapsed ? '20px 0' : '20px 20px', display:'flex', alignItems:'center', gap:12, height:72, borderBottom:'1px solid var(--border)' }}>
          <div style={{ width:36, height:36, background:'linear-gradient(135deg,#7c3aed,#06b6d4)', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, margin: collapsed ? 'auto' : 0 }}>
            <Shield size={18} color="white" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} className="gradient-text" style={{ fontWeight:800, fontSize:18, whiteSpace:'nowrap' }}>
                CloudVault
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Nav links */}
        <div style={{ flex:1, padding:'16px 8px', display:'flex', flexDirection:'column', gap:4 }}>
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link key={href} href={href} style={{ textDecoration:'none' }}>
                <div style={{
                  display:'flex', alignItems:'center', gap:12,
                  padding: collapsed ? '10px 0' : '10px 14px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  borderRadius:8, cursor:'pointer', transition:'all 0.15s',
                  background: active ? 'rgba(124,58,237,0.15)' : 'transparent',
                  color: active ? '#a78bfa' : 'var(--text-secondary)',
                  border: active ? '1px solid rgba(124,58,237,0.3)' : '1px solid transparent',
                }}>
                  <Icon size={18} />
                  <AnimatePresence>
                    {!collapsed && (
                      <motion.span initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} style={{ fontSize:14, fontWeight:500, whiteSpace:'nowrap' }}>
                        {label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </Link>
            );
          })}
        </div>

        {/* User + logout */}
        <div style={{ padding:'16px 8px', borderTop:'1px solid var(--border)' }}>
          {!collapsed && user && (
            <div style={{ padding:'10px 14px', marginBottom:8, borderRadius:8, background:'var(--bg-card)' }}>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.displayName}</div>
              <div style={{ fontSize:11, color:'var(--text-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.email}</div>
            </div>
          )}
          <button onClick={logout} style={{
            display:'flex', alignItems:'center', gap:12,
            padding: collapsed ? '10px 0' : '10px 14px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            width:'100%', borderRadius:8, cursor:'pointer', border:'none',
            background:'transparent', color:'var(--text-secondary)', transition:'all 0.15s',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color='#f87171'; (e.currentTarget as HTMLElement).style.background='rgba(239,68,68,0.1)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color='var(--text-secondary)'; (e.currentTarget as HTMLElement).style.background='transparent'; }}
          >
            <LogOut size={18} />
            {!collapsed && <span style={{ fontSize:14, fontWeight:500 }}>Sign Out</span>}
          </button>
        </div>

        {/* Collapse toggle */}
        <button onClick={() => setCollapsed(!collapsed)} style={{
          position:'absolute', top:'50%', right:-12, transform:'translateY(-50%)',
          width:24, height:24, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
          background:'var(--bg-secondary)', border:'1px solid var(--border)', cursor:'pointer', zIndex:10,
        }}>
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </motion.nav>

      {/* Main content */}
      <main style={{ flex:1, marginLeft:sidebarW, transition:'margin-left 0.25s', minHeight:'100vh', display:'flex', flexDirection:'column' }}>
        {children}
      </main>
    </div>
  );
}
