import { useState, useEffect, useRef, useCallback } from 'react';
import socket from '../../utils/socket';
import BossLayout from '../../components/BossLayout';
import api from '../../utils/api';
import { calcAnk, todayISO } from '../../utils/format';

export default function Results() {
  const [markets,   setMarkets]   = useState([]);
  const [marketId,  setMarketId]  = useState('');
  const [date,      setDate]      = useState(todayISO());
  const [result,    setResult]    = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState('');

  const [openPana,  setOpenPana]  = useState('');
  const [closePana, setClosePana] = useState('');
  const [submitting,setSubmitting]= useState(false);

  useEffect(() => {
    api.get('/markets').then(({ data }) => {
      setMarkets(data.filter((m) => m.is_active));
      if (data.length) setMarketId(data[0].id);
    }).catch(() => {});
  }, []);

  const fetchResult = useCallback(() => {
    if (!marketId || !date) return;
    setLoading(true); setError(''); setResult(null);
    api.get('/results', { params: { market_id: marketId, date } })
      .then(({ data }) => setResult(data[0] || null))
      .catch(() => setError('Failed to fetch result'))
      .finally(() => setLoading(false));
  }, [marketId, date]);

  const fetchResultRef = useRef(fetchResult);
  fetchResultRef.current = fetchResult;

  useEffect(() => { fetchResult(); }, [fetchResult]);

  useEffect(() => {
    function onOpenDeclared(data) {
      console.log('open_declared:', data);
      fetchResultRef.current();
    }
    function onCloseDeclared(data) {
      console.log('close_declared:', data);
      fetchResultRef.current();
      setSuccess('Settlement generated for all brokers!');
    }
    socket.on('open_declared',  onOpenDeclared);
    socket.on('close_declared', onCloseDeclared);
    return () => {
      socket.off('open_declared',  onOpenDeclared);
      socket.off('close_declared', onCloseDeclared);
    };
  }, []);

  async function declareOpen() {
    if (!/^\d{3}$/.test(openPana)) return setError('Open pana must be exactly 3 digits');
    setSubmitting(true); setError(''); setSuccess('');
    try {
      const { data } = await api.post('/results/declare-open', { market_id: marketId, date, open_pana: openPana });
      setResult(data);
      setSuccess('Open declared successfully!');
      setOpenPana('');
    } catch (e) { setError(e.response?.data?.error || 'Failed to declare open'); }
    finally { setSubmitting(false); }
  }

  async function declareClose() {
    if (!/^\d{3}$/.test(closePana)) return setError('Close pana must be exactly 3 digits');
    if (!result?.id) return;
    setSubmitting(true); setError(''); setSuccess('');
    try {
      const { data } = await api.post('/results/declare-close', { result_id: result.id, close_pana: closePana });
      setResult((r) => ({ ...r, ...data, status: 'complete' }));
      // re-fetch to get full result
      const fresh = await api.get('/results', { params: { market_id: marketId, date } });
      setResult(fresh.data[0] || null);
      setSuccess('Close declared! Settlements generated.');
      setClosePana('');
    } catch (e) { setError(e.response?.data?.error || 'Failed to declare close'); }
    finally { setSubmitting(false); }
  }

  async function correctResult() {
    if (!result?.id) return;
    const pana = prompt('Enter corrected Open Pana (or leave blank):');
    if (pana === null) return;
    setError(''); setSuccess('');
    try {
      const body = {};
      if (pana && /^\d{3}$/.test(pana)) body.open_pana = pana;
      await api.put(`/results/${result.id}/correct`, body);
      setSuccess('Result corrected');
      const fresh = await api.get('/results', { params: { market_id: marketId, date } });
      setResult(fresh.data[0] || null);
    } catch (e) { setError(e.response?.data?.error || 'Correction failed'); }
  }

  const openAnk  = calcAnk(openPana);
  const closeAnk = calcAnk(closePana);
  const jodiPrev = openAnk !== '' && closeAnk !== '' ? `${openAnk}${closeAnk}` : '';

  const marketName = markets.find((m) => m.id === marketId)?.name || '';

  return (
    <BossLayout>
      <h1 className="text-xl font-bold text-gold mb-4">Results</h1>

      {/* Selectors */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <select value={marketId} onChange={(e) => setMarketId(e.target.value)}
          className="bg-card border border-gold/20 text-white rounded-lg px-3 py-2 text-sm focus:border-gold focus:outline-none flex-1">
          {markets.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="bg-card border border-gold/20 text-white rounded-lg px-3 py-2 text-sm focus:border-gold focus:outline-none" />
      </div>

      {error   && <div className="bg-red-900/30 border border-red-500/40 text-red-300 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}
      {success && <div className="bg-green-900/30 border border-green-500/40 text-green-300 px-4 py-3 rounded-lg mb-4 text-sm">{success}</div>}

      {loading ? (
        <div className="flex justify-center py-20 text-gold">Loading…</div>
      ) : (
        <div className="max-w-lg">

          {/* COMPLETE result */}
          {result?.status === 'complete' && (
            <div className="bg-card border border-gold/30 rounded-2xl p-6 text-center">
              <p className="text-gray-400 text-sm mb-2">{marketName} — {date}</p>
              <div className="text-4xl font-bold text-gold font-mono mb-4">
                {result.open_pana}-{result.jodi}-{result.close_pana}
              </div>
              <div className="flex justify-center gap-6 text-sm mb-4">
                <div className="text-center">
                  <p className="text-gray-400">Open Ank</p>
                  <p className="text-white font-bold text-2xl">{result.open_ank}</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-400">Jodi</p>
                  <p className="text-gold font-bold text-2xl">{result.jodi}</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-400">Close Ank</p>
                  <p className="text-white font-bold text-2xl">{result.close_ank}</p>
                </div>
              </div>
              <span className="bg-green-900/40 text-green-400 border border-green-500/30 px-3 py-1 rounded-full text-xs font-bold">
                ✓ COMPLETE
              </span>
              {result.correction_count > 0 && (
                <p className="text-yellow-400 text-xs mt-2">Corrected {result.correction_count} time(s)</p>
              )}
            </div>
          )}

          {/* OPEN DECLARED — waiting for close */}
          {result?.status === 'open_declared' && (
            <div className="space-y-4">
              <div className="bg-card border border-gold/20 rounded-2xl p-5">
                <p className="text-gray-400 text-xs mb-3">STEP 1 — COMPLETE</p>
                <div className="flex gap-6">
                  <div>
                    <p className="text-gray-500 text-xs">Open Pana</p>
                    <p className="text-white font-mono font-bold text-2xl">{result.open_pana}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Open Ank</p>
                    <p className="text-gold font-bold text-2xl">{result.open_ank}</p>
                  </div>
                </div>
                <button onClick={correctResult} className="mt-3 text-yellow-400 text-xs hover:underline">
                  ✎ Correct Open
                </button>
              </div>

              <div className="bg-card border border-gold/30 rounded-2xl p-5">
                <p className="text-gray-400 text-xs mb-4">STEP 2 — DECLARE CLOSE</p>
                <label className="block text-gray-400 text-xs mb-1 uppercase">Close Pana</label>
                <input
                  type="text" maxLength={3} value={closePana}
                  onChange={(e) => setClosePana(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 578"
                  className="w-full bg-midcard border border-gold/20 text-white rounded-lg px-4 py-3 text-xl font-mono mb-3 focus:border-gold focus:outline-none tracking-widest"
                />
                {closePana.length === 3 && (
                  <div className="flex gap-4 mb-4 text-sm">
                    <div className="bg-midcard rounded-lg px-3 py-2 text-center flex-1">
                      <p className="text-gray-500 text-xs">Close Ank</p>
                      <p className="text-gold font-bold text-xl">{closeAnk}</p>
                    </div>
                    <div className="bg-midcard rounded-lg px-3 py-2 text-center flex-1">
                      <p className="text-gray-500 text-xs">Jodi</p>
                      <p className="text-gold font-bold text-xl">{jodiPrev}</p>
                    </div>
                  </div>
                )}
                <button
                  onClick={declareClose}
                  disabled={submitting || closePana.length !== 3}
                  className="w-full bg-gold hover:bg-darkgold disabled:opacity-40 text-black font-bold py-4 rounded-xl text-lg transition-colors"
                >
                  {submitting ? 'Declaring…' : '🎯 DECLARE CLOSE'}
                </button>
              </div>
            </div>
          )}

          {/* NO RESULT YET */}
          {(!result || result.status === 'pending') && (
            <div className="bg-card border border-gold/30 rounded-2xl p-5">
              <p className="text-gray-400 text-xs mb-4">STEP 1 — DECLARE OPEN</p>
              <label className="block text-gray-400 text-xs mb-1 uppercase">Open Pana</label>
              <input
                type="text" maxLength={3} value={openPana}
                onChange={(e) => setOpenPana(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 123"
                className="w-full bg-midcard border border-gold/20 text-white rounded-lg px-4 py-3 text-xl font-mono mb-3 focus:border-gold focus:outline-none tracking-widest"
              />
              {openPana.length === 3 && (
                <div className="bg-midcard rounded-lg px-4 py-3 mb-4 flex items-center gap-3">
                  <span className="text-gray-400 text-sm">Open Ank:</span>
                  <span className="text-gold font-bold text-2xl">{openAnk}</span>
                </div>
              )}
              <button
                onClick={declareOpen}
                disabled={submitting || openPana.length !== 3}
                className="w-full bg-gold hover:bg-darkgold disabled:opacity-40 text-black font-bold py-4 rounded-xl text-lg transition-colors"
              >
                {submitting ? 'Declaring…' : '🎯 DECLARE OPEN'}
              </button>
            </div>
          )}
        </div>
      )}
    </BossLayout>
  );
}
