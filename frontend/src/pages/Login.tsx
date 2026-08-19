import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, Sparkles, UserCheck } from 'lucide-react';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      login(data.token, data.user);
      
      // Redirect based on role
      if (data.user.role === 'ADMIN') navigate('/admin');
      else if (data.user.role === 'DOCTOR') navigate('/doctor');
      else navigate('/patient');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = async (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('password123');
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: demoEmail, password: 'password123' }),
      });
      const data = await res.json();
      if (res.ok) {
        login(data.token, data.user);
        if (data.user.role === 'ADMIN') navigate('/admin');
        else if (data.user.role === 'DOCTOR') navigate('/doctor');
        else navigate('/patient');
      } else {
        setError(data.error || 'Demo login failed');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '440px', margin: '60px auto', padding: '0 20px' }} className="animate-fade-in">
      <div className="glass-panel" style={{ padding: '32px' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-indigo))',
            width: '50px',
            height: '50px',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px'
          }}>
            <LogIn size={26} color="white" />
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'white' }}>Welcome Back</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            Sign in to access your healthcare portal
          </p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(244, 63, 94, 0.15)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            color: '#fca5a5',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '13px',
            marginBottom: '20px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
              Email Address
            </label>
            <input
              type="email"
              className="input-field"
              placeholder="user@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
              Password
            </label>
            <input
              type="password"
              className="input-field"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}>
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div style={{ margin: '24px 0 16px', borderTop: '1px solid var(--border-color)', position: 'relative', textAlign: 'center' }}>
          <span style={{
            position: 'absolute',
            top: '-10px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#131b2e',
            padding: '0 10px',
            fontSize: '11px',
            color: 'var(--text-muted)'
          }}>
            QUICK DEMO LOGINS
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button onClick={() => quickLogin('patient@example.com')} className="btn-secondary" style={{ width: '100%', justifyContent: 'space-between', fontSize: '13px' }}>
            <span>Demo Patient</span>
            <UserCheck size={14} color="var(--accent-emerald)" />
          </button>
          <button onClick={() => quickLogin('dr.smith@healthcare.org')} className="btn-secondary" style={{ width: '100%', justifyContent: 'space-between', fontSize: '13px' }}>
            <span>Demo Doctor (Dr. Smith)</span>
            <UserCheck size={14} color="var(--accent-cyan)" />
          </button>
          <button onClick={() => quickLogin('admin@healthcare.org')} className="btn-secondary" style={{ width: '100%', justifyContent: 'space-between', fontSize: '13px' }}>
            <span>Demo Admin</span>
            <UserCheck size={14} color="var(--accent-purple)" />
          </button>
        </div>

        <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          Don't have an account? <Link to="/register" style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontWeight: 600 }}>Register now</Link>
        </p>
      </div>
    </div>
  );
};
