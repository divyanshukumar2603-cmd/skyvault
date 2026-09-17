'use client';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, Play, RotateCcw, Clock, CheckCircle, AlertCircle, X, RefreshCw, Shield } from 'lucide-react';
import { backupsApi, replicationApi } from '@/lib/api';
import { formatBytes, formatDate } from '@/lib/utils';

function Toast({ message, type, onClose }: { message: string; type: 'success'|'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  return (
    <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
      className="toast"
      style={{ background: type==='success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', borderColor: type==='success' ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)', color: type==='success' ? '#34d399' : '#f87171', display:'flex', alignItems:'center', gap:10 }}>
      {type==='success' ? <CheckCircle size={16}/> : <AlertCircle size={16}/>}
      {message}
      <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'inherit', marginLeft:'auto' }}><X size={14}/></button>
    </motion.div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    COMPLETED: 'badge-success', FAILED: 'badge-danger',
    IN_PROGRESS: 'badge-warning', PENDING: 'badge-warning',
  };
  return <span className={`badge ${map[status] ?? 'badge-violet'}`}>{status}</span>;
}

export default function BackupsPage() {
  const [backups, setBackups] = useState<any[]>([]);
  const [replication, setReplication] = useState<any>(null);
  const [schedule, setSchedule] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [triggeringBackup, setTriggeringBackup] = useState(false);
  const [triggeringRepl, setTriggeringRepl] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success'|'error' } | null>(null);

  const showToast = (message: string, type: 'success'|'error') => setToast({ message, type });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [backupsRes, replRes, schedRes] = await Promise.all([
        backupsApi.list(), replicationApi.status(), backupsApi.getSchedule(),
      ]);
      setBackups(backupsRes.data.records);
      setReplication(replRes.data);
      setSchedule(schedRes.data);
    } catch (err: any) { showToast(err.message, 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function triggerBackup() {
    setTriggeringBackup(true);
    try { await backupsApi.trigger(); showToast('Backup started in background', 'success'); setTimeout(load, 2000); }
    catch (err: any) { showToast(err.message, 'error'); }
    finally { setTriggeringBackup(false); }
  }

  async function triggerReplication() {
    setTriggeringRepl(true);
    try { await replicationApi.trigger(); showToast('Replication sync started', 'success'); setTimeout(load, 3000); }
    catch (err: any) { showToast(err.message, 'error'); }
    finally { setTriggeringRepl(false); }
  }

  async function handleRestore(id: string) {
    if (!confirm('Restore files from this backup? This will overwrite current versions.')) return;
    try { await backupsApi.restore(id); showToast('Restore complete', 'success'); }
    catch (err: any) { showToast(err.message, 'error'); }
  }

  return (
    <div style={{ padding:32, minHeight:'100vh' }}>
      <div style={{ marginBottom:32 }}>
        <h1 style={{ fontSize:24, fontWeight:800, marginBottom:4 }}>Backups & Replication</h1>
        <p style={{ color:'var(--text-secondary)', fontSize:14 }}>Manage your backup snapshots and cross-region replication</p>
      </div>

      {/* Stats cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))', gap:16, marginBottom:32 }}>
        {/* Backup schedule */}
        <div className="glass" style={{ padding:24 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
            <div style={{ width:40, height:40, borderRadius:10, background:'rgba(124,58,237,0.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Clock size={20} color="#a78bfa"/>
            </div>
            <div>
              <div style={{ fontSize:13, color:'var(--text-muted)' }}>Backup Schedule</div>
              <div style={{ fontSize:15, fontWeight:700 }}>{schedule?.description ?? 'Daily at midnight UTC'}</div>
            </div>
          </div>
          <button onClick={triggerBackup} disabled={triggeringBackup} className="btn btn-primary" style={{ width:'100%', justifyContent:'center' }}>
            {triggeringBackup ? <div className="spinner" style={{ width:16, height:16 }}/> : <Play size={16}/>}
            {triggeringBackup ? 'Starting…' : 'Run Backup Now'}
          </button>
        </div>

        {/* Replication */}
        <div className="glass" style={{ padding:24 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
            <div style={{ width:40, height:40, borderRadius:10, background:'rgba(6,182,212,0.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Shield size={20} color="#22d3ee"/>
            </div>
            <div>
              <div style={{ fontSize:13, color:'var(--text-muted)' }}>Replication</div>
              <div style={{ fontSize:15, fontWeight:700 }}>{replication?.mode ?? 'Loading…'}</div>
              {replication?.lastSyncTime && (
                <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>Last sync: {formatDate(replication.lastSyncTime)}</div>
              )}
            </div>
          </div>
          <button onClick={triggerReplication} disabled={triggeringRepl || replication?.syncInProgress} className="btn btn-secondary" style={{ width:'100%', justifyContent:'center' }}>
            {triggeringRepl ? <div className="spinner" style={{ width:16, height:16 }}/> : <RefreshCw size={16}/>}
            {triggeringRepl || replication?.syncInProgress ? 'Syncing…' : 'Sync Now'}
          </button>
        </div>
      </div>

      {/* Backup history */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h2 style={{ fontSize:18, fontWeight:700 }}>Backup History</h2>
        <button onClick={load} className="btn btn-ghost"><RefreshCw size={16}/> Refresh</button>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:60 }}><div className="spinner" style={{ width:32, height:32, margin:'0 auto' }}/></div>
      ) : backups.length === 0 ? (
        <div className="glass" style={{ padding:60, textAlign:'center' }}>
          <Database size={48} style={{ color:'var(--text-muted)', margin:'0 auto 16px' }}/>
          <p style={{ color:'var(--text-secondary)' }}>No backups yet. Run your first backup above.</p>
        </div>
      ) : (
        <div className="glass" style={{ overflow:'hidden' }}>
          <div className="table-row" style={{ gridTemplateColumns:'1.5fr 1fr 1fr 1fr 120px', padding:'10px 20px', borderRadius:0 }}>
            {['Date', 'Status', 'Files', 'Size', 'Actions'].map(h => (
              <span key={h} style={{ fontSize:12, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>{h}</span>
            ))}
          </div>
          <AnimatePresence>
            {backups.map((b: any, i: number) => (
              <motion.div key={b.id} initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay: i * 0.04 }}
                className="table-row" style={{ gridTemplateColumns:'1.5fr 1fr 1fr 1fr 120px' }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600 }}>{formatDate(b.startedAt)}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)' }}>{b.triggeredBy}</div>
                </div>
                <StatusBadge status={b.status}/>
                <span style={{ fontSize:13, color:'var(--text-secondary)' }}>{b.fileCount} files</span>
                <span style={{ fontSize:13, color:'var(--text-secondary)' }}>{b.sizeBytes ? formatBytes(b.sizeBytes) : '—'}</span>
                <div style={{ display:'flex', gap:6 }}>
                  {b.status === 'COMPLETED' && (
                    <button className="btn btn-secondary" style={{ padding:'6px 12px', fontSize:12 }} onClick={() => handleRestore(b.id)}>
                      <RotateCcw size={13}/> Restore
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>
    </div>
  );
}
