import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { path: '/broker/home',       icon: '🏠', label: 'Home'       },
  { path: '/broker/entries',    icon: '📋', label: 'Entries'    },
  { path: '/broker/tokens',     icon: '🎟', label: 'Tokens'     },
  { path: '/broker/settlement', icon: '💰', label: 'Settlement' },
];

export default function BrokerLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() { logout(); navigate('/'); }

  return (
    <div className="min-h-screen bg-dark flex flex-col">
      {/* Top header */}
      <header className="bg-card border-b border-gold/10 px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <div>
          <p className="text-gold font-bold text-sm">🎯 MatkaBook Pro</p>
          <p className="text-gray-500 text-xs">{user?.username || 'Broker'}</p>
        </div>
        <button
          onClick={handleLogout}
          className="bg-red-900/30 border border-red-500/30 text-red-400 px-3 py-1.5 rounded-lg text-xs font-semibold"
        >
          Logout
        </button>
      </header>

      {/* Page content — bottom padding so content isn't hidden by nav */}
      <main className="flex-1 p-4 pb-24 overflow-auto">
        {children}
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-gold/10 z-20">
        <div className="grid grid-cols-4">
          {NAV.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-3 gap-0.5 transition-colors ${
                  isActive ? 'text-gold' : 'text-gray-500'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className="text-2xl">{item.icon}</span>
                  <span className={`text-xs font-medium ${isActive ? 'text-gold' : 'text-gray-500'}`}>
                    {item.label}
                  </span>
                  {/* Gold indicator bar */}
                  <span className={`h-0.5 w-8 rounded-full transition-all ${isActive ? 'bg-gold' : 'bg-transparent'}`} />
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
