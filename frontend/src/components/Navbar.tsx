import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Activity, LogOut, Shield, Stethoscope, User as UserIcon } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav style={{
      background: 'rgba(11, 15, 25, 0.85)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border-color)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      padding: '14px 28px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }}>
      <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
          width: '38px',
          height: '38px',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)'
        }}>
          <Activity size={22} color="white" />
        </div>
        <div>
          <span style={{ fontSize: '18px', fontWeight: 700, color: 'white', letterSpacing: '-0.3px' }}>
            Pulse<span style={{ color: 'var(--accent-blue)' }}>Care</span> AI
          </span>
          <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1 }}>
            Appointment & Follow-up Platform
          </span>
        </div>
      </Link>

      {user ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(255, 255, 255, 0.05)',
            padding: '6px 14px',
            borderRadius: '9999px',
            border: '1px solid var(--border-color)',
            fontSize: '13px'
          }}>
            {user.role === 'ADMIN' && <Shield size={16} color="var(--accent-purple)" />}
            {user.role === 'DOCTOR' && <Stethoscope size={16} color="var(--accent-cyan)" />}
            {user.role === 'PATIENT' && <UserIcon size={16} color="var(--accent-emerald)" />}
            <span style={{ fontWeight: 600, color: 'white' }}>{user.name}</span>
            <span style={{
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '4px',
              background: 'rgba(255, 255, 255, 0.1)',
              color: 'var(--text-secondary)',
              fontWeight: 700
            }}>
              {user.role}
            </span>
          </div>

          <button onClick={handleLogout} className="btn-secondary" style={{ padding: '8px 14px', fontSize: '13px' }}>
            <LogOut size={15} />
            Logout
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '12px' }}>
          <Link to="/login" className="btn-secondary">Login</Link>
          <Link to="/register" className="btn-primary">Get Started</Link>
        </div>
      )}
    </nav>
  );
};
