import { useState, useEffect } from 'react';
import BossLayout from '../../components/BossLayout';
import api from '../../utils/api';
import { formatAmount, formatTime } from '../../utils/format';

export default function Search() {
  const [markets,   setMarkets]   = useState([]);
  const [filters,   setFilters]   = useState({ token: '', broker: '', date: '', market_id: '', number: '', bet_type: '' });
  const [results,   setResults]   = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [searched,  setSearched]  = useState(false);
  const [detail,    setDetail]    = useState(null);

  useEffect(() => {
    api.get('/markets').then(({ data }) => setMarkets(data)).catch(() => {});
  }, []);

  function setF(k, v) { setFilters((f) => ({ ...f, [k]: v })); }

  async function handleSearch(e) {
    e.preventDefault();
    setLoading(true); setError(''); setSearched(true);
    const params = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    try {
      const { data } = await api.get('/search', { params });
      setResults(data.results || []);
    } catch (e) { setError(e.response?.data?.error || 'Search failed'); }
    finally { setLoading(false); }
  }

  // Group by batch for detail view
  function openDetail(row) {
    setDetail(row);
  }

  return (
    <BossLayout>
      <h1 className="text-xl font-bold text-gold mb-4">Search Entries</h1>

      <form onSubmit={handleSearch} className="bg-card border border-gold/10 rounded-xl p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-3">
          {[
            { key: 'token',  label: 'Token',  placeholder: 'KAL-270626-...' },
            { key: 'broker', label: 'Broker', placeholder: 'Name or code' },
            { key: 'number', label: 'Number', placeholder: 'e.g. 5 or 123' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-gray-400 text-xs uppercase mb-1">{label}</label>
              <input value={filters[key]} onChange={(e) => setF(key, e.target.value)} placeholder={placeholder}
                className="w-full bg-midcard border border-gold/20 text-white rounded-lg px-3 py-2 text-sm focus:border-gold focus:outline-none" />
            </div>
          ))}
          <div>
            <label className="block text-gray-400 text-xs uppercase mb-1">Date</label>
            <input type="date" value={filters.date} onChange={(e) => setF('date', e.target.value)}
              className="w-full bg-midcard border border-gold/20 text-white rounded-lg px-3 py-2 text-sm focus:border-gold focus:outline-none" />
          </div>
          <div>
            <label className="block text-gray-400 text-xs uppercase mb-1">Market</label>
            <select value={filters.market_id} onChange={(e) => setF('market_id', e.target.value)}
              className="w-full bg-midcard border border-gold/20 text-white rounded-lg px-3 py-2 text-sm focus:border-gold focus:outline-none">
              <option value="">All Markets</option>
              {markets.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-gray-400 text-xs uppercase mb-1">Bet Type</label>
            <select value={filters.bet_type} onChange={(e) => setF('bet_type', e.target.value)}
              className="w-full bg-midcard border border-gold/20 text-white rounded-lg px-3 py-2 text-sm focus:border-gold focus:outline-none">
              <option value="">All Types</option>
              {['single_ank','jodi','single_pana','double_pana','triple_pana'].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
        <button type="submit" disabled={loading}
          className="w-full bg-gold hover:bg-darkgold disabled:opacity-40 text-black font-bold py-2 rounded-lg text-sm transition-colors">
          {loading ? 'Searching…' : '🔍 Search'}
        </button>
      </form>

      {error && <div className="bg-red-900/30 border border-red-500/40 text-red-300 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}

      {searched && !loading && (
        results.length === 0 ? (
          <div className="text-center text-gray-500 py-16">No results found</div>
        ) : (
          <>
            <p className="text-gray-400 text-sm mb-3">{results.length} result(s) found</p>
            <div className="bg-card border border-gold/10 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-midcard">
                    <tr>{['Token','Broker','Market','Type','Number','Amount','Time'].map((h) => (
                      <th key={h} className="text-gold text-left px-3 py-3 whitespace-nowrap">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {results.map((row, i) => (
                      <tr key={row.item_id || i} onClick={() => openDetail(row)}
                        className={`border-t border-gold/5 cursor-pointer hover:bg-gold/10 transition-colors ${i % 2 === 0 ? 'bg-dark/20' : ''}`}>
                        <td className="px-3 py-2 font-mono text-xs text-blue-400">{row.token}</td>
                        <td className="px-3 py-2 text-white whitespace-nowrap">{row.broker_name}</td>
                        <td className="px-3 py-2 text-gray-300">{row.market_code}</td>
                        <td className="px-3 py-2 text-gray-300 whitespace-nowrap">{row.bet_type}</td>
                        <td className="px-3 py-2 font-mono font-bold text-white">{row.number}</td>
                        <td className="px-3 py-2 text-green-400">{formatAmount(row.amount)}</td>
                        <td className="px-3 py-2 text-gray-400 text-xs whitespace-nowrap">{formatTime(row.entry_date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )
      )}

      {/* Detail modal */}
      {detail && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-card border border-gold/30 rounded-2xl w-full max-w-md p-6">
            <div className="flex justify-between mb-4">
              <h3 className="text-gold font-bold">Entry Detail</h3>
              <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="space-y-2 text-sm">
              {[
                ['Token',    detail.token],
                ['Broker',   detail.broker_name],
                ['Market',   detail.market_name],
                ['Date',     detail.entry_date],
                ['Session',  detail.session],
                ['Status',   detail.status],
                ['Bet Type', detail.bet_type],
                ['Number',   detail.number],
                ['Amount',   formatAmount(detail.amount)],
                ['Potential Win', formatAmount(detail.potential_payout)],
                ['Actual Win',    formatAmount(detail.actual_payout)],
                ['Winner',   detail.is_winner ? '✓ Yes' : detail.is_winner === false ? '✗ No' : 'Pending'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-gray-400">{k}</span>
                  <span className="text-white font-mono text-right">{v ?? '-'}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setDetail(null)} className="w-full bg-gold text-black font-bold py-2 rounded-lg mt-4 text-sm">Close</button>
          </div>
        </div>
      )}
    </BossLayout>
  );
}
