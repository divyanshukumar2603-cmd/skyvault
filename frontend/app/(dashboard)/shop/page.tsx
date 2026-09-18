'use client';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Search, Eye, ShoppingCart, CreditCard, RotateCcw,
  TrendingUp, CheckCircle, AlertCircle, X, Star, Info,
} from 'lucide-react';
import { productsApi } from '@/lib/api';

/**
 * One fixed colour per scoring signal, assigned in a stable order so a score
 * bar means the same thing on every card.
 *
 * These are the first five slots of the validated categorical palette, stepped
 * for a dark surface. The previous violet/indigo pairing failed validation
 * outright — ΔE 7.5 to normal vision and 1.3 under protanopia, i.e. two
 * segments nobody could tell apart. This set passes every check: worst
 * adjacent CVD ΔE 8.4, normal-vision ΔE 19.3, all above 3:1 on the surface.
 */
const SIGNAL_COLORS: Record<string, string> = {
  category: '#3987e5',
  brand: '#d95926',
  price: '#199e70',
  popularity: '#c98500',
  rating: '#d55181',
};

const SIGNAL_LABELS: Record<string, string> = {
  category: 'Category affinity',
  brand: 'Brand affinity',
  price: 'Price fit',
  popularity: 'Popularity',
  rating: 'Rating',
};

const CATEGORY_GRADIENTS: Record<string, string> = {
  Electronics: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
  Fashion: 'linear-gradient(135deg,#ec4899,#8b5cf6)',
  Home: 'linear-gradient(135deg,#f59e0b,#ef4444)',
  Fitness: 'linear-gradient(135deg,#10b981,#06b6d4)',
  Books: 'linear-gradient(135deg,#06b6d4,#3b82f6)',
  Audio: 'linear-gradient(135deg,#8b5cf6,#06b6d4)',
};

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="toast"
      style={{
        background: type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
        borderColor: type === 'success' ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)',
        color: type === 'success' ? '#34d399' : '#f87171',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
      {type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
      {message}
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', marginLeft: 'auto' }}>
        <X size={14} />
      </button>
    </motion.div>
  );
}

/** Stacked bar showing how each signal contributed to a product's score. */
function ScoreBar({ breakdown, score }: { breakdown: Record<string, number>; score: number }) {
  const entries = Object.entries(breakdown).filter(([, v]) => v > 0.0001);
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
        <span>relevance score</span>
        <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>{score.toFixed(3)}</span>
      </div>
      <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', background: 'rgba(255,255,255,0.06)' }}>
        {entries.map(([key, value], i) => (
          <div key={key} title={`${SIGNAL_LABELS[key]}: ${value.toFixed(3)}`}
            style={{
              width: `${value * 100}%`,
              background: SIGNAL_COLORS[key],
              marginLeft: i === 0 ? 0 : 2,
            }} />
        ))}
      </div>
    </div>
  );
}

