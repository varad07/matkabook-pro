import { useState, useEffect } from 'react';
import BossLayout from '../../components/BossLayout';
import api from '../../utils/api';

const EMPTY_FORM = { broker_code: '', name: '', mobile: '', username: '', password: '' };

function BrokerModal({ broker, onClose, onSaved }) {
  const isEdit = !!broker;
  const [form, setForm] = useState(
    isEdit ? { broker_code: broker.broker_code, name: broker.name, mobile: broker.mobile || '' } : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');

  function setF(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleSave() {
    setSaving(true); setErr('');
    try {
      if (isEdit) await api.put(`/brokers/${broker.id}`, form);
      else        await api.post('/brokers', form);
      onSaved(); onClose();
    } catch (e) { setErr(e.response?.data?.error || 'Save failed'); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="bg-card border border-gold/30 rounded-2xl w-full max-w-md p-6">
        <div className="flex justify-between mb-5">
          <h3 className="text-gold font-bold">{isEdit ? 'Edit Broker' : 'New Broker'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        {err && <p className="text-red-400 text-sm mb-3">{err}</p>}
        <div className="space-y-3">
          {[
            { key: 'broker_code', label: 'Broker Code', disabled: isEdit },
            { key: 'name',        label: 'Name' },
            { key: 'mobile',      label: 'Mobile' },
            ...(!isEdit ? [
              { key: 'username', label: 'Username' },
              { key: 'password', label: 'Password', type: 'password' },
            ] : []),
          ].map(({ key, label, disabled, type }) => (
            <div key={key}>
              <label className="block text-gray-400 text-xs uppercase mb-1">{label}</label>
              <input
                type={type || 'text'} value={form[key] || ''} disabled={disabled}
                onChange={(e) => setF(key, e.target.value)}
                className="w-full bg-midcard border border-gold/20 text-white rounded-lg px-3 py-2 text-sm focus:border-gold focus:outline-none disabled:opacity-40"
              />
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-300 text-sm">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2 rounded-lg bg-gold text-black font-bold text-sm disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ResetPwModal({ broker, onClose }) {
  const [pw,      setPw]      = useState('');
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState('');
  const [success, setSuccess] = useState('');

  async function handleReset() {
    if (!pw) return;
    setSaving(true); setErr(''); setSuccess('');
    try {
      await api.put(`/brokers/${broker.id}/reset-password`, { password: pw });
      setSuccess('Password reset successfully!');
      setPw('');
    } catch (e) { setErr(e.response?.data?.error || 'Reset failed'); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="bg-card border border-gold/30 rounded-2xl w-full max-w-sm p-6">
        <div className="flex justify-between mb-4">
          <h3 className="text-gold font-bold">Reset Password — {broker.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        {err     && <p className="text-red-400 text-sm mb-3">{err}</p>}
        {success && <p className="text-green-400 text-sm mb-3">{success}</p>}
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password"
          className="w-full bg-midcard border border-gold/20 text-white rounded-lg px-3 py-2 text-sm mb-4 focus:border-gold focus:outline-none" />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-300 text-sm">Close</button>
          <button onClick={handleReset} disabled={saving || !pw} className="flex-1 py-2 rounded-lg bg-gold text-black font-bold text-sm disabled:opacity-50">
            {saving ? 'Resetting…' : 'Reset'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Brokers() {
  const [brokers,   setBrokers]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [editBroker,setEditBroker]= useState(null);
  const [showCreate,setShowCreate]= useState(false);
  const [resetBrkr, setResetBrkr] = useState(null);
  const [toggling,  setToggling]  = useState(null);

  function fetchBrokers() {
    setLoading(true);
    api.get('/brokers')
      .then(({ data }) => { setBrokers(data); setError(''); })
      .catch(() => setError('Failed to load brokers'))
      .finally(() => setLoading(false));
  }

  useEffect(fetchBrokers, []);

  async function toggleStatus(broker) {
    setToggling(broker.id);
    try { await api.put(`/brokers/${broker.id}/disable`); fetchBrokers(); }
    catch (e) { alert(e.response?.data?.error || 'Toggle failed'); }
    finally { setToggling(null); }
  }

  return (
    <BossLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold text-gold">Brokers</h1>
        <button onClick={() => setShowCreate(true)}
          className="bg-gold hover:bg-darkgold text-black font-bold px-4 py-2 rounded-lg text-sm">
          + New Broker
        </button>
      </div>

      {error && <div className="bg-red-900/30 border border-red-500/40 text-red-300 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-20 text-gold">Loading…</div>
      ) : brokers.length === 0 ? (
        <div className="text-center text-gray-500 py-20">No brokers found</div>
      ) : (
        <div className="bg-card border border-gold/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-midcard">
                <tr>
                  {['Code','Name','Username','Mobile','Status','Actions'].map((h) => (
                    <th key={h} className="text-gold text-left px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {brokers.map((b, i) => (
                  <tr key={b.id} className={`border-t border-gold/5 ${i % 2 === 0 ? 'bg-dark/20' : ''}`}>
                    <td className="px-4 py-3 font-mono font-bold text-white">{b.broker_code}</td>
                    <td className="px-4 py-3 text-white">{b.name}</td>
                    <td className="px-4 py-3 text-gray-400">{b.username}</td>
                    <td className="px-4 py-3 text-gray-400">{b.mobile || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        b.is_active
                          ? 'bg-green-900/40 text-green-400 border border-green-500/30'
                          : 'bg-red-900/40 text-red-400 border border-red-500/30'
                      }`}>
                        {b.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        <button onClick={() => setEditBroker(b)}
                          className="bg-blue-900/50 text-blue-300 border border-blue-700/40 px-2 py-1 rounded text-xs">Edit</button>
                        <button onClick={() => toggleStatus(b)} disabled={toggling === b.id}
                          className={`px-2 py-1 rounded text-xs border ${
                            b.is_active
                              ? 'bg-red-900/50 text-red-300 border-red-700/40'
                              : 'bg-green-900/50 text-green-300 border-green-700/40'
                          } disabled:opacity-40`}>
                          {toggling === b.id ? '…' : b.is_active ? 'Disable' : 'Enable'}
                        </button>
                        <button onClick={() => setResetBrkr(b)}
                          className="bg-yellow-900/50 text-yellow-300 border border-yellow-700/40 px-2 py-1 rounded text-xs">Reset Pwd</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreate  && <BrokerModal onClose={() => setShowCreate(false)}  onSaved={fetchBrokers} />}
      {editBroker  && <BrokerModal broker={editBroker} onClose={() => setEditBroker(null)} onSaved={fetchBrokers} />}
      {resetBrkr   && <ResetPwModal broker={resetBrkr} onClose={() => setResetBrkr(null)} />}
    </BossLayout>
  );
}
