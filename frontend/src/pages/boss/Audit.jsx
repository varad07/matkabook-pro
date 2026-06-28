import { useState, useEffect } from 'react';
import BossLayout from '../../components/BossLayout';
import api from '../../utils/api';
import { formatTime, todayISO } from '../../utils/format';

const ACTION_COLORS = {
  CREATE_ENTRY:    'text-blue-400   border-blue-500/30  bg-blue-900/20',
  CANCEL_ENTRY:    'text-red-400    border-red-500/30   bg-red-900/20',
  EDIT_ENTRY_ITEM: 'text-red-400    border-red-500/30   bg-red-900/20',
  DECLARE_OPEN:    'text-gold       border-yellow-500/30 bg-yellow-900/20',
  DECLARE_CLOSE:   'text-gold       border-yellow-500/30 bg-yellow-900/20',
  CORRECT_RESULT:  'text-orange-400 border-orange-500/30 bg-orange-900/20',
  CREATE_BROKER:   'text-green-400  border-green-500/30 bg-green-900/20',
  UPDATE_BROKER:   'text-green-400  border-green-500/30 bg-green-900/20',
  DISABLE_BROKER:  'text-red-400    border-red-500/30   bg-red-900/20',
  ENABLE_BROKER:   'text-green-400  border-green-500/30 bg-green-900/20',
  RESET_BROKER_PASSWORD: 'text-yellow-400 border-yellow-500/30 bg-yellow-900/20',
  LOGIN:           'text-gray-400   border-gray-500/30  bg-gray-900/20',
};

function colorFor(action) {
  if (ACTION_COLORS[action]) return ACTION_COLORS[action];
  if (action?.includes('ENTRY'))      return 'text-blue-400  border-blue-500/30  bg-blue-900/20';
  if (action?.includes('RESULT') || action?.includes('DECLARE')) return 'text-gold border-yellow-500/30 bg-yellow-900/20';
  if (action?.includes('SETTLEMENT')) return 'text-green-400 border-green-500/30 bg-green-900/20';
  return 'text-gray-400 border-gray-500/30 bg-gray-900/20';
}

export default function AuditLogs() {
  const [logs,      setLogs]      = useState([]);
  const [users,     setUsers]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [filters,   setFilters]   = useState({ from: todayISO(), to: todayISO(), user_id: '', action: '' });
  const [expanded,  setExpanded]  = useState(null);

  function setF(k, v) { setFilters((f) => ({ ...f, [k]: v })); }

  function fetchLogs() {
    setLoading(true);
    const params = {};
    if (filters.from)    params.from    = filters.from;
    if (filters.to)      params.to      = filters.to;
    if (filters.user_id) params.user_id = filters.user_id;
    if (filters.action)  params.action  = filters.action;
    api.get('/audit', { params })
      .then(({ data }) => { setLogs(data.logs || []); setError(''); })
      .catch(() => setError('Failed to load audit logs'))
      .finally(() => setLoading(false));
  }

  useEffect(fetchLogs, []);
  useEffect(() => {
    // collect unique users from logs for filter dropdown
    const map = {};
    logs.forEach((l) => { if (l.username) map[l.user_id] = l.username; });
    setUsers(Object.entries(map).map(([id, username]) => ({ id, username })));
  }, [logs]);

  return (
    <BossLayout>
      <h1 className="text-xl font-bold text-gold mb-4">Audit Logs</h1>

      {/* Filters */}
      <div className="bg-card border border-gold/10 rounded-xl p-4 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <div>
            <label className="block text-gray-400 text-xs uppercase mb-1">From</label>
            <input type="date" value={filters.from} onChange={(e) => setF('from', e.target.value)}
              className="w-full bg-midcard border border-gold/20 text-white rounded-lg px-3 py-2 text-sm focus:border-gold focus:outline-none" />
          </div>
          <div>
            <label className="block text-gray-400 text-xs uppercase mb-1">To</label>
            <input type="date" value={filters.to} onChange={(e) => setF('to', e.target.value)}
              className="w-full bg-midcard border border-gold/20 text-white rounded-lg px-3 py-2 text-sm focus:border-gold focus:outline-none" />
          </div>
          <div>
            <label className="block text-gray-400 text-xs uppercase mb-1">User</label>
            <select value={filters.user_id} onChange={(e) => setF('user_id', e.target.value)}
              className="w-full bg-midcard border border-gold/20 text-white rounded-lg px-3 py-2 text-sm focus:border-gold focus:outline-none">
              <option value="">All Users</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.username}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-gray-400 text-xs uppercase mb-1">Action</label>
            <input value={filters.action} onChange={(e) => setF('action', e.target.value)} placeholder="e.g. DECLARE"
              className="w-full bg-midcard border border-gold/20 text-white rounded-lg px-3 py-2 text-sm focus:border-gold focus:outline-none" />
          </div>
        </div>
        <button onClick={fetchLogs} disabled={loading}
          className="w-full bg-gold hover:bg-darkgold disabled:opacity-40 text-black font-bold py-2 rounded-lg text-sm transition-colors">
          {loading ? 'Loading…' : '🔍 Apply Filters'}
        </button>
      </div>

      {error && <div className="bg-red-900/30 border border-red-500/40 text-red-300 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-20 text-gold">Loading…</div>
      ) : logs.length === 0 ? (
        <div className="text-center text-gray-500 py-20">No audit logs found</div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const color = colorFor(log.action);
            const isOpen = expanded === log.id;
            return (
              <div key={log.id}
                className={`border rounded-xl px-4 py-3 cursor-pointer transition-all ${color}`}
                onClick={() => setExpanded(isOpen ? null : log.id)}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                  <span className="text-xs opacity-60 whitespace-nowrap">{formatTime(log.created_at)}</span>
                  <span className="font-bold text-sm font-mono">{log.action}</span>
                  <span className="opacity-70 text-xs">by <span className="font-semibold">{log.username || 'system'}</span></span>
                  {log.table_name && <span className="opacity-50 text-xs hidden sm:inline">→ {log.table_name}</span>}
                  <span className="sm:ml-auto text-xs opacity-50">{isOpen ? '▲' : '▼'}</span>
                </div>

                {isOpen && (log.details || log.new_values || log.old_values) && (
                  <div className="mt-3 pt-3 border-t border-current/20 text-xs font-mono space-y-2">
                    {log.details && (
                      <div>
                        <p className="opacity-50 mb-1">Details:</p>
                        <pre className="whitespace-pre-wrap break-all opacity-80">
                          {typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2)}
                        </pre>
                      </div>
                    )}
                    {log.old_values && (
                      <div>
                        <p className="opacity-50 mb-1">Before:</p>
                        <pre className="whitespace-pre-wrap break-all opacity-70">
                          {typeof log.old_values === 'string' ? log.old_values : JSON.stringify(log.old_values, null, 2)}
                        </pre>
                      </div>
                    )}
                    {log.new_values && (
                      <div>
                        <p className="opacity-50 mb-1">After:</p>
                        <pre className="whitespace-pre-wrap break-all opacity-80">
                          {typeof log.new_values === 'string' ? log.new_values : JSON.stringify(log.new_values, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </BossLayout>
  );
}
