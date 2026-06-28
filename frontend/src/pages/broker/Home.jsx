import { useNavigate } from 'react-router-dom';
import BrokerLayout from '../../components/BrokerLayout';
import { useAuth } from '../../context/AuthContext';
import { todayISO } from '../../utils/format';

const ACTIONS = [
  { icon: '📝', label: 'Submit Entry',  path: '/broker/submit',     bg: 'from-gold/20 to-yellow-900/20', border: 'border-gold/30' },
  { icon: '📋', label: 'My Entries',    path: '/broker/entries',    bg: 'from-blue-900/30 to-blue-900/10',  border: 'border-blue-500/30' },
  { icon: '🎟', label: 'My Tokens',     path: '/broker/tokens',     bg: 'from-purple-900/30 to-purple-900/10', border: 'border-purple-500/30' },
  { icon: '💰', label: 'Settlement',    path: '/broker/settlement', bg: 'from-green-900/30 to-green-900/10',   border: 'border-green-500/30' },
];

function clock() {
  return new Date().toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export default function BrokerHome() {
  const { user }  = useAuth();
  const navigate  = useNavigate();
  const today     = todayISO();

  return (
    <BrokerLayout>
      {/* Welcome */}
      <div className="mb-6">
        <p className="text-gray-400 text-sm">Welcome back,</p>
        <h1 className="text-2xl font-bold text-gold capitalize">{user?.username || 'Broker'}</h1>
        <p className="text-gray-500 text-sm mt-1">{today} · IST</p>
      </div>

      {/* 2×2 Action grid */}
      <div className="grid grid-cols-2 gap-3">
        {ACTIONS.map((action) => (
          <button
            key={action.path}
            onClick={() => navigate(action.path)}
            className={`
              bg-gradient-to-br ${action.bg} border ${action.border}
              rounded-2xl p-5 flex flex-col items-center justify-center gap-3
              min-h-[130px] active:scale-95 transition-transform
              hover:brightness-110
            `}
          >
            <span className="text-4xl">{action.icon}</span>
            <span className="text-white font-semibold text-sm text-center leading-tight">{action.label}</span>
          </button>
        ))}
      </div>

      {/* Quick tips */}
      <div className="mt-6 bg-card border border-gold/10 rounded-xl p-4">
        <p className="text-gold text-xs font-bold uppercase mb-2">Today's Summary</p>
        <p className="text-gray-500 text-sm">Tap Submit Entry to place bets or view your tokens and settlement below.</p>
      </div>
    </BrokerLayout>
  );
}
