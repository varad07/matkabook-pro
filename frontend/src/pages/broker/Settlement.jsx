import { useState, useEffect, useCallback } from 'react';
import BrokerLayout from '../../components/BrokerLayout';
import api from '../../utils/api';
import { formatAmount, formatDate } from '../../utils/format';

function groupByDate(settlements) {
  const byDate = {};
  settlements.forEach((s) => {
    const date = (s.settlement_date || s.created_at || '').split('T')[0];
    if (!byDate[date]) {
      byDate[date] = { date, items: [], totalCollection: 0, commission: 0,
                       netCollection: 0, totalWinning: 0, netSettlement: 0 };
    }
    const g = byDate[date];
    g.items.push(s);
    g.totalCollection += parseFloat(s.total_collection  || 0);
    g.commission      += parseFloat(s.commission_amount || 0);
    g.netCollection   += parseFloat(s.net_collection    || 0);
    g.totalWinning    += parseFloat(s.total_winning     || 0);
    g.netSettlement   += parseFloat(s.net_settlement    || 0);
  });
  return Object.values(byDate).sort((a, b) => b.date.localeCompare(a.date));
}

export default function BrokerSettlement() {
  const [activeTab,   setActiveTab]   = useState('current');  // 'current' | 'history'
  const [settlements, setSettlements] = useState([]);
  const [history,     setHistory]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [expanded,    setExpanded]    = useState(null);

  const loadCurrent = useCallback(() => {
    setLoading(true);
    api.get('/settlements/my')
      .then(({ data }) => { setSettlements(Array.isArray(data) ? data : []); setError(''); })
      .catch(() => setError('Failed to load settlements'))
      .finally(() => setLoading(false));
  }, []);

  const loadHistory = useCallback(() => {
    setLoading(true);
    api.get('/settlements/my/history')
      .then(({ data }) => { setHistory(Array.isArray(data) ? data : []); setError(''); })
      .catch(() => setError('Failed to load history'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab === 'current') loadCurrent();
    else loadHistory();
  }, [activeTab, loadCurrent, loadHistory]);

  const overallNet = settlements.reduce((sum, s) => sum + parseFloat(s.net_settlement || 0), 0);
  const grouped    = groupByDate(settlements);

  return (
    <BrokerLayout>
      <h1 className="text-xl font-bold text-gold mb-4">My Settlements</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {[
          { id: 'current', label: 'Current Dues' },
          { id: 'history', label: 'Cleared History' },
        ].map(t => (
          <button key={t.id}
            onClick={() => { setActiveTab(t.id); setExpanded(null); setError(''); }}
            className={`px-5 py-2 rounded-xl font-semibold text-sm transition-colors ${
              activeTab === t.id ? 'bg-gold text-black' : 'bg-card border border-gold/20 text-gray-300'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-500/40 text-red-300 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
      )}

      {/* ── CURRENT DUES TAB ──────────────────────────────────── */}
      {activeTab === 'current' && (
        <>
          {!loading && settlements.length > 0 && (
            <div className={`bg-card border rounded-2xl p-4 mb-5 ${
              overallNet < 0 ? 'border-green-500/20' : overallNet > 0 ? 'border-red-500/20' : 'border-gold/10'
            }`}>
              <p className="text-gray-400 text-xs uppercase font-bold mb-2">Overall Balance</p>
              <p className={`text-2xl font-bold ${
                overallNet < 0 ? 'text-green-400' : overallNet > 0 ? 'text-red-400' : 'text-white'
              }`}>
                {overallNet < 0
                  ? `Boss Owes You ${formatAmount(Math.abs(overallNet))}`
                  : overallNet > 0
                  ? `You Owe Boss ${formatAmount(overallNet)}`
                  : 'All Settled ✓'}
              </p>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-20 text-gold">Loading…</div>
          ) : grouped.length === 0 ? (
            <div className="text-center text-gray-500 py-20">
              <p className="text-4xl mb-3">✓</p>
              <p className="font-semibold">No pending dues</p>
              <p className="text-sm mt-1">All settlements have been cleared</p>
            </div>
          ) : (
            <div className="space-y-4">
              {grouped.map((group) => {
                const brokerPays  = group.netSettlement >= 0;
                const isOpen      = expanded === group.date;
                const hasMultiple = group.items.length > 1;

                return (
                  <div key={group.date} className="bg-card border border-gold/10 rounded-2xl overflow-hidden">
                    <div
                      className={hasMultiple ? 'cursor-pointer' : ''}
                      onClick={() => hasMultiple && setExpanded(isOpen ? null : group.date)}
                    >
                      <div className="flex justify-between items-start px-4 py-3 border-b border-gold/10">
                        <div>
                          <p className="text-white font-semibold">{formatDate(group.date)}</p>
                          {!hasMultiple && group.items[0]?.market_name && (
                            <p className="text-gray-500 text-xs mt-0.5">{group.items[0].market_name}</p>
                          )}
                          {hasMultiple && (
                            <p className="text-gray-500 text-xs mt-0.5">{group.items.length} markets — tap to expand</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                            brokerPays ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'
                          }`}>
                            {brokerPays ? 'YOU PAY' : 'BOSS PAYS'}
                          </span>
                          {hasMultiple && (
                            <span className="text-gray-500 text-xs">{isOpen ? '▲' : '▼'}</span>
                          )}
                        </div>
                      </div>

                      <div className="px-4 py-3 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Collection</span>
                          <span className="text-white">{formatAmount(group.totalCollection)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Commission (10%)</span>
                          <span className="text-yellow-400">− {formatAmount(group.commission)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Net Collection</span>
                          <span className="text-white">{formatAmount(group.netCollection)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Total Winning</span>
                          <span className="text-red-400">− {formatAmount(group.totalWinning)}</span>
                        </div>
                        <div className="border-t border-gold/10 pt-2 mt-2 flex justify-between items-center">
                          <span className="text-gray-300 font-semibold">Net Settlement</span>
                          <p className={`text-xl font-bold ${brokerPays ? 'text-red-400' : 'text-green-400'}`}>
                            {brokerPays ? '− ' : '+ '}{formatAmount(Math.abs(group.netSettlement))}
                          </p>
                        </div>
                      </div>
                    </div>

                    {isOpen && hasMultiple && (
                      <div className="border-t border-gold/10">
                        <div className="px-4 py-2 bg-midcard grid grid-cols-3 text-xs text-gray-500 font-semibold uppercase">
                          <span>Market</span>
                          <span className="text-right">Collection</span>
                          <span className="text-right">Net</span>
                        </div>
                        {group.items.map((s, i) => {
                          const sNet = parseFloat(s.net_settlement || 0);
                          return (
                            <div key={s.id || i} className={`grid grid-cols-3 px-4 py-2 text-sm ${i > 0 ? 'border-t border-gold/5' : ''}`}>
                              <span className="text-gray-300 truncate">{s.market_name || '—'}</span>
                              <span className="text-right text-white">{formatAmount(s.total_collection)}</span>
                              <span className={`text-right font-semibold ${sNet >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                                {sNet >= 0 ? '−' : '+'}{formatAmount(Math.abs(sNet))}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── CLEARED HISTORY TAB ────────────────────────────────── */}
      {activeTab === 'history' && (
        <>
          {loading ? (
            <div className="flex justify-center py-20 text-gold">Loading…</div>
          ) : history.length === 0 ? (
            <div className="text-center text-gray-500 py-20">
              <p className="text-4xl mb-3">📋</p>
              <p className="font-semibold">No cleared history yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-gray-500 text-xs text-center mb-4">
                These dues have been settled by admin
              </p>
              {history.map((c, i) => (
                <div key={c.id || i} className="bg-card border border-gold/10 rounded-2xl p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-gray-400 text-xs">Cleared on</p>
                      <p className="text-white font-semibold">
                        {formatDate((c.cleared_at || '').split('T')[0])}
                      </p>
                      {c.cleared_by_name && (
                        <p className="text-gray-500 text-xs mt-0.5">by {c.cleared_by_name}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-gold font-bold text-xl">{formatAmount(c.total_cleared_amount)}</p>
                      <p className="text-green-400 text-xs font-semibold mt-0.5">CLEARED</p>
                    </div>
                  </div>
                  {c.note && (
                    <p className="text-gray-500 text-xs mt-3 border-t border-gold/10 pt-3">{c.note}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </BrokerLayout>
  );
}
