import { useState, useEffect } from 'react';
import BossLayout from '../../components/BossLayout';
import api from '../../utils/api';

function StatusBadge({ status }) {
  const on = status === 'accepting';
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
      on ? 'bg-green-900/40 text-green-400 border-green-500/30' : 'bg-red-900/40 text-red-400 border-red-500/30'
    }`}>
      {on ? '● Accepting' : '● Stopped'}
    </span>
  );
}

function MarketCard({ market, onUpdated }) {
  const [openCutoff,  setOpenCutoff]  = useState(market.open_time  || '');
  const [closeCutoff, setCloseCutoff] = useState(market.close_time || '');
  const [saving,      setSaving]      = useState(false);
  const [acting,      setActing]      = useState('');
  const [msg,         setMsg]         = useState('');

  async function saveTiming() {
    setSaving(true); setMsg('');
    try {
      await api.put(`/markets/${market.id}`, {
        name:        market.name,
        open_time:   openCutoff,
        close_time:  closeCutoff,
        is_active:   market.is_active,
      });
      setMsg('Saved!');
      onUpdated();
    } catch (e) { setMsg(e.response?.data?.error || 'Save failed'); }
    finally { setSaving(false); }
  }

  async function doAction(endpoint, label) {
    setActing(label); setMsg('');
    try {
      await api.put(`/markets/${market.id}/${endpoint}`);
      onUpdated();
    } catch (e) { setMsg(e.response?.data?.error || 'Action failed'); }
    finally { setActing(''); }
  }

  return (
    <div className="bg-card border border-gold/10 rounded-2xl p-5">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-gold font-bold text-lg">{market.name}</h3>
          <span className="text-gray-500 text-xs font-mono">{market.code}</span>
        </div>
        <button
          onClick={() => doAction(market.is_active ? 'disable' : 'enable', 'toggle')}
          disabled={!!acting}
          className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
            market.is_active
              ? 'bg-red-900/30 text-red-400 border-red-500/30 hover:bg-red-900/50'
              : 'bg-green-900/30 text-green-400 border-green-500/30 hover:bg-green-900/50'
          } disabled:opacity-40`}
        >
          {acting === 'toggle' ? '…' : market.is_active ? 'Disable' : 'Enable'}
        </button>
      </div>

      {msg && <p className={`text-xs mb-3 ${msg === 'Saved!' ? 'text-green-400' : 'text-red-400'}`}>{msg}</p>}

      {/* Cutoff times */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="text-gray-400 text-xs uppercase block mb-1">Open Cutoff</label>
          <input type="time" value={openCutoff} onChange={(e) => setOpenCutoff(e.target.value)}
            className="w-full bg-midcard border border-gold/20 text-white rounded-lg px-3 py-2 text-sm focus:border-gold focus:outline-none" />
        </div>
        <div>
          <label className="text-gray-400 text-xs uppercase block mb-1">Close Cutoff</label>
          <input type="time" value={closeCutoff} onChange={(e) => setCloseCutoff(e.target.value)}
            className="w-full bg-midcard border border-gold/20 text-white rounded-lg px-3 py-2 text-sm focus:border-gold focus:outline-none" />
        </div>
      </div>
      <button onClick={saveTiming} disabled={saving}
        className="w-full bg-gold/20 hover:bg-gold/30 text-gold border border-gold/30 rounded-lg py-2 text-sm font-bold mb-4 disabled:opacity-40 transition-colors">
        {saving ? 'Saving…' : '💾 Save Timing'}
      </button>

      {/* Open status */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-sm">Open:</span>
          <StatusBadge status={market.open_status} />
        </div>
        <div className="flex gap-2">
          <button onClick={() => doAction('stop-open',  'stop-open')}  disabled={!!acting || market.open_status === 'stopped'}
            className="bg-red-900/40 text-red-300 border border-red-700/30 px-2 py-1 rounded text-xs disabled:opacity-30">
            {acting === 'stop-open' ? '…' : 'STOP'}
          </button>
          <button onClick={() => doAction('start-open', 'start-open')} disabled={!!acting || market.open_status === 'accepting'}
            className="bg-green-900/40 text-green-300 border border-green-700/30 px-2 py-1 rounded text-xs disabled:opacity-30">
            {acting === 'start-open' ? '…' : 'START'}
          </button>
        </div>
      </div>

      {/* Close status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-sm">Close:</span>
          <StatusBadge status={market.close_status} />
        </div>
        <div className="flex gap-2">
          <button onClick={() => doAction('stop-close',  'stop-close')}  disabled={!!acting || market.close_status === 'stopped'}
            className="bg-red-900/40 text-red-300 border border-red-700/30 px-2 py-1 rounded text-xs disabled:opacity-30">
            {acting === 'stop-close' ? '…' : 'STOP'}
          </button>
          <button onClick={() => doAction('start-close', 'start-close')} disabled={!!acting || market.close_status === 'accepting'}
            className="bg-green-900/40 text-green-300 border border-green-700/30 px-2 py-1 rounded text-xs disabled:opacity-30">
            {acting === 'start-close' ? '…' : 'START'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Markets() {
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  function fetchMarkets() {
    api.get('/markets')
      .then(({ data }) => { setMarkets(data); setError(''); })
      .catch(() => setError('Failed to load markets'))
      .finally(() => setLoading(false));
  }

  useEffect(fetchMarkets, []);

  return (
    <BossLayout>
      <h1 className="text-xl font-bold text-gold mb-6">Markets</h1>
      {error   && <div className="bg-red-900/30 border border-red-500/40 text-red-300 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}
      {loading ? (
        <div className="flex justify-center py-20 text-gold">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {markets.map((m) => <MarketCard key={m.id} market={m} onUpdated={fetchMarkets} />)}
        </div>
      )}
    </BossLayout>
  );
}
