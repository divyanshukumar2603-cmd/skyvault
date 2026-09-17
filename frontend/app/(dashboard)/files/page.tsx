'use client';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Search, Download, Trash2, History, MoreHorizontal, FolderOpen, RefreshCw, X, CheckCircle, AlertCircle } from 'lucide-react';
import { filesApi } from '@/lib/api';
import { formatBytes, formatDate, getMimeIcon, validateFileSize } from '@/lib/utils';
import Link from 'next/link';

function Toast({ message, type, onClose }: { message: string; type: 'success'|'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  return (
    <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:20 }}
      className="toast"
      style={{ background: type==='success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', borderColor: type==='success' ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)', color: type==='success' ? '#34d399' : '#f87171', display:'flex', alignItems:'center', gap:10 }}>
      {type==='success' ? <CheckCircle size={16}/> : <AlertCircle size={16}/>}
      {message}
      <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'inherit', marginLeft:'auto' }}><X size={14}/></button>
    </motion.div>
  );
}

function StorageBar({ used, quota }: { used: string; quota: string }) {
  const pct = Math.min(100, Math.round((Number(used) / Number(quota)) * 100));
  const color = pct > 90 ? '#ef4444' : pct > 70 ? '#f59e0b' : '#7c3aed';
  return (
    <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8, fontSize:13 }}>
        <span style={{ color:'var(--text-secondary)' }}>Storage Used</span>
        <span style={{ color:'var(--text-primary)', fontWeight:600 }}>{formatBytes(used)} <span style={{ color:'var(--text-muted)' }}>/ {formatBytes(quota)}</span></span>
      </div>
      <div style={{ height:6, background:'var(--border)', borderRadius:99, overflow:'hidden' }}>
        <motion.div initial={{ width:0 }} animate={{ width:`${pct}%` }} transition={{ duration:1, ease:'easeOut' }}
          style={{ height:'100%', background:`linear-gradient(90deg, ${color}, ${color}cc)`, borderRadius:99 }} />
      </div>
    </div>
  );
}

