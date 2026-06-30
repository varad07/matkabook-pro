import { useState, useEffect } from 'react';
import BossLayout from '../../components/BossLayout';
import api from '../../utils/api';
import { formatTime } from '../../utils/format';

const EMPTY_FORM = { name: '', mobile: '', username: '', password: '' };

function EmployeeModal({ employee, onClose, onSaved }) {
  const isEdit = !!employee;
  const [form, setForm] = useState(
    isEdit ? { name: employee.name, mobile: employee.mobile || '' } : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');

  function setF(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleSave() {
    setSaving(true); setErr('');
    try {
      if (isEdit) await api.put(`/employees/${employee.id}`, form);
      else        await api.post('/employees', form);
      onSaved(); onClose();
    } catch (e) { setErr(e.response?.data?.error || 'Save failed'); }
    finally { setSaving(false); }
  }

  const fields = isEdit
    ? [
        { key: 'name',   label: 'Name' },
        { key: 'mobile', label: 'Mobile' },
      ]
    : [
        { key: 'name',     label: 'Name' },
        { key: 'mobile',   label: 'Mobile' },
        { key: 'username', label: 'Username' },
        { key: 'password', label: 'Password', type: 'password' },
      ];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="bg-card border border-gold/30 rounded-2xl w-full max-w-md p-6">
        <div className="flex justify-between mb-5">
          <h3 className="text-gold font-bold">{isEdit ? 'Edit Employee' : 'New Employee'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        {err && <p className="text-red-400 text-sm mb-3">{err}</p>}
        <div className="space-y-3">
          {fields.map(({ key, label, type }) => (
            <div key={key}>
              <label className="block text-gray-400 text-xs uppercase mb-1">{label}</label>
              <input
                type={type || 'text'} value={form[key] || ''}
                onChange={(e) => setF(key, e.target.value)}
                className="w-full bg-midcard border border-gold/20 text-white rounded-lg px-3 py-2 text-sm focus:border-gold focus:outline-none"
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

function ResetPwModal({ employee, onClose }) {
  const [pw,      setPw]      = useState('');
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState('');
  const [success, setSuccess] = useState('');

  async function handleReset() {
    if (!pw) return;
    setSaving(true); setErr(''); setSuccess('');
    try {
      await api.put(`/employees/${employee.id}/reset-password`, { new_password: pw });
      setSuccess('Password reset successfully!');
      setPw('');
    } catch (e) { setErr(e.response?.data?.error || 'Reset failed'); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="bg-card border border-gold/30 rounded-2xl w-full max-w-sm p-6">
        <div className="flex justify-between mb-4">
          <h3 className="text-gold font-bold">Reset Password — {employee.name}</h3>
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

export default function Employees() {
  const [employees,  setEmployees]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editEmp,    setEditEmp]    = useState(null);
  const [resetEmp,   setResetEmp]   = useState(null);
  const [toggling,   setToggling]   = useState(null);

  function fetchEmployees() {
    setLoading(true);
    api.get('/employees')
      .then(({ data }) => { setEmployees(data); setError(''); })
      .catch(() => setError('Failed to load employees'))
      .finally(() => setLoading(false));
  }

  useEffect(fetchEmployees, []);

  async function toggleStatus(emp) {
    setToggling(emp.id);
    try { await api.put(`/employees/${emp.id}/disable`); fetchEmployees(); }
    catch (e) { alert(e.response?.data?.error || 'Toggle failed'); }
    finally { setToggling(null); }
  }

  return (
    <BossLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold text-gold">Manage Employees</h1>
        <button onClick={() => setShowCreate(true)}
          className="bg-gold hover:bg-darkgold text-black font-bold px-4 py-2 rounded-lg text-sm">
          + Create Employee
        </button>
      </div>

      {error && <div className="bg-red-900/30 border border-red-500/40 text-red-300 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-20 text-gold">Loading…</div>
      ) : employees.length === 0 ? (
        <div className="text-center text-gray-500 py-20">No employees yet. Create one to get started.</div>
      ) : (
        <div className="bg-card border border-gold/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-midcard">
                <tr>
                  {['Name', 'Username', 'Mobile', 'Status', 'Created', 'Actions'].map((h) => (
                    <th key={h} className="text-gold text-left px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map((emp, i) => (
                  <tr key={emp.id} className={`border-t border-gold/5 ${i % 2 === 0 ? 'bg-dark/20' : ''}`}>
                    <td className="px-4 py-3 text-white font-semibold">{emp.name}</td>
                    <td className="px-4 py-3 text-gray-400 font-mono">{emp.username}</td>
                    <td className="px-4 py-3 text-gray-400">{emp.mobile || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        emp.is_active
                          ? 'bg-green-900/40 text-green-400 border border-green-500/30'
                          : 'bg-red-900/40 text-red-400 border border-red-500/30'
                      }`}>
                        {emp.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{formatTime(emp.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        <button onClick={() => setEditEmp(emp)}
                          className="bg-blue-900/50 text-blue-300 border border-blue-700/40 px-2 py-1 rounded text-xs">Edit</button>
                        <button onClick={() => toggleStatus(emp)} disabled={toggling === emp.id}
                          className={`px-2 py-1 rounded text-xs border ${
                            emp.is_active
                              ? 'bg-red-900/50 text-red-300 border-red-700/40'
                              : 'bg-green-900/50 text-green-300 border-green-700/40'
                          } disabled:opacity-40`}>
                          {toggling === emp.id ? '…' : emp.is_active ? 'Disable' : 'Enable'}
                        </button>
                        <button onClick={() => setResetEmp(emp)}
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

      {showCreate && <EmployeeModal onClose={() => setShowCreate(false)} onSaved={fetchEmployees} />}
      {editEmp    && <EmployeeModal employee={editEmp} onClose={() => setEditEmp(null)} onSaved={fetchEmployees} />}
      {resetEmp   && <ResetPwModal employee={resetEmp} onClose={() => setResetEmp(null)} />}
    </BossLayout>
  );
}
