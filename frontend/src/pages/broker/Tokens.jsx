import { useState, useEffect } from 'react';
import BrokerLayout from '../../components/BrokerLayout';
import api from '../../utils/api';
import { formatAmount, formatTime } from '../../utils/format';

const BET_LABELS = {
  single_ank:  'Single Ank',
  jodi:        'Jodi',
  single_pana: 'Single Pana',
  double_pana: 'Double Pana',
  triple_pana: 'Triple Pana',
  pana:        'Pana',
};

function buildBatches(rows) {
  const map = {};
  rows.forEach((row) => {
    if (!map[row.batch_id]) {
      map[row.batch_id] = {
        batch_id:     row.batch_id,
        token:        row.token,
        market_name:  row.market_name,
        entry_date:   row.entry_date,
        submitted_at: row.submitted_at,
        total_amount: row.total_amount,
        status:       row.status,
        session:      row.session,
        items:        [],
      };
    }
    map[row.batch_id].items.push(row);
  });

  return Object.values(map).sort((a, b) => {
    const da = a.submitted_at || a.entry_date || '';
    const db = b.submitted_at || b.entry_date || '';
    return db.localeCompare(da);
  });
}

export default function BrokerTokens() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [search,  setSearch]  = useState('');
  const [detail,  setDetail]  = useState(null);

  useEffect(() => {
    api.get('/entries')
      .then(({ data }) => setEntries(data.entries || data || []))
      .catch(() => setError('Failed to load tokens'))
      .finally(() => setLoading(false));
  }, []);

  const batches  = buildBatches(entries);
  const filtered = search
    ? batches.filter((b) =>
        (b.token || '').toLowerCase().includes(search.toLowerCase()) ||
        (b.market_name || '').toLowerCase().includes(search.toLowerCase())
      )
    : batches;

  return (
    <BrokerLayout>
      <h1 className="text-xl font-bold text-gold mb-4">My Tokens</h1>

      <div className="mb-4 relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search token or market…"
          className="w-full bg-card border border-gold/20 text-white rounded-xl pl-10 pr-4 py-3 text-sm focus:border-gold focus:outline-none"
        />
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-500/40 text-red-300 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-20 text-gold">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-gray-500 py-20">
          <p className="text-4xl mb-3">🎟</p>
          <p className="font-semibold">{search ? 'No tokens match your search' : 'No tokens yet'}</p>
          <p className="text-sm mt-1">Tokens are generated when you submit entries</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((batch) => {
            const cancelled = batch.status === 'cancelled';
            return (
              <button
                key={batch.batch_id}
                onClick={() => setDetail(batch)}
                className={`w-full text-left bg-card border rounded-2xl px-4 py-4 transition-all active:scale-95 ${
                  cancelled ? 'border-red-500/20 opacity-60' : 'border-gold/10 hover:border-gold/30'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <p className="text-gold font-mono font-bold text-base">{batch.token}</p>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    cancelled ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'
                  }`}>
                    {cancelled ? 'Cancelled' : 'Active'}
                  </span>
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-gray-300 text-sm">{batch.market_name} · <span className="capitalize">{batch.session}</span></p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {batch.submitted_at ? formatTime(batch.submitted_at) : batch.entry_date}
                      {' · '}{batch.items.length} bet{batch.items.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <p className="text-white font-bold">{formatAmount(batch.total_amount)}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Slide-up detail modal */}
      {detail && (
        <div className="fixed inset-0 bg-black/80 flex items-end justify-center z-50">
          <div className="bg-card border border-gold/20 rounded-t-3xl w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-gold font-mono font-bold text-lg">{detail.token}</p>
                <p className="text-gray-400 text-sm">{detail.market_name} · <span className="capitalize">{detail.session}</span></p>
              </div>
              <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-white text-2xl leading-none">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5 text-sm">
              <div className="bg-midcard rounded-xl p-3">
                <p className="text-gray-500 text-xs mb-1">Total Amount</p>
                <p className="text-gold font-bold">{formatAmount(detail.total_amount)}</p>
              </div>
              <div className="bg-midcard rounded-xl p-3">
                <p className="text-gray-500 text-xs mb-1">Status</p>
                <p className={`font-bold ${detail.status === 'cancelled' ? 'text-red-400' : 'text-green-400'}`}>
                  {detail.status === 'cancelled' ? 'Cancelled' : 'Active'}
                </p>
              </div>
            </div>

            <p className="text-gray-400 text-xs uppercase font-bold mb-2">Bets</p>
            <div className="bg-midcard rounded-xl overflow-hidden mb-6">
              {detail.items.map((item, i) => (
                <div key={i} className={`flex justify-between items-center px-4 py-3 ${i > 0 ? 'border-t border-gold/5' : ''}`}>
                  <div>
                    <p className="text-white font-mono font-bold">{item.number}</p>
                    <p className="text-gray-500 text-xs">{BET_LABELS[item.bet_type] || item.bet_type}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white">{formatAmount(item.amount)}</p>
                    {item.is_winner === true && <p className="text-green-400 text-xs font-bold">Won +{formatAmount(item.actual_payout)}</p>}
                    {item.is_winner === false && <p className="text-red-400 text-xs">Lost</p>}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setDetail(null)}
              className="w-full bg-gold text-black font-bold py-4 rounded-2xl text-base active:scale-95 transition-transform"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </BrokerLayout>
  );
}