function ProductCard({ product, onInteract, busy }: { product: any; onInteract: (id: string, type: string, rank: number) => void; busy: boolean }) {
  const [showDetail, setShowDetail] = useState(false);

  return (
    <motion.div
      layout
      layoutId={product.id}
      transition={{ type: 'spring', stiffness: 260, damping: 30 }}
      className="glass"
      style={{ borderRadius: 'var(--radius)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
    >
      {/* Rank + artwork */}
      <div style={{
        height: 96, background: CATEGORY_GRADIENTS[product.category] ?? 'var(--accent-gradient)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px',
      }}>
        <span style={{ fontSize: 28, fontWeight: 700, color: 'rgba(255,255,255,0.95)' }}>#{product.rank}</span>
        <span style={{
          fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6,
          background: 'rgba(0,0,0,0.25)', color: '#fff', padding: '4px 10px', borderRadius: 999,
        }}>{product.category}</span>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{product.name}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{product.brand}</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
          <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>
            ${product.price.toFixed(2)}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, color: 'var(--text-secondary)' }}>
            <Star size={12} fill="#f59e0b" color="#f59e0b" /> {product.rating.toFixed(1)}
            <span style={{ color: 'var(--text-muted)' }}>({product.ratingCount})</span>
          </span>
        </div>

        <div className="badge badge-violet" style={{ marginTop: 10, alignSelf: 'flex-start', fontSize: 11 }}>
          {product.reason}
        </div>

        <ScoreBar breakdown={product.breakdown} score={product.score} />

        <button
          onClick={() => setShowDetail((v) => !v)}
          style={{
            marginTop: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            color: 'var(--text-muted)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4,
          }}>
          <Info size={11} /> {showDetail ? 'hide' : 'why this rank?'}
        </button>

        <AnimatePresence>
          {showDetail && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              style={{ overflow: 'hidden' }}>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {Object.entries(product.breakdown).map(([key, value]) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: SIGNAL_COLORS[key], flexShrink: 0 }} />
                    <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{SIGNAL_LABELS[key]}</span>
                    <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                      {(value as number).toFixed(3)}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Each action is a stronger signal than the one before it. */}
        <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
          <button className="btn btn-ghost" disabled={busy} onClick={() => onInteract(product.id, 'CLICK', product.rank)}
            style={{ flex: 1, fontSize: 11, padding: '7px 8px' }} title="Record a click">
            <Eye size={12} /> View
          </button>
          <button className="btn btn-secondary" disabled={busy} onClick={() => onInteract(product.id, 'CART', product.rank)}
            style={{ flex: 1, fontSize: 11, padding: '7px 8px' }} title="Record an add-to-cart">
            <ShoppingCart size={12} /> Cart
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={() => onInteract(product.id, 'PURCHASE', product.rank)}
            style={{ flex: 1, fontSize: 11, padding: '7px 8px' }} title="Record a purchase">
            <CreditCard size={12} /> Buy
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function ShopPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [insights, setInsights] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [personalized, setPersonalized] = useState(false);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const load = useCallback(async () => {
    try {
      const [listRes, insightsRes, catRes] = await Promise.all([
        productsApi.list({ ...(category ? { category } : {}), ...(search ? { search } : {}) }),
        productsApi.insights(),
        productsApi.categories(),
      ]);
      setProducts(listRes.data.products);
      setPersonalized(listRes.data.personalized);
      setInsights(insightsRes.data);
      setCategories(catRes.data);
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [category, search]);

  useEffect(() => { load(); }, [load]);

  async function handleInteract(id: string, type: string, rank: number) {
    setBusy(true);
    try {
      // The position is sent with the signal so analytics can measure whether
      // the ranking surfaces what people actually act on.
      await productsApi.interact(id, type as any, rank);
      await load(); // re-rank immediately, so the effect of the signal is visible
      setToast({ message: `${type} recorded — ranking updated`, type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    setBusy(true);
    try {
      const res = await productsApi.resetHistory();
      await load();
      setToast({ message: `Cleared ${res.data.deleted} signals — back to cold start`, type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }}>
      <AnimatePresence>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sparkles size={22} color="var(--accent-violet)" /> Personalized Shop
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 6, fontSize: 13, maxWidth: 620 }}>
            Products ranked for you from your own browsing signals, blended with what every
            other shopper engages with. Every action below re-ranks the catalogue immediately.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={handleReset} disabled={busy} style={{ fontSize: 12 }}>
          <RotateCcw size={14} /> Reset my history
        </button>
      </div>

      {/* Personalization state */}
      <div className="glass" style={{ borderRadius: 'var(--radius)', padding: 16, marginTop: 20, display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className={`badge ${personalized ? 'badge-success' : 'badge-warning'}`}>
            {personalized ? 'Personalized' : 'Cold start'}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {personalized
              ? `Learned from ${insights?.signalCount ?? 0} of your signals`
              : 'No history yet — ranking by popularity and rating'}
          </span>
        </div>

        {insights?.topCategories?.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <TrendingUp size={13} color="var(--text-muted)" />
            <span style={{ color: 'var(--text-muted)' }}>Your taste:</span>
            {insights.topCategories.slice(0, 3).map((c: any) => (
              <span key={c.name} className="badge badge-violet" style={{ fontSize: 11 }}>
                {c.name} {(c.weight * 100).toFixed(0)}%
              </span>
            ))}
          </div>
        )}

        {insights?.preferredPrice != null && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Typical price point:{' '}
            <strong style={{ color: 'var(--text-primary)' }}>${insights.preferredPrice.toFixed(2)}</strong>
          </div>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 320 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="input" placeholder="Search products…" value={search}
            onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 34, fontSize: 13 }} />
        </div>
        <button onClick={() => setCategory('')}
          className={`badge ${category === '' ? 'badge-violet' : ''}`}
          style={{ cursor: 'pointer', border: '1px solid var(--border)', background: category === '' ? undefined : 'transparent' }}>
          All
        </button>
        {categories.map((c) => (
          <button key={c.category} onClick={() => setCategory(c.category)}
            className={`badge ${category === c.category ? 'badge-violet' : ''}`}
            style={{ cursor: 'pointer', border: '1px solid var(--border)', background: category === c.category ? undefined : 'transparent' }}>
            {c.category} <span style={{ opacity: 0.6 }}>{c.count}</span>
          </button>
        ))}
      </div>

      {/* Ranked grid */}
      {products.length === 0 ? (
        <div className="glass" style={{ borderRadius: 'var(--radius)', padding: 40, marginTop: 20, textAlign: 'center', color: 'var(--text-secondary)' }}>
          No products match that filter.
        </div>
      ) : (
        <motion.div layout
          style={{
            display: 'grid', gap: 16, marginTop: 20,
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          }}>
          <AnimatePresence>
            {products.map((p) => (
              <ProductCard key={p.id} product={p} onInteract={handleInteract} busy={busy} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <p style={{ marginTop: 24, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
        Ranking blends category affinity, brand affinity, price fit, popularity and rating.
        Signals lose half their influence every 7 days.
      </p>
    </div>
  );
}
