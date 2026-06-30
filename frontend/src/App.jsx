import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

import Login from './pages/Login';

import BossDashboard      from './pages/boss/Dashboard';
import BossEntries        from './pages/boss/Entries';
import BossResults        from './pages/boss/Results';
import BossSettlements    from './pages/boss/Settlements';
import BossBrokers        from './pages/boss/Brokers';
import BossMarkets        from './pages/boss/Markets';
import BossRates          from './pages/boss/Rates';
import BossReports        from './pages/boss/Reports';
import BossSearch         from './pages/boss/Search';
import BossAudit          from './pages/boss/Audit';
import BossEmployees      from './pages/boss/Employees';
import BossSubmitForBroker from './pages/boss/SubmitForBroker';

import BrokerHome       from './pages/broker/Home';
import BrokerSubmit     from './pages/broker/Submit';
import BrokerEntries    from './pages/broker/Entries';
import BrokerTokens     from './pages/broker/Tokens';
import BrokerSettlement from './pages/broker/Settlement';

// Accessible by boss OR employee
function ProtectedBoss({ children }) {
  const { token, user } = useAuth();
  if (!token) return <Navigate to="/" replace />;
  if (user?.role !== 'boss' && user?.role !== 'employee') return <Navigate to="/broker/home" replace />;
  return children;
}

// Boss-only routes (employee gets redirected to dashboard)
function ProtectedBossOnly({ children }) {
  const { token, user } = useAuth();
  if (!token) return <Navigate to="/" replace />;
  if (user?.role !== 'boss') return <Navigate to="/boss/dashboard" replace />;
  return children;
}

function ProtectedBroker({ children }) {
  const { token, user } = useAuth();
  if (!token) return <Navigate to="/" replace />;
  if (user?.role !== 'broker') return <Navigate to="/boss/dashboard" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />

      <Route path="/boss/dashboard"         element={<ProtectedBoss><BossDashboard /></ProtectedBoss>} />
      <Route path="/boss/submit-for-broker" element={<ProtectedBoss><BossSubmitForBroker /></ProtectedBoss>} />
      <Route path="/boss/entries"           element={<ProtectedBoss><BossEntries /></ProtectedBoss>} />
      <Route path="/boss/results"           element={<ProtectedBoss><BossResults /></ProtectedBoss>} />
      <Route path="/boss/settlements"       element={<ProtectedBoss><BossSettlements /></ProtectedBoss>} />
      <Route path="/boss/brokers"           element={<ProtectedBoss><BossBrokers /></ProtectedBoss>} />
      <Route path="/boss/markets"           element={<ProtectedBoss><BossMarkets /></ProtectedBoss>} />
      <Route path="/boss/rates"             element={<ProtectedBoss><BossRates /></ProtectedBoss>} />
      <Route path="/boss/reports"           element={<ProtectedBoss><BossReports /></ProtectedBoss>} />
      <Route path="/boss/search"            element={<ProtectedBoss><BossSearch /></ProtectedBoss>} />
      <Route path="/boss/audit"             element={<ProtectedBoss><BossAudit /></ProtectedBoss>} />
      <Route path="/boss/employees"         element={<ProtectedBossOnly><BossEmployees /></ProtectedBossOnly>} />

      <Route path="/broker/home"       element={<ProtectedBroker><BrokerHome /></ProtectedBroker>} />
      <Route path="/broker/submit"     element={<ProtectedBroker><BrokerSubmit /></ProtectedBroker>} />
      <Route path="/broker/entries"    element={<ProtectedBroker><BrokerEntries /></ProtectedBroker>} />
      <Route path="/broker/tokens"     element={<ProtectedBroker><BrokerTokens /></ProtectedBroker>} />
      <Route path="/broker/settlement" element={<ProtectedBroker><BrokerSettlement /></ProtectedBroker>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