function UploadModal({ onClose, onUploaded }: { onClose: () => void; onUploaded: () => void }) {
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState<{file: File; progress: number; status: 'pending'|'uploading'|'done'|'error'; error?: string}[]>([]);
  const [uploading, setUploading] = useState(false);

  function addFiles(fileList: FileList) {
    const arr = Array.from(fileList).map(f => {
      const err = validateFileSize(f);
      return { file: f, progress: 0, status: err ? 'error' as const : 'pending' as const, error: err ?? undefined };
    });
    setFiles(p => [...p, ...arr]);
  }

  async function uploadAll() {
    setUploading(true);
    for (let i = 0; i < files.length; i++) {
      const item = files[i];
      if (item.status !== 'pending') continue;
      setFiles(p => p.map((f, j) => j === i ? { ...f, status: 'uploading' } : f));
      try {
        const filePath = item.file.name;
        const urlRes = await filesApi.getUploadUrl({ fileName: item.file.name, filePath, mimeType: item.file.type || 'application/octet-stream', sizeBytes: item.file.size });
        const { uploadUrl, s3Key } = urlRes.data;

        // Direct upload to S3/MinIO
        await fetch(uploadUrl, { method: 'PUT', body: item.file, headers: { 'Content-Type': item.file.type || 'application/octet-stream' } });
        await filesApi.confirmUpload({ s3Key, fileName: item.file.name, filePath, mimeType: item.file.type || 'application/octet-stream', sizeBytes: item.file.size });

        setFiles(p => p.map((f, j) => j === i ? { ...f, status: 'done', progress: 100 } : f));
      } catch (err: any) {
        setFiles(p => p.map((f, j) => j === i ? { ...f, status: 'error', error: err.message } : f));
      }
    }
    setUploading(false);
    onUploaded();
  }

  const allDone = files.length > 0 && files.every(f => f.status === 'done' || f.status === 'error');

  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:20, backdropFilter:'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ scale:0.95, opacity:0 }} animate={{ scale:1, opacity:1 }} exit={{ scale:0.95, opacity:0 }}
        className="glass" style={{ width:'100%', maxWidth:560, maxHeight:'80vh', overflow:'hidden', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'20px 24px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h2 style={{ fontSize:18, fontWeight:700 }}>Upload Files</h2>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding:'6px 8px' }}><X size={18}/></button>
        </div>

        <div style={{ padding:24, overflow:'auto', flex:1 }}>
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
            style={{
              border:`2px dashed ${dragging ? 'var(--accent-violet)' : 'var(--border)'}`,
              borderRadius:12, padding:'32px 24px', textAlign:'center', cursor:'pointer',
              background: dragging ? 'rgba(124,58,237,0.08)' : 'transparent',
              transition:'all 0.2s', marginBottom: files.length ? 20 : 0,
            }}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <Upload size={36} style={{ color: dragging ? 'var(--accent-violet)' : 'var(--text-muted)', margin:'0 auto 12px' }} />
            <p style={{ color:'var(--text-secondary)', marginBottom:6 }}>Drop files here or <span style={{ color:'#a78bfa', cursor:'pointer' }}>browse</span></p>
            <p style={{ color:'var(--text-muted)', fontSize:12 }}>Max 5 GB per file</p>
            <input id="file-input" type="file" multiple style={{ display:'none' }} onChange={e => e.target.files && addFiles(e.target.files)} />
          </div>

          {/* File list */}
          {files.map((item, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
              <span style={{ fontSize:20 }}>{getMimeIcon(item.file.type)}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.file.name}</div>
                <div style={{ fontSize:11, color:'var(--text-muted)' }}>{formatBytes(item.file.size)}</div>
                {item.status === 'error' && <div style={{ fontSize:11, color:'#f87171', marginTop:2 }}>{item.error}</div>}
              </div>
              <div style={{ flexShrink:0 }}>
                {item.status === 'done' && <CheckCircle size={18} color="#10b981"/>}
                {item.status === 'uploading' && <div className="spinner" style={{ width:18, height:18 }} />}
                {item.status === 'error' && <AlertCircle size={18} color="#ef4444"/>}
                {item.status === 'pending' && <div style={{ width:18, height:18, borderRadius:'50%', border:'2px solid var(--border)' }} />}
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding:'16px 24px', borderTop:'1px solid var(--border)', display:'flex', gap:12, justifyContent:'flex-end' }}>
          {allDone ? (
            <button onClick={onClose} className="btn btn-primary">Done</button>
          ) : (
            <>
              <button onClick={onClose} className="btn btn-secondary">Cancel</button>
              <button onClick={uploadAll} disabled={uploading || files.length === 0} className="btn btn-primary">
                {uploading ? <><div className="spinner" style={{ width:16, height:16 }} /> Uploading…</> : `Upload ${files.length} file${files.length !== 1 ? 's' : ''}`}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function FilesPage() {
  const [data, setData] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [toast, setToast] = useState<{message:string; type:'success'|'error'} | null>(null);

  const showToast = (message: string, type: 'success'|'error') => setToast({ message, type });

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const [filesRes, statsRes] = await Promise.all([filesApi.list(), filesApi.stats()]);
      setData(filesRes.data);
      setStats(statsRes.data);
    } catch (err: any) { showToast(err.message, 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const filtered = data?.files?.filter((f: any) =>
    f.fileName.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Move "${name}" to trash?`)) return;
    try { await filesApi.softDelete(id); showToast('Moved to trash', 'success'); loadFiles(); }
    catch (err: any) { showToast(err.message, 'error'); }
  }

  return (
    <div style={{ padding:0, minHeight:'100vh' }}>
      {/* Header */}
      <div style={{ padding:'24px 32px 0', borderBottom:'1px solid var(--border)', background:'rgba(10,10,20,0.5)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div>
            <h1 style={{ fontSize:24, fontWeight:800, marginBottom:4 }}>My Files</h1>
            <p style={{ color:'var(--text-secondary)', fontSize:14 }}>{data?.total ?? 0} files stored</p>
          </div>
          <div style={{ display:'flex', gap:12 }}>
            <button onClick={loadFiles} className="btn btn-secondary"><RefreshCw size={16}/> Refresh</button>
            <button onClick={() => setShowUpload(true)} className="btn btn-primary"><Upload size={16}/> Upload</button>
          </div>
        </div>
        {stats && <StorageBar used={stats.storageUsed} quota={stats.storageQuota} />}
      </div>

      {/* Search */}
      <div style={{ padding:'20px 32px', borderBottom:'1px solid var(--border)' }}>
        <div style={{ position:'relative', maxWidth:400 }}>
          <Search size={16} style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }} />
          <input className="input" style={{ paddingLeft:42 }} placeholder="Search files…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* File table */}
      <div style={{ padding:'0 32px 32px' }}>
        {loading ? (
          <div style={{ padding:60, textAlign:'center' }}>
            <div className="spinner" style={{ width:36, height:36, margin:'0 auto' }} />
          </div>
        ) : filtered.length === 0 ? (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} style={{ padding:80, textAlign:'center' }}>
            <FolderOpen size={60} style={{ color:'var(--text-muted)', margin:'0 auto 16px' }} />
            <h3 style={{ color:'var(--text-secondary)', marginBottom:8 }}>No files yet</h3>
            <p style={{ color:'var(--text-muted)', fontSize:14, marginBottom:24 }}>Upload your first file to get started</p>
            <button onClick={() => setShowUpload(true)} className="btn btn-primary"><Upload size={16}/> Upload a file</button>
          </motion.div>
        ) : (
          <>
            {/* Table header */}
            <div className="table-row" style={{ gridTemplateColumns:'2fr 1fr 1fr 100px', padding:'10px 20px', borderRadius:0, borderBottom:'2px solid var(--border)' }}>
              <span style={{ fontSize:12, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>Name</span>
              <span style={{ fontSize:12, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>Size</span>
              <span style={{ fontSize:12, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>Modified</span>
              <span style={{ fontSize:12, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>Actions</span>
            </div>
            <AnimatePresence>
              {filtered.map((file: any, i: number) => (
                <motion.div key={file.id} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }} transition={{ delay: i * 0.03 }}
                  className="table-row" style={{ gridTemplateColumns:'2fr 1fr 1fr 100px', borderRadius: i === filtered.length-1 ? '0 0 12px 12px' : 0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12, minWidth:0 }}>
                    <span style={{ fontSize:22, flexShrink:0 }}>{getMimeIcon(file.mimeType)}</span>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontWeight:600, fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{file.fileName}</div>
                      <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                        <span className="badge badge-violet" style={{ padding:'1px 8px', fontSize:10 }}>v{file.currentVersion}</span>
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize:13, color:'var(--text-secondary)' }}>{formatBytes(file.sizeBytes)}</span>
                  <span style={{ fontSize:13, color:'var(--text-secondary)' }}>{formatDate(file.updatedAt)}</span>
                  <div style={{ display:'flex', gap:4 }}>
                    <Link href={`/files/${file.id}`} title="Version history">
                      <button className="btn btn-ghost" style={{ padding:'6px 8px' }}><History size={15}/></button>
                    </Link>
                    <button className="btn btn-ghost" title="Delete" style={{ padding:'6px 8px' }} onClick={() => handleDelete(file.id, file.fileName)}>
                      <Trash2 size={15} style={{ color:'var(--text-muted)' }}/>
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* Upload modal */}
      <AnimatePresence>
        {showUpload && <UploadModal onClose={() => setShowUpload(false)} onUploaded={() => { setShowUpload(false); loadFiles(); }} />}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>
    </div>
  );
}
