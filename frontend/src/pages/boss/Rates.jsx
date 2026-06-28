import { useState, useEffect } from 'react';
import BossLayout from '../../components/BossLayout';
import api from '../../utils/api';
import { formatTime } from '../../utils/format';

const FIXED_RATES = [
  { bet_type: 'single_ank', rate: 9,  label: 'Single Ank',  fixed: true  },
  { bet_type: 'jodi',       rate: 90, label: 'Jodi',         fixed: true  },
];

export default function Rates() {
  const [rates,     setRates]     = useState([]);
  const [panaBase,  setPanaBase]  = useState(150);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    api.get('/rates')
      .then(({ data }) => {
        setRates(data);
        const pana = data.find((r) => r.bet_type === 'single_pana');
        if (pana) { setPanaBase(parseFloat(pana.rate)); setUpdatedAt(pana.updated_at); }
      })
      .catch(() => {
        // fallback to default rates if no /api/rates endpoint
        setRates([]);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true); setError(''); setSuccess('');
    try {
      await api.put('/rates/pana-base', { rate: panaBase });
      setSuccess('Rates updated successfully!');
      setUpdatedAt(new Date().toISOString());
    } catch (e) {
      setError(e.response?.data?.error || 'Save failed');
    } finally { setSaving(false); }
  }

  const single = panaBase;
  const double = panaBase * 2;
  const triple = panaBase * 4;

  return (
    <BossLayout>
      <h1 className="text-xl font-bold text-gold mb-6">Payout Rates</h1>

      {error   && <div className="bg-red-900/30 border border-red-500/40 text-red-300 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}
      {success && <div className="bg-green-900/30 border border-green-500/40 text-green-300 px-4 py-3 rounded-lg mb-4 text-sm">{success}</div>}

      {loading ? (
        <div className="flex justify-center py-20 text-gold">Loading…</div>
      ) : (
        <div className="max-w-lg space-y-4">
          {/* Fixed rates */}
          <div className="bg-card border border-gold/10 rounded-2xl overflow-hidden">
            <div className="bg-midcard px-5 py-3 border-b border-gold/10">
              <p className="text-gold font-bold text-sm">Fixed Rates</p>
              <p className="text-gray-500 text-xs">Cannot be changed</p>
            </div>
            <div className="divide-y divide-gold/5">
              {FIXED_RATES.map((r) => (
                <div key={r.bet_type} className="flex justify-between items-center px-5 py-4">
                  <span className="text-white font-medium">{r.label}</span>
                  <span className="text-gold font-bold text-xl">{r.rate}x</span>
                </div>
              ))}
            </div>
          </div>

          {/* Editable pana base */}
          <div className="bg-card border border-gold/30 rounded-2xl overflow-hidden">
            <div className="bg-midcard px-5 py-3 border-b border-gold/10">
              <p className="text-gold font-bold text-sm">Pana Base Rate</p>
              <p className="text-gray-500 text-xs">Affects all pana payouts</p>
            </div>
            <div className="px-5 py-5">
              <label className="block text-gray-400 text-xs uppercase mb-2">Base Multiplier</label>
              <div className="flex items-center gap-3 mb-5">
                <input
                  type="number" min="1" value={panaBase}
                  onChange={(e) => setPanaBase(parseFloat(e.target.value) || 0)}
                  className="w-32 bg-midcard border border-gold/30 text-white rounded-lg px-3 py-2 text-xl font-bold text-center focus:border-gold focus:outline-none"
                />
                <span className="text-gray-500">x stake</span>
              </div>

              {/* Live preview */}
              <div className="bg-midcard rounded-xl p-4 mb-5 space-y-3">
                <p className="text-gray-400 text-xs uppercase font-bold mb-3">Live Preview</p>
                {[
                  { label: 'Single Pana (3 diff digits)', value: single, mult: '×1' },
                  { label: 'Double Pana (2 same + 1)',    value: double, mult: '×2' },
                  { label: 'Triple Pana (all same)',      value: triple, mult: '×4' },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between items-center">
                    <div>
                      <p className="text-white text-sm">{item.label}</p>
                      <p className="text-gray-500 text-xs">base {item.mult}</p>
                    </div>
                    <span className="text-gold font-bold text-lg">{item.value}x</span>
                  </div>
                ))}
              </div>

              <button onClick={handleSave} disabled={saving}
                className="w-full bg-gold hover:bg-darkgold disabled:opacity-40 text-black font-bold py-3 rounded-xl transition-colors">
                {saving ? 'Saving…' : '💾 Save Rates'}
              </button>

              {updatedAt && (
                <p className="text-gray-600 text-xs text-center mt-3">
                  Last updated: {formatTime(updatedAt)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </BossLayout>
  );
}
