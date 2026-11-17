import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Welcome from './pages/Welcome.jsx';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Inbox from './pages/Inbox.jsx';
import Accounts from './pages/Accounts.jsx';
import ClientView from './pages/ClientView.jsx';
import { Spinner } from './components/Bits.jsx';

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner label="Loading your workspace" />;
  if (!user) return <Welcome />;
  if (user.role === 'client') return <Routes><Route path="*" element={<ClientView />} /></Routes>;
  return (
    <Routes>
      <Route path="/client" element={<ClientView />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/connect" element={<Accounts onboarding />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
