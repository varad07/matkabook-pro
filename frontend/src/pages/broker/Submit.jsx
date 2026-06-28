import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BrokerLayout from '../../components/BrokerLayout';
import TokenSuccess from './Token';
import api from '../../utils/api';
import { formatAmount } from '../../utils/format';

function detectPanaType(p) {
  if (p[0] === p[1] && p[1] === p[2]) return 'Triple Pana';
  if (p[0] === p[1] || p[1] === p[2] || p[0] === p[2]) return 'Double Pana';
  return 'Single Pana';
}
function getISTHHMM() {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date());
}
function isCutoffPassed(cutoff) {
  if (!cutoff) return false;
  return getISTHHMM() >= cutoff.slice(0, 5);
}

const SESSION_BET_TYPES = {
  open:  [
    { id: 'single_ank', label: 'Single Ank', hint: '0–9',      maxLen: 1 },
    { id: 'pana',       label: 'Open Pana',  hint: '3 digits', maxLen: 3 },
  ],
  close: [
    { id: 'single_ank', label: 'Single Ank', hint: '0–9',      maxLen: 1 },
    { id: 'jodi',       label: 'Jodi',       hint: '00–99',    maxLen: 2 },
    { id: 'pana',       label: 'Close Pana', hint: '3 digits', maxLen: 3 },
  ],
};

const BET_LABEL = { single_ank: 'Single Ank', jodi: 'Jodi', pana: 'Pana' };

