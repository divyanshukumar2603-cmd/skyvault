'use client';
import { useState, useEffect, use } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Download, RotateCcw, Clock, HardDrive, Hash, CheckCircle, AlertCircle, X } from 'lucide-react';
import { versionsApi } from '@/lib/api';
import { formatBytes, formatDate, getMimeIcon } from '@/lib/utils';

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

export default function VersionHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success'|'error' } | null>(null);

  const showToast = (message: string, type: 'success'|'error') => setToast({ message, type });

  useEffect(() => {
    versionsApi.list(id).then(r => setData(r.data)).catch(err => showToast(err.message, 'error')).finally(() => setLoading(false));
  }, [id]);

  async function handleDownload(versionId: string) {
    try {
      const res = await versionsApi.download(id, versionId);
      window.open(res.data.downloadUrl, '_blank');
    } catch (err: any) { showToast(err.message, 'error'); }
  }

  async function handleRestore(versionId: string, versionNumber: number) {
    if (!confirm(`Restore version V${versionNumber}? This will create a new version with this content.`)) return;
    setRestoring(versionId);
    try {
      await versionsApi.restore(id, versionId);
      showToast(`Restored to V${versionNumber} — a new version has been created`, 'success');
      const res = await versionsApi.list(id);
      setData(res.data);
    } catch (err: any) { showToast(err.message, 'error'); }
    finally { setRestoring(null); }
  }

  return (
    <div style={{ padding:32, minHeight:'100vh' }}>
      <button onClick={() => router.back()} className="btn btn-ghost" style={{ marginBottom:24, paddingLeft:8 }}>
        <ArrowLeft size={16}/> Back to Files
      </button>

      {loading ? (
        <div style={{ textAlign:'center', padding:80 }}><div className="spinner" style={{ width:36, height:36, margin:'0 auto' }}/></div>
      ) : !data ? (
        <div style={{ textAlign:'center', padding:80, color:'var(--text-secondary)' }}>File not found</div>
      ) : (
        <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}>
          {/* File header */}
          <div className="glass" style={{ padding:24, marginBottom:24, display:'flex', alignItems:'center', gap:20 }}>
            <span style={{ fontSize:48 }}>{getMimeIcon(data.file.mimeType)}</span>
            <div>
              <h1 style={{ fontSize:22, fontWeight:800, marginBottom:6 }}>{data.file.fileName}</h1>
              <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
                <span style={{ display:'flex', alignItems:'center', gap:6, color:'var(--text-secondary)', fontSize:13 }}>
                  <HardDrive size={14}/> {formatBytes(data.file.sizeBytes)}
                </span>
                <span style={{ display:'flex', alignItems:'center', gap:6, color:'var(--text-secondary)', fontSize:13 }}>
                  <Clock size={14}/> {formatDate(data.file.updatedAt)}
                </span>
                <span className="badge badge-violet">Current: V{data.file.currentVersion}</span>
              </div>
            </div>
          </div>

          {/* Version timeline */}
          <h2 style={{ fontSize:16, fontWeight:700, marginBottom:16, color:'var(--text-secondary)' }}>Version History ({data.versions.length})</h2>
          <div style={{ position:'relative' }}>
            {/* Timeline line */}
            <div style={{ position:'absolute', left:20, top:0, bottom:0, width:2, background:'var(--border)' }} />
            <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
              {data.versions.map((v: any, i: number) => {
                const isCurrent = v.versionNumber === data.file.currentVersion;
                return (
                  <motion.div key={v.id} initial={{ opacity:0, x:-10 }} animate={{ opacity:1, x:0 }} transition={{ delay: i * 0.05 }}
                    style={{ display:'flex', gap:24, paddingLeft:52, paddingBottom:24, position:'relative' }}>
                    {/* Dot */}
                    <div style={{
                      position:'absolute', left:12, top:4, width:18, height:18, borderRadius:'50%',
                      background: isCurrent ? 'linear-gradient(135deg,#7c3aed,#06b6d4)' : 'var(--bg-secondary)',
                      border: `2px solid ${isCurrent ? '#7c3aed' : 'var(--border)'}`,
                      zIndex:1, display:'flex', alignItems:'center', justifyContent:'center',
                    }}>
                      {isCurrent && <div style={{ width:6, height:6, borderRadius:'50%', background:'white' }} />}
                    </div>

                    <div className="glass" style={{ flex:1, padding:'16px 20px' }}>
                      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>
                        <div>
                          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                            <span style={{ fontSize:16, fontWeight:700 }}>V{v.versionNumber}</span>
                            {isCurrent && <span className="badge badge-violet">Current</span>}
                          </div>
                          <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
                            <span style={{ display:'flex', alignItems:'center', gap:6, color:'var(--text-secondary)', fontSize:12 }}>
                              <HardDrive size={12}/> {formatBytes(v.sizeBytes)}
                            </span>
                            <span style={{ display:'flex', alignItems:'center', gap:6, color:'var(--text-secondary)', fontSize:12 }}>
                              <Clock size={12}/> {formatDate(v.uploadedAt)}
                            </span>
                            {v.checksum && (
                              <span style={{ display:'flex', alignItems:'center', gap:6, color:'var(--text-muted)', fontSize:11, fontFamily:'monospace' }}>
                                <Hash size={11}/> {v.checksum.slice(0,12)}…
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                          <button className="btn btn-secondary" style={{ padding:'8px 14px', fontSize:13 }} onClick={() => handleDownload(v.id)}>
                            <Download size={14}/> Download
                          </button>
                          {!isCurrent && (
                            <button className="btn btn-primary" style={{ padding:'8px 14px', fontSize:13 }}
                              disabled={restoring === v.id}
                              onClick={() => handleRestore(v.id, v.versionNumber)}>
                              {restoring === v.id ? <div className="spinner" style={{ width:14, height:14 }}/> : <RotateCcw size={14}/>}
                              Restore
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>
    </div>
  );
}
