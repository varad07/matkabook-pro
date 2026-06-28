import { useState, useEffect, useRef, useCallback } from 'react';
import socket from '../../utils/socket';
import BossLayout from '../../components/BossLayout';
import api from '../../utils/api';
import { formatAmount, formatTime, todayISO, formatPana } from '../../utils/format';

const PAGE_SIZE = 50;

function EditModal({ item, onClose, onSaved }) {
  const [amount, setAmount] = useState(item?.amount || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  async function handleSave() {
    setSaving(true); setErr('');
    try {
      await api.put(`/entries/items/${item.item_id}/edit`, { amount: parseFloat(amount) });
      onSaved();
      onClose();
    } catch (e) {
      setErr(e.response?.data?.error || 'Save failed');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="bg-card border border-gold/30 rounded-2xl w-full max-w-sm p-6">
        <h3 className="text-gold font-bold mb-4">Edit Entry</h3>
        <p className="text-gray-400 text-sm mb-4">
          {item?.bet_type} — <span className="font-mono text-white">{item?.number}</span>
        </p>
        {err && <p className="text-red-400 text-sm mb-3">{err}</p>}
        <label className="block text-gray-400 text-xs mb-1 uppercase">Amount</label>
        <input
          type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
          className="w-full bg-midcard border border-gold/20 text-white rounded-lg px-3 py-2 mb-4 text-sm focus:border-gold focus:outline-none"
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-300 text-sm">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2 rounded-lg bg-gold text-black font-bold text-sm disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Entries() {
  const [entries,   setEntries]   = useState([]);
  const [markets,   setMarkets]   = useState([]);
  const [brokers,   setBrokers]   = useState([]);
  const [filters,   setFilters]   = useState({ market_id: '', date: todayISO(), broker_id: '', bet_type: '' });
  const [page,      setPage]      = useState(1);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [editItem,  setEditItem]  = useState(null);
  const [cancelId,  setCancelId]  = useState(null);
  const [cancelling,setCancelling]= useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.market_id) params.market_id = filters.market_id;
      if (filters.date)      params.date       = filters.date;
      if (filters.broker_id) params.broker_id  = filters.broker_id;
      if (filters.bet_type)  params.bet_type   = filters.bet_type;
      const { data } = await api.get('/entries/all', { params });
      // dedupe by item_id
      const seen = new Set(); const deduped = [];
      for (const r of data) { if (!seen.has(r.item_id)) { seen.add(r.item_id); deduped.push(r); } }
      setEntries(deduped);
      setError('');
    } catch { setError('Failed to load entries'); }
    finally { setLoading(false); }
  }, [filters]);

  const fetchRef = useRef(fetchAll);
  fetchRef.current = fetchAll;

  useEffect(() => { fetchAll(); setPage(1); }, [fetchAll]);
  useEffect(() => {
    api.get('/markets').then(({ data }) => setMarkets(data)).catch(() => {});
    api.get('/brokers').then(({ data }) => setBrokers(data)).catch(() => {});
  }, []);

  useEffect(() => {
    function onNewEntry() { fetchRef.current(); }
    socket.on('new_entry', onNewEntry);
    return () => socket.off('new_entry', onNewEntry);
  }, []);

  async function handleCancel() {
    setCancelling(true);
    try {
      await api.put(`/entries/${cancelId}/cancel`);
      setCancelId(null);
      fetchAll();
    } catch (e) { alert(e.response?.data?.error || 'Cancel failed'); }
    finally { setCancelling(false); }
  }

  const totalPages = Math.ceil(entries.length / PAGE_SIZE);
  const paged = entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function setFilter(k, v) { setFilters((f) => ({ ...f, [k]: v })); }

  return (
    <BossLayout>
      <h1 className="text-xl font-bold text-gold mb-4">Entries</h1>

      {/* Filters */}
      <div className="bg-card border border-gold/10 rounded-xl p-4 mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <select value={filters.market_id} onChange={(e) => setFilter('market_id', e.target.value)}
          className="bg-midcard border border-gold/20 text-white rounded-lg px-3 py-2 text-sm focus:border-gold focus:outline-none">
          <option value="">All Markets</option>
          {markets.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <input type="date" value={filters.date} onChange={(e) => setFilter('date', e.target.value)}
          className="bg-midcard border border-gold/20 text-white rounded-lg px-3 py-2 text-sm focus:border-gold focus:outline-none" />
        <select value={filters.broker_id} onChange={(e) => setFilter('broker_id', e.target.value)}
          className="bg-midcard border border-gold/20 text-white rounded-lg px-3 py-2 text-sm focus:border-gold focus:outline-none">
          <option value="">All Brokers</option>
          {brokers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={filters.bet_type} onChange={(e) => setFilter('bet_type', e.target.value)}
          className="bg-midcard border border-gold/20 text-white rounded-lg px-3 py-2 text-sm focus:border-gold focus:outline-none">
          <option value="">All Types</option>
          {['single_ank','jodi','single_pana','double_pana','triple_pana'].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {error && <div className="bg-red-900/30 border border-red-500/40 text-red-300 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-20 text-gold">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="text-center text-gray-500 py-20">No entries found</div>
      ) : (
        <>
          <div className="bg-card border border-gold/10 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-midcard">
                  <tr>
                    {['Token','Broker','Market','Type','Number','Amount','Time','Actions'].map((h) => (
                      <th key={h} className="text-gold text-left px-3 py-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paged.map((row, i) => {
                    const cancelled = row.status === 'cancelled';
                    return (
                      <tr key={row.item_id} className={`border-t border-gold/5 ${i % 2 === 0 ? 'bg-dark/30' : ''} ${cancelled ? 'opacity-50' : ''}`}>
                        <td className={`px-3 py-2 font-mono text-xs ${cancelled ? 'line-through text-gray-500' : 'text-blue-400'}`}>{row.token}</td>
                        <td className="px-3 py-2 text-white whitespace-nowrap">{row.broker_name}</td>
                        <td className="px-3 py-2 text-gray-300 whitespace-nowrap">{row.market_code}</td>
                        <td className="px-3 py-2 text-gray-300 whitespace-nowrap">{row.bet_type}</td>
                        <td className="px-3 py-2 font-mono font-bold text-white">{formatPana(row.number)}</td>
                        <td className="px-3 py-2 text-green-400 whitespace-nowrap">{formatAmount(row.amount)}</td>
                        <td className="px-3 py-2 text-gray-400 whitespace-nowrap text-xs">{formatTime(row.entry_date)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {!cancelled && (
                            <div className="flex gap-1">
                              <button onClick={() => setEditItem(row)}
                                className="bg-blue-900/50 text-blue-300 border border-blue-700/40 px-2 py-1 rounded text-xs hover:bg-blue-800/50">
                                Edit
                              </button>
                              <button onClick={() => setCancelId(row.batch_id)}
                                className="bg-red-900/50 text-red-300 border border-red-700/40 px-2 py-1 rounded text-xs hover:bg-red-800/50">
                                Cancel
                              </button>
                            </div>
                          )}
                          {cancelled && <span className="text-red-400 text-xs font-bold">CANCELLED</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-4">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1 rounded bg-card border border-gold/20 text-gray-300 disabled:opacity-40 text-sm">← Prev</button>
              <span className="text-gray-400 text-sm">Page {page} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1 rounded bg-card border border-gold/20 text-gray-300 disabled:opacity-40 text-sm">Next →</button>
            </div>
          )}
        </>
      )}

      {editItem && <EditModal item={editItem} onClose={() => setEditItem(null)} onSaved={fetchAll} />}

      {cancelId && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-card border border-gold/30 rounded-2xl w-full max-w-sm p-6 text-center">
            <p className="text-white font-semibold mb-2">Cancel this entry batch?</p>
            <p className="text-gray-400 text-sm mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setCancelId(null)} className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-300 text-sm">No</button>
              <button onClick={handleCancel} disabled={cancelling}
                className="flex-1 py-2 rounded-lg bg-red-600 text-white font-bold text-sm disabled:opacity-50">
                {cancelling ? 'Cancelling…' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </BossLayout>
  );
}
