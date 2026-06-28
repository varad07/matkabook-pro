import { useState, useEffect, useCallback } from 'react';
import BossLayout from '../../components/BossLayout';
import api from '../../utils/api';
import { formatAmount, formatDate } from '../../utils/format';

export default function Settlements() {
  const [activeTab,   setActiveTab]   = useState('pending');  // 'pending' | 'cleared'
  const [summary,     setSummary]     = useState([]);
  const [clearances,  setClearances]  = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [success,     setSuccess]     = useState('');
  const [expanded,    setExpanded]    = useState(null);
  const [clearModal,  setClearModal]  = useState(null);  // { broker_id, broker_name, amount, direction }
  const [clearing,    setClearing]    = useState(false);

  const loadPending = useCallback(() => {
    setLoading(true);
    api.get('/settlements', { params: { status: 'pending' } })
      .then(({ data }) => { setSummary(Array.isArray(data) ? data : []); setError(''); })
      .catch(() => setError('Failed to load settlements'))
      .finally(() => setLoading(false));
  }, []);

  const loadClearances = useCallback(() => {
    setLoading(true);
    api.get('/settlements/clearances')
      .then(({ data }) => { setClearances(Array.isArray(data) ? data : []); setError(''); })
      .catch(() => setError('Failed to load history'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab === 'pending') loadPending();
    else loadClearances();
  }, [activeTab, loadPending, loadClearances]);

  const overallNet      = summary.reduce((s, b) => s + parseFloat(b.net_settlement || 0), 0);
  const totalBrokerPays = summary.filter(b => parseFloat(b.net_settlement || 0) > 0)
                                 .reduce((s, b) => s + parseFloat(b.net_settlement || 0), 0);
  const totalBossPays   = summary.filter(b => parseFloat(b.net_settlement || 0) < 0)
                                 .reduce((s, b) => s + Math.abs(parseFloat(b.net_settlement || 0)), 0);

  async function executeClear(broker_id) {
    setClearing(true);
    try {
      const { data } = await api.post(`/settlements/clear/${broker_id}`);
      const broker = summary.find(b => b.broker_id === broker_id);
      setSummary(prev => prev.filter(b => b.broker_id !== broker_id));
      setSuccess(`Dues cleared for ${broker?.broker_name || 'broker'}: ${formatAmount(data.total_cleared)}`);
      setClearModal(null);
      setTimeout(() => setSuccess(''), 4000);
    } catch (e) {
      setError(e.response?.data?.error || 'Clear failed');
      setClearModal(null);
    } finally {
      setClearing(false);
    }
  }

  return (
    <BossLayout>
      <h1 className="text-xl font-bold text-gold mb-4">Settlements</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {[
          { id: 'pending', label: 'Pending Dues' },
          { id: 'cleared', label: 'Cleared History' },
        ].map(t => (
          <button key={t.id} onClick={() => { setActiveTab(t.id); setExpanded(null); setError(''); setSuccess(''); }}
            className={`px-5 py-2 rounded-xl font-semibold text-sm transition-colors ${
              activeTab === t.id ? 'bg-gold text-black' : 'bg-card border border-gold/20 text-gray-300'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {success && (
        <div className="bg-green-900/30 border border-green-500/40 text-green-300 px-4 py-3 rounded-lg mb-4 text-sm">{success}</div>
      )}
      {error && (
        <div className="bg-red-900/30 border border-red-500/40 text-red-300 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
      )}

      {/* ── PENDING DUES TAB ──────────────────────────────────── */}
      {activeTab === 'pending' && (
        <>
          {!loading && summary.length > 0 && (
            <div className="bg-card border border-gold/10 rounded-2xl p-4 mb-5">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-midcard rounded-xl p-3 text-center">
                  <p className="text-gray-500 text-xs mb-1">Brokers Pay You</p>
                  <p className="text-green-400 font-bold text-lg">{formatAmount(totalBrokerPays)}</p>
                </div>
                <div className="bg-midcard rounded-xl p-3 text-center">
                  <p className="text-gray-500 text-xs mb-1">You Pay Brokers</p>
                  <p className="text-red-400 font-bold text-lg">{formatAmount(totalBossPays)}</p>
                </div>
                <div className={`rounded-xl p-3 text-center border ${
                  overallNet >= 0 ? 'bg-green-900/20 border-green-500/30' : 'bg-red-900/20 border-red-500/30'
                }`}>
                  <p className="text-gray-400 text-xs mb-1">Net Balance</p>
                  <p className={`font-bold text-lg ${overallNet >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {overallNet >= 0 ? '↑ ' : '↓ '}{formatAmount(Math.abs(overallNet))}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {overallNet > 0 ? 'You Receive' : overallNet < 0 ? 'You Pay' : 'Settled'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-20 text-gold">Loading…</div>
          ) : summary.length === 0 ? (
            <div className="text-center text-gray-500 py-20">
              <p className="text-4xl mb-3">✓</p>
              <p className="font-semibold">No pending dues</p>
              <p className="text-sm mt-1">All settlements have been cleared</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {summary.map((b) => {
                const net        = parseFloat(b.net_settlement || 0);
                const brokerPays = net >= 0;
                const days       = Array.isArray(b.days) ? b.days : [];
                const isExp      = expanded === b.broker_id;

                return (
                  <div key={b.broker_id} className="bg-card border border-gold/10 rounded-2xl overflow-hidden">
                    <div className="p-5">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="text-gold font-bold">{b.broker_name}</p>
                          <p className="text-gray-500 text-xs">{b.broker_code}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          brokerPays
                            ? 'bg-green-900/40 text-green-400 border border-green-500/30'
                            : 'bg-red-900/40 text-red-400 border border-red-500/30'
                        }`}>
                          {brokerPays ? '↑ BROKER PAYS' : '↓ BOSS PAYS'}
                        </span>
                      </div>

                      <div className="space-y-2 text-sm border-t border-gold/10 pt-4">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Total Collection</span>
                          <span className="text-white font-medium">{formatAmount(b.total_collection)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-yellow-400">Commission (10%)</span>
                          <span className="text-yellow-400 font-medium">{formatAmount(b.total_commission)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Net Collection</span>
                          <span className="text-white font-medium">{formatAmount(b.total_net_collection)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-red-400">Total Winning</span>
                          <span className="text-red-400 font-medium">{formatAmount(b.total_winning)}</span>
                        </div>
                        <div className="flex justify-between border-t border-gold/10 pt-2 mt-2">
                          <span className="text-gray-300 font-semibold">Net Settlement</span>
                          <span className={`font-bold text-lg ${brokerPays ? 'text-green-400' : 'text-red-400'}`}>
                            {formatAmount(Math.abs(net))}
                          </span>
                        </div>
                      </div>

                      {days.length > 0 && (
                        <button
                          onClick={() => setExpanded(isExp ? null : b.broker_id)}
                          className="mt-4 w-full text-center text-xs text-gold/60 hover:text-gold py-2 border-t border-gold/10"
                        >
                          {isExp ? '▲ Hide Details' : `▼ View ${days.length} Result${days.length !== 1 ? 's' : ''}`}
                        </button>
                      )}
                    </div>

                    {isExp && (
                      <div className="border-t border-gold/10">
                        <div className="px-4 py-2 bg-midcard grid grid-cols-4 text-xs text-gray-500 font-semibold uppercase">
                          <span>Date</span>
                          <span className="text-right">Coll.</span>
                          <span className="text-right">Won</span>
                          <span className="text-right">Net</span>
                        </div>
                        {days.map((d, i) => {
                          const dNet = parseFloat(d.net || 0);
                          return (
                            <div key={i} className={`grid grid-cols-4 px-4 py-3 text-xs ${i > 0 ? 'border-t border-gold/5' : ''}`}>
                              <span className="text-gray-300 truncate">{d.market_name || formatDate(d.date)}</span>
                              <span className="text-right text-white">{formatAmount(d.collection)}</span>
                              <span className="text-right text-red-400">{formatAmount(d.winning)}</span>
                              <span className={`text-right font-semibold ${dNet >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {dNet >= 0 ? '+' : '−'}{formatAmount(Math.abs(dNet))}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Clear Settlement button */}
                    <div className="px-5 pb-5 pt-3 border-t border-gold/10">
                      <button
                        onClick={() => setClearModal({
                          broker_id:   b.broker_id,
                          broker_name: b.broker_name,
                          amount:      Math.abs(net),
                          direction:   b.direction,
                        })}
                        className="w-full bg-gold/20 border border-gold/50 hover:bg-gold/30 text-gold font-bold py-3 rounded-xl text-sm transition-colors active:scale-95"
                      >
                        ✓ CLEAR SETTLEMENT
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── CLEARED HISTORY TAB ────────────────────────────────── */}
      {activeTab === 'cleared' && (
        <>
          {loading ? (
            <div className="flex justify-center py-20 text-gold">Loading…</div>
          ) : clearances.length === 0 ? (
            <div className="text-center text-gray-500 py-20">
              <p className="text-4xl mb-3">📋</p>
              <p className="font-semibold">No cleared settlements yet</p>
            </div>
          ) : (
            <div className="bg-card border border-gold/10 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 bg-midcard grid grid-cols-4 text-xs text-gray-500 font-semibold uppercase">
                <span>Date Cleared</span>
                <span>Broker</span>
                <span className="text-right">Amount</span>
                <span className="text-right">Note</span>
              </div>
              {clearances.map((c, i) => (
                <div key={c.id} className={`grid grid-cols-4 px-4 py-3 text-sm ${i > 0 ? 'border-t border-gold/5' : ''}`}>
                  <span className="text-gray-300">{formatDate((c.cleared_at || '').split('T')[0])}</span>
                  <span className="text-white">
                    <span className="font-bold">{c.broker_name}</span>
                    <span className="text-gray-500 text-xs block">{c.broker_code}</span>
                  </span>
                  <span className="text-right text-gold font-bold">{formatAmount(c.total_cleared_amount)}</span>
                  <span className="text-right text-gray-500 text-xs">{c.note || '—'}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── CLEAR CONFIRMATION MODAL ───────────────────────────── */}
      {clearModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-card border border-gold/30 rounded-2xl w-full max-w-sm p-6 text-center">
            <p className="text-white font-bold text-lg mb-2">Clear Settlement?</p>
            <p className="text-gray-400 text-sm mb-3">{clearModal.broker_name}</p>
            <p className="text-3xl font-bold text-gold mb-1">{formatAmount(clearModal.amount)}</p>
            <p className="text-gray-500 text-xs mb-2">
              {clearModal.direction === 'broker_pays' ? 'Broker owes boss' : 'Boss owes broker'}
            </p>
            <p className="text-red-400 text-xs mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setClearModal(null)}
                disabled={clearing}
                className="flex-1 py-3 rounded-xl border border-gray-600 text-gray-300 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => executeClear(clearModal.broker_id)}
                disabled={clearing}
                className="flex-1 py-3 rounded-xl bg-gold text-black font-bold disabled:opacity-50"
              >
                {clearing ? 'Clearing…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </BossLayout>
  );
}
