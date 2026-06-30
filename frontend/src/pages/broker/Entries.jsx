import { useState, useEffect } from 'react';
import BrokerLayout from '../../components/BrokerLayout';
import api from '../../utils/api';
import { formatAmount, formatTime, formatDate, formatNumber } from '../../utils/format';

const BET_LABELS = {
  single_ank:  'Single Ank',
  jodi:        'Jodi',
  single_pana: 'S.Pana',
  double_pana: 'D.Pana',
  triple_pana: 'T.Pana',
  pana:        'Pana',
};

function groupEntries(batches) {
  const byDate = {};
  batches.forEach((batch) => {
    const date = (batch.entry_date || '').split('T')[0] || String(batch.entry_date);
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(batch);
  });
  return Object.entries(byDate)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, batchList]) => ({ date, batches: batchList }));
}

export default function BrokerEntries() {
  const [entries,      setEntries]      = useState([]);
  const [markets,      setMarkets]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [marketFilter, setMarketFilter] = useState('');
  const [expanded,     setExpanded]     = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([api.get('/entries'), api.get('/markets')])
      .then(([entRes, mktRes]) => {
        setEntries(Array.isArray(entRes.data.entries) ? entRes.data.entries : []);
        setMarkets(mktRes.data || []);
      })
      .catch(() => setError('Failed to load entries. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = marketFilter
    ? entries.filter((batch) => batch.market_id === marketFilter)
    : entries;

  const grouped = groupEntries(filtered);

  return (
    <BrokerLayout>
      <h1 className="text-xl font-bold text-gold mb-4">My Entries</h1>

      <div className="mb-4">
        <select
          value={marketFilter}
          onChange={(e) => setMarketFilter(e.target.value)}
          className="w-full bg-card border border-gold/20 text-white rounded-xl px-4 py-3 text-sm focus:border-gold focus:outline-none"
        >
          <option value="">All Markets</option>
          {markets.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-500/40 text-red-300 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-20 text-gold">Loading…</div>
      ) : grouped.length === 0 ? (
        <div className="text-center text-gray-500 py-20">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-semibold">No entries found</p>
          <p className="text-sm mt-1">Submit entries from the Home screen</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ date, batches }) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px flex-1 bg-gold/10" />
                <span className="text-gold text-xs font-bold uppercase">{formatDate(date)}</span>
                <div className="h-px flex-1 bg-gold/10" />
              </div>

              <div className="space-y-3">
                {batches.map((batch) => {
                  const isOpen    = expanded === batch.batch_id;
                  const cancelled = batch.status === 'cancelled';

                  return (
                    <div key={batch.batch_id} className={`bg-card border rounded-2xl overflow-hidden ${
                      cancelled ? 'border-red-500/20 opacity-60' : 'border-gold/10'
                    }`}>
                      <button
                        onClick={() => setExpanded(isOpen ? null : batch.batch_id)}
                        className="w-full text-left px-4 py-3"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <p className="text-gold font-mono text-sm font-bold truncate">{batch.token}</p>
                            <p className="text-gray-400 text-xs mt-0.5">
                              {batch.market_name} · <span className="capitalize">{batch.session}</span>
                            </p>
                          </div>
                          <div className="text-right ml-3">
                            <p className="text-white font-bold">{formatAmount(batch.total_amount)}</p>
                            <p className="text-gray-500 text-xs">{batch.items.length} bet{batch.items.length !== 1 ? 's' : ''}</p>
                          </div>
                        </div>
                        <div className="flex justify-between items-center mt-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                            cancelled ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'
                          }`}>
                            {cancelled ? 'Cancelled' : 'Active'}
                          </span>
                          <span className="text-gray-500 text-xs">
                            {batch.submitted_at ? formatTime(batch.submitted_at) : ''} {isOpen ? '▲' : '▼'}
                          </span>
                        </div>
                      </button>

                      {isOpen && (
                        <div className="border-t border-gold/10">
                          <div className="px-4 py-2 bg-midcard grid grid-cols-4 text-xs text-gray-500 font-semibold uppercase">
                            <span>Type</span>
                            <span>Number</span>
                            <span className="text-right">Amount</span>
                            <span className="text-right">Result</span>
                          </div>
                          {batch.items.map((item, idx) => (
                            <div key={idx} className={`grid grid-cols-4 px-4 py-3 text-sm ${idx > 0 ? 'border-t border-gold/5' : ''}`}>
                              <span className="text-gray-400">{BET_LABELS[item.bet_type] || item.bet_type}</span>
                              <span className="text-white font-mono font-bold">{formatNumber(item.number, item.bet_type)}</span>
                              <span className="text-right text-white">{formatAmount(item.amount)}</span>
                              <span className={`text-right font-semibold ${
                                item.is_winner === true  ? 'text-green-400' :
                                item.is_winner === false ? 'text-red-400'   : 'text-gray-500'
                              }`}>
                                {item.is_winner === true  ? `+${formatAmount(item.actual_payout)}` :
                                 item.is_winner === false ? 'Lost' : '—'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </BrokerLayout>
  );
}
