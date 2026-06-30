import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const { login } = useAuth();
  const navigate  = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { username, password });
      login(data.token, data.user);
      if (data.user.role === 'boss' || data.user.role === 'employee') {
        navigate('/boss/dashboard', { replace: true });
      } else {
        navigate('/broker/home', { replace: true });
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-dark flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-card rounded-2xl shadow-2xl p-8 border border-gold/20">

        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🎯</div>
          <h1 className="text-2xl font-bold text-gold tracking-wide">MatkaBook Pro</h1>
          <p className="text-gray-400 text-sm mt-1">Secure Entry Management</p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-900/40 border border-red-500/50 text-red-300 text-sm rounded-lg px-4 py-3 mb-5">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-gray-400 text-xs font-semibold mb-1 uppercase tracking-wider">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              placeholder="Enter username"
              className="w-full bg-midcard border border-gold/20 rounded-lg px-4 py-3 text-white
                         placeholder-gray-600 focus:outline-none focus:border-gold
                         transition-colors duration-200 text-sm"
            />
          </div>

          <div>
            <label className="block text-gray-400 text-xs font-semibold mb-1 uppercase tracking-wider">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="Enter password"
              className="w-full bg-midcard border border-gold/20 rounded-lg px-4 py-3 text-white
                         placeholder-gray-600 focus:outline-none focus:border-gold
                         transition-colors duration-200 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gold hover:bg-darkgold disabled:opacity-50 disabled:cursor-not-allowed
                       text-black font-bold py-3 rounded-lg transition-colors duration-200
                       text-sm tracking-wide uppercase mt-2"
          >
            {loading ? 'Signing in…' : 'Login'}
          </button>
        </form>

        <p className="text-center text-gray-600 text-xs mt-6">
          MatkaBook Pro &copy; 2024
        </p>
      </div>
    </div>
  );
}
