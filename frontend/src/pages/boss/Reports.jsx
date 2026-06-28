import { useState, useEffect } from 'react';
import BossLayout from '../../components/BossLayout';
import api from '../../utils/api';
import { formatAmount, todayISO } from '../../utils/format';

const TABS = ['Daily', 'Broker', 'Market', 'Date Range'];

function SummaryCards({ data }) {
  if (!data) return null;
  const items = [
    { label: 'Total Collection', value: data.total_collection, color: 'text-white' },
    { label: 'Commission',       value: data.total_commission, color: 'text-yellow-400' },
    { label: 'Total Winning',    value: data.total_winning,    color: 'text-red-400' },
    { label: 'Net P&L',         value: data.net_settlement,   color: parseFloat(data.net_settlement) >= 0 ? 'text-green-400' : 'text-red-400' },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 mb-6">
      {items.map((item) => (
        <div key={item.label} className="bg-midcard border border-gold/10 rounded-xl p-4">
          <p className="text-gray-400 text-xs mb-1">{item.label}</p>
          <p className={`font-bold text-lg ${item.color}`}>{formatAmount(item.value)}</p>
        </div>
      ))}
    </div>
  );
}

function DailyTable({ rows }) {
  if (!rows?.length) return <p className="text-gray-500 text-center py-8">No data</p>;
  return (
    <div className="bg-card border border-gold/10 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-midcard">
            <tr>{['Broker','Collection','Commission','Winning','Net'].map((h) => (
              <th key={h} className="text-gold text-left px-4 py-2 whitespace-nowrap">{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={`border-t border-gold/5 ${i % 2 === 0 ? 'bg-dark/20' : ''}`}>
                <td className="px-4 py-2 text-white">{r.broker_name || r.settlement_date}</td>
                <td className="px-4 py-2 text-gray-300">{formatAmount(r.total_collection)}</td>
                <td className="px-4 py-2 text-yellow-400">{formatAmount(r.total_commission)}</td>
                <td className="px-4 py-2 text-red-400">{formatAmount(r.total_winning)}</td>
                <td className={`px-4 py-2 font-bold ${parseFloat(r.net_settlement) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatAmount(r.net_settlement)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Reports() {
  const [tab,       setTab]       = useState(0);
  const [brokers,   setBrokers]   = useState([]);
  const [markets,   setMarkets]   = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [result,    setResult]    = useState(null);

  const [daily,     setDaily]     = useState({ date: todayISO() });
  const [broker,    setBroker]    = useState({ broker_id: '', from: todayISO(), to: todayISO() });
  const [market,    setMarket]    = useState({ market_id: '', from: todayISO(), to: todayISO() });
  const [range,     setRange]     = useState({ from: todayISO(), to: todayISO() });

  useEffect(() => {
    api.get('/brokers').then(({ data }) => setBrokers(data)).catch(() => {});
    api.get('/markets').then(({ data }) => setMarkets(data)).catch(() => {});
  }, []);

  async function fetchReport() {
    setLoading(true); setError(''); setResult(null);
    try {
      let res;
      if (tab === 0) res = await api.get('/reports/daily',  { params: { date:      daily.date } });
      if (tab === 1) res = await api.get('/reports/broker', { params: broker });
      if (tab === 2) res = await api.get('/reports/market', { params: market });
      if (tab === 3) res = await api.get('/reports/range',  { params: range  });
      setResult(res.data);
    } catch (e) { setError(e.response?.data?.error || 'Failed to load report'); }
    finally { setLoading(false); }
  }

  function Input({ label, type = 'text', value, onChange }) {
    return (
      <div>
        <label className="block text-gray-400 text-xs uppercase mb-1">{label}</label>
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full bg-card border border-gold/20 text-white rounded-lg px-3 py-2 text-sm focus:border-gold focus:outline-none" />
      </div>
    );
  }

  function Select({ label, value, onChange, options }) {
    return (
      <div>
        <label className="block text-gray-400 text-xs uppercase mb-1">{label}</label>
        <select value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full bg-card border border-gold/20 text-white rounded-lg px-3 py-2 text-sm focus:border-gold focus:outline-none">
          <option value="">Select…</option>
          {options.map((o) => <option key={o.id} value={o.id}>{o.name || o.broker_name}</option>)}
        </select>
      </div>
    );
  }

  return (
    <BossLayout>
      <h1 className="text-xl font-bold text-gold mb-4">Reports</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-midcard rounded-xl p-1 mb-6 overflow-x-auto">
        {TABS.map((t, i) => (
          <button key={t} onClick={() => { setTab(i); setResult(null); }}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              tab === i ? 'bg-gold text-black font-bold' : 'text-gray-400 hover:text-white'
            }`}>{t}</button>
        ))}
      </div>

      {/* Filter forms */}
      <div className="bg-card border border-gold/10 rounded-xl p-4 mb-4 space-y-3">
        {tab === 0 && (
          <Input label="Date" type="date" value={daily.date} onChange={(v) => setDaily({ date: v })} />
        )}
        {tab === 1 && (
          <>
            <Select label="Broker" value={broker.broker_id} onChange={(v) => setBroker((f) => ({ ...f, broker_id: v }))}
              options={brokers.map((b) => ({ id: b.id, name: b.name }))} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="From" type="date" value={broker.from} onChange={(v) => setBroker((f) => ({ ...f, from: v }))} />
              <Input label="To"   type="date" value={broker.to}   onChange={(v) => setBroker((f) => ({ ...f, to:   v }))} />
            </div>
          </>
        )}
        {tab === 2 && (
          <>
            <Select label="Market" value={market.market_id} onChange={(v) => setMarket((f) => ({ ...f, market_id: v }))}
              options={markets.map((m) => ({ id: m.id, name: m.name }))} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="From" type="date" value={market.from} onChange={(v) => setMarket((f) => ({ ...f, from: v }))} />
              <Input label="To"   type="date" value={market.to}   onChange={(v) => setMarket((f) => ({ ...f, to:   v }))} />
            </div>
          </>
        )}
        {tab === 3 && (
          <div className="grid grid-cols-2 gap-3">
            <Input label="From" type="date" value={range.from} onChange={(v) => setRange((f) => ({ ...f, from: v }))} />
            <Input label="To"   type="date" value={range.to}   onChange={(v) => setRange((f) => ({ ...f, to:   v }))} />
          </div>
        )}
        <button onClick={fetchReport} disabled={loading}
          className="w-full bg-gold hover:bg-darkgold disabled:opacity-40 text-black font-bold py-2 rounded-lg text-sm transition-colors">
          {loading ? 'Loading…' : '📊 Generate Report'}
        </button>
      </div>

      {error && <div className="bg-red-900/30 border border-red-500/40 text-red-300 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}

      {result && (
        <>
          <SummaryCards data={result.totals} />
          <DailyTable rows={result.brokers || result.daily} />
        </>
      )}
    </BossLayout>
  );
}
