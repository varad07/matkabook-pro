import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../../utils/socket';
import BossLayout from '../../components/BossLayout';
import api from '../../utils/api';
import { formatAmount, formatTime, todayISO, formatNumber } from '../../utils/format';

function groupBy(rows, keyFn) {
  return rows.reduce((acc, row) => {
    const k = keyFn(row);
    if (!acc[k]) acc[k] = { key: k, rows: [], total: 0 };
    acc[k].rows.push(row);
    acc[k].total += parseFloat(row.amount || 0);
    return acc;
  }, {});
}

function SummaryTable({ title, data, betType, onRowClick }) {
  const sorted = Object.values(data).sort((a, b) => b.total - a.total);
  if (!sorted.length)
    return (
      <div className="bg-card rounded-xl border border-gold/10 p-4">
        <h3 className="text-gold font-bold mb-3">{title}</h3>
        <p className="text-gray-500 text-sm text-center py-4">No data</p>
      </div>
    );
  return (
    <div className="bg-card rounded-xl border border-gold/10 overflow-hidden">
      <h3 className="text-gold font-bold px-4 py-3 border-b border-gold/10">{title}</h3>
      <div className="overflow-auto max-h-72">
        <table className="w-full text-sm">
          <thead className="bg-midcard sticky top-0">
            <tr>
              <th className="text-gold text-left px-4 py-2">Number</th>
              <th className="text-gold text-right px-4 py-2">Total Amount</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((item, i) => (
              <tr
                key={item.key}
                onClick={() => onRowClick(item)}
                className={`cursor-pointer hover:bg-gold/10 transition-colors ${
                  i % 2 === 0 ? 'bg-dark/40' : 'bg-card'
                }`}
              >
                <td className="px-4 py-2 font-mono font-bold text-white">{formatNumber(item.key, betType)}</td>
                <td className="px-4 py-2 text-right text-green-400">{formatAmount(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function isFromFamily(notes) {
  if (!notes) return false;
  try { const n = JSON.parse(notes); return !!(n.has_family || n.entry_type); } catch { return false; }
}

function BrokerModal({ item, onClose }) {
  if (!item) return null;
  // Build broker map with hasFamily flag
  const brokerMap = {};
  item.rows.forEach(r => {
    const k = r.broker_name;
    if (!brokerMap[k]) brokerMap[k] = { key: k, total: 0, rows: [], hasFamily: false };
    brokerMap[k].total += parseFloat(r.amount || 0);
    brokerMap[k].rows.push(r);
    if (isFromFamily(r.notes)) brokerMap[k].hasFamily = true;
  });
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="bg-card border border-gold/30 rounded-2xl w-full max-w-lg">
        <div className="flex justify-between items-center px-5 py-4 border-b border-gold/10">
          <h3 className="text-gold font-bold">
            Number: <span className="font-mono">{formatNumber(item.key, item.rows[0]?.bet_type)}</span> — Broker Breakdown
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button>
        </div>
        <div className="overflow-auto max-h-96">
          <table className="w-full text-sm">
            <thead className="bg-midcard">
              <tr>
                <th className="text-gold text-left px-4 py-2">Broker</th>
                <th className="text-gold text-right px-4 py-2">Amount</th>
                <th className="text-gold text-right px-4 py-2">Entries</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(brokerMap).map((b, i) => (
                <tr key={b.key} className={i % 2 === 0 ? 'bg-dark/40' : ''}>
                  <td className="px-4 py-2 text-white">
                    {b.key}
                    {b.hasFamily && <span className="ml-1 text-xs bg-gold/20 text-gold px-1.5 py-0.5 rounded font-bold">FAM</span>}
                  </td>
                  <td className="px-4 py-2 text-right text-green-400">{formatAmount(b.total)}</td>
                  <td className="px-4 py-2 text-right text-gray-400">{b.rows.length}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-midcard">
              <tr>
                <td className="px-4 py-2 text-gold font-bold">Total</td>
                <td className="px-4 py-2 text-right text-gold font-bold">{formatAmount(item.total)}</td>
                <td className="px-4 py-2 text-right text-gray-400">{item.rows.length}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="px-5 py-4 border-t border-gold/10 text-right">
          <button onClick={onClose} className="bg-gold text-black px-5 py-2 rounded-lg font-bold text-sm">Close</button>
        </div>
      </div>
    </div>
  );
}

const PANA_TYPES = ['single_pana', 'double_pana', 'triple_pana'];

export default function Dashboard() {
  const navigate = useNavigate();
  const [entries,   setEntries]   = useState([]);
  const [markets,   setMarkets]   = useState([]);
  const [marketId,  setMarketId]  = useState('');
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [modal,     setModal]     = useState(null);
  const today = todayISO();

  const fetchEntries = useCallback(async () => {
    try {
      const params = { date: today };
      if (marketId) params.market_id = marketId;
      const { data } = await api.get('/entries/all', { params });
      setEntries(data);
      setError('');
    } catch {
      setError('Failed to load entries');
    } finally {
      setLoading(false);
    }
  }, [today, marketId]);

  useEffect(() => {
    api.get('/markets').then(({ data }) => setMarkets(data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchEntries();
  }, [fetchEntries]);

  // Keep a ref so socket handlers always call the latest fetchEntries
  // without needing to re-attach listeners when fetchEntries identity changes.
  const fetchRef = useRef(fetchEntries);
  fetchRef.current = fetchEntries;

  useEffect(() => {
    function onConnect()         { console.log('Socket connected:', socket.id); }
    function onDisconnect()      { console.log('Socket disconnected'); }
    function onNewEntry(data)    { console.log('new_entry:', data); fetchRef.current(); }
    function onCloseDeclared(d)  { console.log('close_declared:', d); fetchRef.current(); }

    socket.on('connect',       onConnect);
    socket.on('disconnect',    onDisconnect);
    socket.on('new_entry',     onNewEntry);
    socket.on('close_declared', onCloseDeclared);

    return () => {
      socket.off('connect',       onConnect);
      socket.off('disconnect',    onDisconnect);
      socket.off('new_entry',     onNewEntry);
      socket.off('close_declared', onCloseDeclared);
    };
  }, []); // empty — attach once, never reconnect on re-render

  const { ankData, jodiData, openPanaData, closePanaData } = useMemo(() => {
    const active = entries.filter((e) => e.status !== 'cancelled');
    return {
      ankData:       groupBy(active.filter((e) => e.bet_type === 'single_ank'), (r) => r.number),
      jodiData:      groupBy(active.filter((e) => e.bet_type === 'jodi'),        (r) => r.number),
      openPanaData:  groupBy(active.filter((e) => PANA_TYPES.includes(e.bet_type) && e.session === 'open'),  (r) => r.number),
      closePanaData: groupBy(active.filter((e) => PANA_TYPES.includes(e.bet_type) && e.session === 'close'), (r) => r.number),
    };
  }, [entries]);

  const totalCollection = useMemo(
    () => entries.filter((e) => e.status !== 'cancelled').reduce((s, e) => s + parseFloat(e.amount || 0), 0),
    [entries]
  );

  return (
    <BossLayout>
      {/* Quick action */}
      <button
        onClick={() => navigate('/boss/submit-for-broker')}
        className="w-full mb-5 bg-gold hover:bg-darkgold text-black font-bold py-3 px-5 rounded-xl flex items-center justify-center gap-2 text-sm transition-colors active:scale-95"
      >
        <span className="text-base">📤</span>
        Submit Entry For Broker
      </button>

      <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-gold">Dashboard</h1>
          <p className="text-gray-500 text-sm">{today} — Live Summary</p>
        </div>
        <div className="sm:ml-auto flex items-center gap-3">
          <select
            value={marketId}
            onChange={(e) => setMarketId(e.target.value)}
            className="bg-card border border-gold/20 text-white rounded-lg px-3 py-2 text-sm focus:border-gold focus:outline-none"
          >
            <option value="">All Markets</option>
            {markets.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <div className="bg-midcard border border-gold/20 rounded-lg px-3 py-2 text-sm text-gold font-bold">
            Total: {formatAmount(totalCollection)}
          </div>
        </div>
      </div>

      {error && <div className="bg-red-900/30 border border-red-500/40 text-red-300 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}

      {loading ? (
        <div className="flex justify-center items-center py-20 text-gold text-lg">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SummaryTable title="Single Ank" data={ankData}       betType="single_ank"   onRowClick={setModal} />
          <SummaryTable title="Jodi"        data={jodiData}      betType="jodi"          onRowClick={setModal} />
          <SummaryTable title="Open Pana"   data={openPanaData}  betType="single_pana"   onRowClick={setModal} />
          <SummaryTable title="Close Pana"  data={closePanaData} betType="single_pana"   onRowClick={setModal} />
        </div>
      )}

      <BrokerModal item={modal} onClose={() => setModal(null)} />
    </BossLayout>
  );
}