export default function BrokerSubmit() {
  const navigate = useNavigate();

  const [step,         setStep]         = useState(1);
  const [markets,      setMarkets]      = useState([]);
  const [loadingMkt,   setLoadingMkt]   = useState(true);
  const [selectedMkt,  setSelectedMkt]  = useState(null);
  const [selectedSess, setSelectedSess] = useState('');
  const [betType,      setBetType]      = useState('single_ank');
  const [number,       setNumber]       = useState('');
  const [amount,       setAmount]       = useState('');
  const [numError,     setNumError]     = useState('');
  const [entryList,    setEntryList]    = useState([]);
  const [submitting,   setSubmitting]   = useState(false);
  const [submitError,  setSubmitError]  = useState('');
  const [successData,  setSuccessData]  = useState(null);
  const [todayResults, setTodayResults] = useState({});

  // Pana family state
  const [panaMode,        setPanaMode]        = useState('single'); // 'single' | 'sp' | 'dp'
  const [selectedAnk,     setSelectedAnk]     = useState(null);
  const [ankMembers,      setAnkMembers]       = useState([]);
  const [ankSelected,     setAnkSelected]     = useState(new Set());
  const [ankAmount,       setAnkAmount]       = useState('');
  const [ankLoading,      setAnkLoading]      = useState(false);
  const [showFamPanel,    setShowFamPanel]    = useState(false);
  const [famData,         setFamData]         = useState(null); // auto-loaded after 3 digits
  const [famSelected,     setFamSelected]     = useState(new Set());
  const [famAmount,       setFamAmount]       = useState('');
  const [famLoading,      setFamLoading]      = useState(false);

  // Derived — needed in effects above and in render
  const isPana = betType === 'pana';

  useEffect(() => {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    Promise.all([api.get('/markets'), api.get('/results', { params: { date: today } })])
      .then(([mktRes, resRes]) => {
        setMarkets((mktRes.data || []).filter(m => m.is_active !== false));
        const map = {};
        (resRes.data || []).forEach(r => { map[r.market_id] = r; });
        setTodayResults(map);
      })
      .catch(() => {})
      .finally(() => setLoadingMkt(false));
  }, []);

  useEffect(() => {
    setNumber(''); setNumError('');
    if (betType !== 'pana') {
      setPanaMode('single'); resetFamilyState();
    }
  }, [betType]);

  // Auto-fetch family when 3-digit pana typed
  useEffect(() => {
    if (!isPana || panaMode !== 'single' || number.length !== 3 || validateNumber('pana', number)) {
      setFamData(null); setShowFamPanel(false); return;
    }
    let cancelled = false;
    setFamLoading(true);
    api.get(`/entries/family/${number}`)
      .then(({ data }) => { if (!cancelled) { setFamData(data); setFamSelected(new Set(data.members || [])); } })
      .catch(() => { if (!cancelled) setFamData(null); })
      .finally(() => { if (!cancelled) setFamLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [number, betType, panaMode]);

  function resetFamilyState() {
    setSelectedAnk(null); setAnkMembers([]); setAnkSelected(new Set()); setAnkAmount('');
    setShowFamPanel(false); setFamData(null); setFamSelected(new Set()); setFamAmount('');
  }

  function switchPanaMode(mode) {
    setPanaMode(mode); resetFamilyState();
  }

  function validateNumber(bt, num) {
    if (!num) return 'Enter a number';
    if (bt === 'single_ank' && !/^[0-9]$/.test(num))  return 'Enter a single digit 0–9';
    if (bt === 'jodi'       && !/^\d{2}$/.test(num))   return 'Enter exactly 2 digits';
    if (bt === 'pana'       && !/^\d{3}$/.test(num))   return 'Enter exactly 3 digits';
    return '';
  }

  // Family is auto-fetched via useEffect — no manual trigger needed

  function toggleFamPana(p) {
    setFamSelected(prev => { const s = new Set(prev); s.has(p) ? s.delete(p) : s.add(p); return s; });
  }

  function addFamilyToList() {
    if (!famData || !famData.members || famSelected.size === 0) return;
    if (!famAmount || parseFloat(famAmount) <= 0) return;
    setEntryList(prev => [...prev, {
      _group: 'family', family_key: famData.input_pana || number,
      panas: [...famSelected], amount: parseFloat(famAmount),
    }]);
    setShowFamPanel(false); setFamData(null); setFamSelected(new Set()); setFamAmount(''); setNumber('');
  }

  // ── SP / DP family by ank ─────────────────────────────────────
  async function selectAnk(ank) {
    setSelectedAnk(ank); setAnkMembers([]); setAnkSelected(new Set()); setAnkAmount('');
    setAnkLoading(true);
    try {
      const endpoint = panaMode === 'sp' ? `/entries/sp/${ank}` : `/entries/dp/${ank}`;
      const { data } = await api.get(endpoint);
      setAnkMembers(data.members || []);
      setAnkSelected(new Set(data.members || []));
    } catch { setAnkMembers([]); } finally { setAnkLoading(false); }
  }

  function toggleAnkPana(p) {
    setAnkSelected(prev => { const s = new Set(prev); s.has(p) ? s.delete(p) : s.add(p); return s; });
  }

  function addAnkFamilyToList() {
    if (ankSelected.size === 0 || !ankAmount || parseFloat(ankAmount) <= 0) return;
    setEntryList(prev => [...prev, {
      _group: panaMode, ank: selectedAnk,
      panas: [...ankSelected], amount: parseFloat(ankAmount),
    }]);
    setSelectedAnk(null); setAnkMembers([]); setAnkSelected(new Set()); setAnkAmount('');
  }

  // ── Normal single entry ───────────────────────────────────────
  function handleAddEntry() {
    const err = validateNumber(betType, number);
    if (err) { setNumError(err); return; }
    if (!amount || parseFloat(amount) <= 0) { setNumError('Enter a valid amount'); return; }
    setNumError('');
    setEntryList(prev => [...prev, { _group: 'single', bet_type: betType, number, amount: parseFloat(amount) }]);
    setNumber(''); setAmount(''); setShowFamPanel(false); setFamData(null);
  }

  function removeEntry(i) { setEntryList(prev => prev.filter((_, idx) => idx !== i)); }

  const totalAmount = entryList.reduce((s, e) => {
    if (e._group === 'single') return s + e.amount;
    return s + (e.panas.length * e.amount);
  }, 0);

  async function handleSubmit() {
    if (entryList.length === 0) { setSubmitError('Add at least one entry'); return; }
    if (!window.confirm(`Submit ${entryList.length} bet group(s) for ${selectedMkt.name}?\nTotal: Rs.${totalAmount}`)) return;
    setSubmitting(true); setSubmitError('');
    try {
      // Expand family groups to individual entries
      const expanded = [];
      const familyMeta = [];
      for (const item of entryList) {
        if (item._group === 'single') {
          expanded.push({ bet_type: item.bet_type, number: item.number, amount: item.amount });
        } else {
          for (const pana of item.panas) {
            expanded.push({ bet_type: 'pana', number: pana, amount: item.amount });
          }
          familyMeta.push({ type: item._group, ank: item.ank, family_key: item.family_key, count: item.panas.length });
        }
      }
      const notes = familyMeta.length > 0
        ? JSON.stringify({ has_family: true, groups: familyMeta })
        : null;

      const { data } = await api.post('/entries', {
        market_id: selectedMkt.id,
        session:   selectedSess,
        entries:   expanded,
        notes,
      });
      setSuccessData(data);
      setStep(4);
    } catch (e) {
      setSubmitError(e.response?.data?.error || 'Submission failed. Try again.');
    } finally { setSubmitting(false); }
  }

  function resetAll() {
    setStep(1); setSelectedMkt(null); setSelectedSess('');
    setBetType('single_ank'); setNumber(''); setAmount('');
    setEntryList([]); setSubmitError(''); setSuccessData(null);
    resetFamilyState(); setPanaMode('single');
  }

  if (step === 4 && successData) {
    return (
      <BrokerLayout>
        <TokenSuccess data={successData} onDone={() => navigate('/broker/home')} />
      </BrokerLayout>
    );
  }

  // ── STEP 1: Market selection ──────────────────────────────────
  if (step === 1) {
    return (
      <BrokerLayout>
        <h1 className="text-xl font-bold text-gold mb-2">Submit Entry</h1>
        <p className="text-gray-400 text-sm mb-5">Step 1 of 3 — Select Market</p>
        {loadingMkt ? (
          <div className="flex justify-center py-20 text-gold">Loading markets…</div>
        ) : markets.length === 0 ? (
          <div className="text-center text-gray-500 py-20">No active markets</div>
        ) : (
          <div className="space-y-3">
            {markets.map((m) => {
              const mktResult      = todayResults[m.id];
              const openClosed     = mktResult?.status === 'complete' || mktResult?.status === 'open_declared'
                                  || isCutoffPassed(m.open_time)  || m.open_status  === 'stopped';
              const closeClosed    = mktResult?.status === 'complete'
                                  || isCutoffPassed(m.close_time) || m.close_status === 'stopped';
              const fullyClosed    = openClosed && closeClosed;
              return (
                <button key={m.id} onClick={() => { if (!fullyClosed) { setSelectedMkt(m); setStep(2); } }}
                  disabled={fullyClosed}
                  className={`w-full text-left p-4 rounded-2xl border transition-all ${
                    fullyClosed ? 'bg-midcard/40 border-gray-700 opacity-50 cursor-not-allowed'
                                : 'bg-card border-gold/10 hover:border-gold/50 active:scale-98'
                  }`}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-white font-bold text-base">{m.name}</p>
                      <p className="text-gray-500 text-xs">{m.code}</p>
                    </div>
                    {mktResult?.status === 'complete' ? (
                      <span className="bg-red-900/40 text-red-400 text-xs font-bold px-2 py-1 rounded-full">RESULT DECLARED</span>
                    ) : fullyClosed ? (
                      <span className="bg-red-900/40 text-red-400 text-xs font-bold px-2 py-1 rounded-full">CLOSED</span>
                    ) : null}
                  </div>
                  <div className="flex gap-3 text-xs">
                    <span className={`px-2 py-0.5 rounded-full font-semibold ${openClosed ? 'bg-gray-700 text-gray-400' : 'bg-green-900/40 text-green-400'}`}>
                      Open {m.open_time?.slice(0, 5)} {openClosed ? '✕' : '✓'}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full font-semibold ${closeClosed ? 'bg-gray-700 text-gray-400' : 'bg-blue-900/40 text-blue-400'}`}>
                      Close {m.close_time?.slice(0, 5)} {closeClosed ? '✕' : '✓'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </BrokerLayout>
    );
  }

  // ── STEP 2: Session selection ─────────────────────────────────
  if (step === 2) {
    const mktResult = todayResults[selectedMkt?.id];
    const openOk    = !isCutoffPassed(selectedMkt?.open_time)  && selectedMkt?.open_status  !== 'stopped'
                    && mktResult?.status !== 'complete' && mktResult?.status !== 'open_declared';
    const closeOk   = !isCutoffPassed(selectedMkt?.close_time) && selectedMkt?.close_status !== 'stopped'
                    && mktResult?.status !== 'complete';
    return (
      <BrokerLayout>
        <button onClick={() => setStep(1)} className="text-gray-400 text-sm mb-4 flex items-center gap-1">← Back</button>
        <h1 className="text-xl font-bold text-gold mb-1">Submit Entry</h1>
        <p className="text-gray-400 text-sm mb-1">Step 2 of 3 — Choose Session</p>
        <p className="text-gray-500 text-xs mb-6">{selectedMkt?.name}</p>
        <div className="space-y-4">
          {[
            { id: 'open',  label: 'OPEN Session',  sub: `Cutoff: ${selectedMkt?.open_time?.slice(0,5) || '—'}`,  types: 'Single Ank, Open Pana',          ok: openOk,  color: 'border-green-500/40 bg-green-900/10' },
            { id: 'close', label: 'CLOSE Session', sub: `Cutoff: ${selectedMkt?.close_time?.slice(0,5) || '—'}`, types: 'Single Ank, Jodi, Close Pana',    ok: closeOk, color: 'border-blue-500/40 bg-blue-900/10' },
          ].map(s => (
            <button key={s.id} disabled={!s.ok}
              onClick={() => { setSelectedSess(s.id); setBetType('single_ank'); setStep(3); }}
              className={`w-full text-left p-5 rounded-2xl border transition-all ${s.ok ? `${s.color} hover:brightness-110 active:scale-95` : 'border-gray-700 bg-midcard/30 opacity-40 cursor-not-allowed'}`}>
              <p className="text-white font-bold text-lg mb-1">{s.label}</p>
              <p className="text-gray-400 text-sm mb-2">{s.sub}</p>
              <p className="text-gray-500 text-xs">{s.types}</p>
              {!s.ok && <p className="text-red-400 text-xs mt-2 font-bold">CLOSED</p>}
            </button>
          ))}
        </div>
      </BrokerLayout>
    );
  }

  // ── STEP 3: Add entries ───────────────────────────────────────
  const betTypes   = SESSION_BET_TYPES[selectedSess] || [];
  const currentBet = betTypes.find(b => b.id === betType) || betTypes[0];
  const panaType   = isPana && number.length === 3 ? detectPanaType(number) : '';

  return (
    <BrokerLayout>
      <button onClick={() => setStep(2)} className="text-gray-400 text-sm mb-4 flex items-center gap-1">← Back</button>
      <h1 className="text-xl font-bold text-gold mb-1">Submit Entry</h1>
      <p className="text-gray-400 text-sm mb-1">Step 3 of 3 — Add Bets</p>
      <p className="text-gray-500 text-xs mb-5">
        {selectedMkt?.name} · <span className="capitalize">{selectedSess}</span> session
      </p>

      {/* Bet type selector */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {betTypes.map(bt => (
          <button key={bt.id} onClick={() => setBetType(bt.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              betType === bt.id ? 'bg-gold text-black' : 'bg-card border border-gold/20 text-gray-300'
            }`}>
            {bt.label}
          </button>
        ))}
      </div>

      {/* Pana sub-mode tabs */}
      {isPana && (
        <div className="flex gap-2 mb-4">
          {[
            { id: 'single', label: 'Single Entry' },
            { id: 'sp',     label: 'SP Family' },
            { id: 'dp',     label: 'DP Family' },
          ].map(m => (
            <button key={m.id} onClick={() => switchPanaMode(m.id)}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${
                panaMode === m.id ? 'bg-gold text-black' : 'bg-card border border-gold/20 text-gray-300'
              }`}>
              {m.label}
            </button>
          ))}
        </div>
      )}

      {/* Single Entry panel */}
      {(!isPana || panaMode === 'single') && (
        <div className="bg-card border border-gold/10 rounded-2xl p-4 mb-4">
          <div className="mb-3">
            <label className="block text-gray-400 text-xs uppercase mb-2">
              Number <span className="text-gray-600">({currentBet?.hint})</span>
            </label>
            <input
              type={isPana ? 'text' : 'tel'}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={currentBet?.maxLen}
              value={number}
              onChange={e => {
                const v = e.target.value.replace(/\D/g, '').slice(0, currentBet?.maxLen);
                setNumber(v); setNumError(v ? validateNumber(betType, v) : '');
                setShowFamPanel(false);
              }}
              placeholder={currentBet?.hint}
              className={`w-full bg-midcard border rounded-xl px-4 py-4 text-white text-2xl font-mono font-bold text-center focus:outline-none ${
                numError ? 'border-red-500/50' : 'border-gold/20 focus:border-gold'
              }`}
            />
            {isPana && number.length === 3 && !numError && (
              <p className="text-green-400 text-xs mt-1 text-center font-semibold">{panaType} ✓</p>
            )}
            {numError && <p className="text-red-400 text-xs mt-1 text-center">{numError}</p>}
          </div>

          {/* View Family button — auto-appears when family loaded */}
          {isPana && number.length === 3 && !numError && famLoading && (
            <p className="text-center text-gray-500 text-xs mb-3">Loading family…</p>
          )}
          {isPana && number.length === 3 && !numError && !famLoading && famData && famData.members && famData.members.length > 0 && !showFamPanel && (
            <button onClick={() => setShowFamPanel(true)}
              className="w-full mb-3 py-2.5 rounded-xl border border-gold/40 text-gold text-sm font-bold bg-gold/10 hover:bg-gold/20 active:scale-95 transition-all">
              View Family ({famData.members.length} panas) →
            </button>
          )}
          {isPana && number.length === 3 && !numError && !famLoading && famData && famData.members && famData.members.length === 0 && (
            <p className="text-center text-gray-600 text-xs mb-3">No family found for this pana</p>
          )}

          {/* Family chip panel for single entry */}
          {showFamPanel && famData && famData.members && famData.members.length > 0 && (
            <div className="mb-4 bg-midcard rounded-xl p-3 border border-gold/20">
              <div className="flex justify-between items-center mb-3">
                <p className="text-gold text-xs font-bold">
                  Family of {String(famData.input_pana || number).padStart(3,'0')} — {famData.members.length} panas
                </p>
                <button onClick={() => setShowFamPanel(false)}
                  className="text-gray-500 text-xs hover:text-white">✕ Close</button>
              </div>
              {famData.pool && (
                <p className="text-gray-600 text-xs mb-2">Pool: [{famData.pool.join(', ')}]</p>
              )}
              <div className="flex flex-wrap gap-2 mb-3">
                {famData.members.map(p => (
                  <button key={p} onClick={() => toggleFamPana(p)}
                    className={`px-3 py-2 rounded-lg font-mono font-bold text-sm transition-colors ${
                      famSelected.has(p) ? 'bg-gold text-black' : 'bg-card border border-gold/20 text-gray-400 hover:border-gold/40'
                    }`}>
                    {String(p).padStart(3,'0')}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mb-3">
                <button onClick={() => setFamSelected(new Set(famData.members))}
                  className="text-xs text-gold border border-gold/30 px-3 py-1.5 rounded-lg">Select All</button>
                <button onClick={() => setFamSelected(new Set())}
                  className="text-xs text-gray-400 border border-gray-600 px-3 py-1.5 rounded-lg">Deselect All</button>
              </div>
              <div className="mb-3">
                <label className="text-gray-400 text-xs uppercase">Amount per pana</label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">Rs.</span>
                  <input type="tel" inputMode="numeric" pattern="[0-9]*" value={famAmount}
                    onChange={e => setFamAmount(e.target.value.replace(/\D/g, ''))}
                    placeholder="0"
                    className="w-full bg-card border border-gold/20 rounded-lg pl-10 pr-3 py-2 text-white font-bold focus:border-gold focus:outline-none" />
                </div>
                <p className="text-gray-500 text-xs mt-1">
                  {famSelected.size} panas × Rs.{famAmount || 0} = <span className="text-gold font-bold">Rs.{famSelected.size * (parseFloat(famAmount) || 0)}</span>
                </p>
              </div>
              <button onClick={addFamilyToList}
                disabled={famSelected.size === 0 || !famAmount || parseFloat(famAmount) <= 0}
                className="w-full py-2.5 rounded-xl bg-gold/20 border border-gold/40 text-gold font-bold text-sm disabled:opacity-40 hover:bg-gold/30">
                ADD FAMILY TO LIST ({famSelected.size} panas)
              </button>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-gray-400 text-xs uppercase mb-2">Amount (Rs.)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">Rs.</span>
              <input type="tel" inputMode="numeric" pattern="[0-9]*" value={amount}
                onChange={e => setAmount(e.target.value.replace(/\D/g, ''))} placeholder="0"
                className="w-full bg-midcard border border-gold/20 rounded-xl pl-12 pr-4 py-4 text-white text-2xl font-bold focus:border-gold focus:outline-none" />
            </div>
            <div className="flex gap-2 mt-2">
              {[100, 200, 500, 1000].map(v => (
                <button key={v} onClick={() => setAmount(String(v))}
                  className="flex-1 bg-midcard border border-gold/10 text-gray-400 text-xs py-1.5 rounded-lg hover:text-gold hover:border-gold/30">
                  {v}
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleAddEntry}
            className="w-full bg-gold/20 border border-gold/40 hover:bg-gold/30 text-gold font-bold py-4 rounded-xl text-base transition-colors active:scale-95">
            + ADD TO LIST
          </button>
        </div>
      )}

      {/* SP / DP Family by Ank panel */}
      {isPana && (panaMode === 'sp' || panaMode === 'dp') && (
        <div className="bg-card border border-gold/10 rounded-2xl p-4 mb-4">
          <p className="text-gray-400 text-xs uppercase font-bold mb-3">
            {panaMode === 'sp' ? 'Single Pana Family by Ank' : 'Double Pana Family by Ank'}
          </p>

          {/* Ank buttons 0-9 */}
          <div className="grid grid-cols-5 gap-2 mb-4">
            {[0,1,2,3,4,5,6,7,8,9].map(a => (
              <button key={a} onClick={() => selectAnk(String(a))}
                className={`py-3 rounded-xl font-bold text-lg transition-colors ${
                  selectedAnk === String(a) ? 'bg-gold text-black' : 'bg-midcard border border-gold/20 text-white hover:border-gold/50'
                }`}>
                {a}
              </button>
            ))}
          </div>

          {ankLoading && <div className="text-center text-gold text-sm py-4">Loading panas…</div>}

          {ankMembers.length > 0 && !ankLoading && (
            <>
              <p className="text-gray-500 text-xs mb-2">Ank {selectedAnk} — {ankMembers.length} panas</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {ankMembers.map(p => (
                  <button key={p} onClick={() => toggleAnkPana(p)}
                    className={`px-3 py-2 rounded-lg font-mono font-bold text-sm transition-colors ${
                      ankSelected.has(p) ? 'bg-gold text-black' : 'bg-midcard border border-gold/20 text-gray-400 hover:border-gold/40'
                    }`}>
                    {p}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 mb-3">
                <button onClick={() => setAnkSelected(new Set(ankMembers))}
                  className="text-xs text-gold border border-gold/30 px-3 py-1.5 rounded-lg">Select All</button>
                <button onClick={() => setAnkSelected(new Set())}
                  className="text-xs text-gray-400 border border-gray-600 px-3 py-1.5 rounded-lg">Deselect All</button>
              </div>

              <div className="mb-3">
                <label className="text-gray-400 text-xs uppercase">Amount per pana</label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">Rs.</span>
                  <input type="tel" inputMode="numeric" pattern="[0-9]*" value={ankAmount}
                    onChange={e => setAnkAmount(e.target.value.replace(/\D/g, ''))} placeholder="0"
                    className="w-full bg-midcard border border-gold/20 rounded-lg pl-10 pr-3 py-2 text-white font-bold focus:border-gold focus:outline-none" />
                </div>
                <p className="text-gray-500 text-xs mt-1">
                  {ankSelected.size} panas × Rs.{ankAmount || 0} = <span className="text-gold font-bold">Rs.{ankSelected.size * (parseFloat(ankAmount) || 0)}</span>
                </p>
              </div>

              <button onClick={addAnkFamilyToList}
                disabled={ankSelected.size === 0 || !ankAmount || parseFloat(ankAmount) <= 0}
                className="w-full py-3 rounded-xl bg-gold/20 border border-gold/40 text-gold font-bold text-sm disabled:opacity-40 hover:bg-gold/30 active:scale-95">
                ADD {panaMode.toUpperCase()} FAMILY TO LIST ({ankSelected.size} panas)
              </button>
            </>
          )}

          {!selectedAnk && !ankLoading && (
            <p className="text-center text-gray-600 text-sm py-4">Select an ank digit above</p>
          )}
        </div>
      )}

      {/* Entry list */}
      {entryList.length > 0 && (
        <div className="bg-card border border-gold/10 rounded-2xl overflow-hidden mb-4">
          <div className="px-4 py-2 bg-midcard flex justify-between items-center">
            <span className="text-gray-400 text-xs uppercase font-bold">Your Bets ({entryList.length})</span>
            <span className="text-gold font-bold text-sm">{formatAmount(totalAmount)}</span>
          </div>
          {entryList.map((e, i) => (
            <div key={i} className={`flex justify-between items-start px-4 py-3 ${i > 0 ? 'border-t border-gold/5' : ''}`}>
              <div className="flex items-start gap-3">
                <button onClick={() => removeEntry(i)}
                  className="text-red-400 text-xs bg-red-900/20 w-6 h-6 rounded-full flex items-center justify-center mt-0.5">✕</button>
                <div>
                  {e._group === 'single' ? (
                    <>
                      <p className="text-white font-mono font-bold">{e.number}</p>
                      <p className="text-gray-500 text-xs">{BET_LABEL[e.bet_type] || e.bet_type}</p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                          e._group === 'sp' ? 'bg-blue-900/30 text-blue-400' :
                          e._group === 'dp' ? 'bg-purple-900/30 text-purple-400' :
                          'bg-gold/20 text-gold'
                        }`}>
                          {e._group === 'sp' ? 'SP FAM' : e._group === 'dp' ? 'DP FAM' : 'FAMILY'}
                        </span>
                        <span className="text-white font-semibold text-sm">
                          {e._group === 'sp' ? `Ank ${e.ank} - Single Pana` :
                           e._group === 'dp' ? `Ank ${e.ank} - Double Pana` :
                           `${e.family_key} Family`}
                        </span>
                      </div>
                      <p className="text-gray-500 text-xs">{e.panas.length} panas × Rs.{e.amount}</p>
                      <p className="text-gray-600 text-xs mt-0.5">{e.panas.slice(0,6).join(', ')}{e.panas.length > 6 ? '…' : ''}</p>
                    </>
                  )}
                </div>
              </div>
              <p className="text-gold font-semibold">{formatAmount(e._group === 'single' ? e.amount : e.panas.length * e.amount)}</p>
            </div>
          ))}
          <div className="px-4 py-3 border-t border-gold/20 flex justify-between items-center">
            <span className="text-gray-300 font-semibold">Total</span>
            <span className="text-gold font-bold text-xl">{formatAmount(totalAmount)}</span>
          </div>
        </div>
      )}

      {submitError && (
        <div className="bg-red-900/30 border border-red-500/40 text-red-300 px-4 py-3 rounded-lg mb-4 text-sm">{submitError}</div>
      )}

      {entryList.length > 0 && (
        <button onClick={handleSubmit} disabled={submitting}
          className="w-full bg-gold hover:bg-darkgold disabled:opacity-40 text-black font-bold py-5 rounded-2xl text-xl transition-colors active:scale-95">
          {submitting ? 'Submitting…' : `SUBMIT ALL (${formatAmount(totalAmount)})`}
        </button>
      )}
    </BrokerLayout>
  );
}
