import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { path: '/boss/dashboard',   label: 'Dashboard',  icon: '📊' },
  { path: '/boss/entries',     label: 'Entries',    icon: '📝' },
  { path: '/boss/results',     label: 'Results',    icon: '🎯' },
  { path: '/boss/settlements', label: 'Settlements',icon: '💰' },
  { path: '/boss/brokers',     label: 'Brokers',    icon: '👥' },
  { path: '/boss/markets',     label: 'Markets',    icon: '🏪' },
  { path: '/boss/rates',       label: 'Rates',      icon: '📈' },
  { path: '/boss/reports',     label: 'Reports',    icon: '📋' },
  { path: '/boss/search',      label: 'Search',     icon: '🔍' },
  { path: '/boss/audit',       label: 'Audit Logs', icon: '🔒' },
];

function NavItem({ item, onClick }) {
  return (
    <NavLink
      to={item.path}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-gold/20 text-gold border-l-4 border-gold'
            : 'text-gray-400 hover:text-gold hover:bg-gold/10'
        }`
      }
    >
      <span className="text-lg">{item.icon}</span>
      <span>{item.label}</span>
    </NavLink>
  );
}

export default function BossLayout({ children }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { logout } = useAuth();
  const navigate   = useNavigate();

  function handleLogout() {
    logout();
    navigate('/');
  }

  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="px-4 py-6 border-b border-gold/20">
        <div className="text-gold font-bold text-xl tracking-wide">🎯 MatkaBook Pro</div>
        <div className="text-gray-500 text-xs mt-1">Boss Panel</div>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV.map((item) => (
          <NavItem key={item.path} item={item} onClick={() => setDrawerOpen(false)} />
        ))}
      </nav>
      <div className="p-4 border-t border-gold/20">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium
                     text-red-400 hover:bg-red-900/20 hover:text-red-300 transition-colors"
        >
          <span className="text-lg">🚪</span>
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-dark flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 bg-card border-r border-gold/10 fixed h-full z-20">
        {sidebar}
      </aside>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-card border-r border-gold/10 z-40 md:hidden
                    transform transition-transform duration-300 ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {sidebar}
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col md:ml-56">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-card border-b border-gold/10 sticky top-0 z-20">
          <button
            onClick={() => setDrawerOpen(true)}
            className="text-gold text-2xl"
          >
            ☰
          </button>
          <span className="text-gold font-bold text-sm">🎯 MatkaBook Pro</span>
          <button onClick={handleLogout} className="text-red-400 text-sm">
            Logout
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
