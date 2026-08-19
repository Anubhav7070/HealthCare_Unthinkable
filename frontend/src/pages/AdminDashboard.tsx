import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserPlus, Calendar, ShieldAlert, List, Mail, CheckCircle, AlertCircle, X } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { token } = useAuth();
  const [doctors, setDoctors] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [notificationLogs, setNotificationLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'doctors' | 'appointments' | 'logs'>('doctors');

  // Create Doctor Form Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('password123');
  const [specialisation, setSpecialisation] = useState('General Medicine');
  const [workingHoursStart, setWorkingHoursStart] = useState('09:00');
  const [workingHoursEnd, setWorkingHoursEnd] = useState('17:00');
  const [slotDurationMinutes, setSlotDurationMinutes] = useState('30');
  const [bio, setBio] = useState('');

  // Mark Doctor Leave Modal
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [leaveStart, setLeaveStart] = useState('');
  const [leaveEnd, setLeaveEnd] = useState('');
  const [leaveReason, setLeaveReason] = useState('Admin assigned leave');
  const [leaveNotificationResult, setLeaveNotificationResult] = useState<string | null>(null);

  useEffect(() => {
    fetchDoctors();
    fetchAppointments();
    fetchLogs();
  }, []);

  const fetchDoctors = async () => {
    try {
      const res = await fetch('/api/admin/doctors', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setDoctors(data.doctors || []);
    } catch (err) {
      console.error('Failed to fetch doctors:', err);
    }
  };

  const fetchAppointments = async () => {
    try {
      const res = await fetch('/api/admin/appointments', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setAppointments(data.appointments || []);
    } catch (err) {
      console.error('Failed to fetch appointments:', err);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/admin/logs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setNotificationLogs(data.logs || []);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    }
  };

  const handleCreateDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/doctors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          email,
          password,
          specialisation,
          workingHoursStart,
          workingHoursEnd,
          slotDurationMinutes: parseInt(slotDurationMinutes, 10),
          bio,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert('Doctor profile created successfully!');
        setShowCreateModal(false);
        fetchDoctors();
      } else {
        alert(data.error || 'Failed to create doctor');
      }
    } catch (err: any) {
      alert('Error creating doctor: ' + err.message);
    }
  };

  const handleMarkLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/doctors/leave', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          doctorId: selectedDoctorId,
          startDate: leaveStart,
          endDate: leaveEnd,
          reason: leaveReason,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setLeaveNotificationResult(data.message);
        setTimeout(() => {
          setShowLeaveModal(false);
          setLeaveNotificationResult(null);
        }, 2000);
        fetchDoctors();
        fetchAppointments();
        fetchLogs();
      } else {
        alert(data.error || 'Failed to mark leave');
      }
    } catch (err: any) {
      alert('Error marking doctor leave: ' + err.message);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '30px auto', padding: '0 20px' }}>
      {/* Top Admin Header */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '22px', color: 'white', fontWeight: 700 }}>System Administration Portal</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '2px' }}>
            Manage doctor profiles, leave days, appointments, and notification queues
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            <UserPlus size={16} />
            Create Doctor Profile
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
        <button onClick={() => setActiveTab('doctors')} className={activeTab === 'doctors' ? 'btn-primary' : 'btn-secondary'}>
          <UserPlus size={16} /> Doctor Profiles ({doctors.length})
        </button>
        <button onClick={() => setActiveTab('appointments')} className={activeTab === 'appointments' ? 'btn-primary' : 'btn-secondary'}>
          <List size={16} /> System Appointments ({appointments.length})
        </button>
        <button onClick={() => setActiveTab('logs')} className={activeTab === 'logs' ? 'btn-primary' : 'btn-secondary'}>
          <Mail size={16} /> Notification & Job Logs ({notificationLogs.length})
        </button>
      </div>

      {/* TAB 1: DOCTORS */}
      {activeTab === 'doctors' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
          {doctors.map(doc => (
            <div key={doc.id} className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h4 style={{ fontSize: '18px', color: 'white', fontWeight: 700 }}>{doc.user.name}</h4>
                  <p style={{ color: 'var(--accent-cyan)', fontSize: '13px', fontWeight: 600 }}>{doc.specialisation}</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>{doc.user.email}</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedDoctorId(doc.id);
                    setShowLeaveModal(true);
                  }}
                  className="btn-secondary"
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                >
                  <Calendar size={14} /> Mark Leave
                </button>
              </div>

              <div style={{ marginTop: '16px', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <p><strong>Working Hours:</strong> {doc.workingHoursStart} - {doc.workingHoursEnd}</p>
                <p><strong>Slot Duration:</strong> {doc.slotDurationMinutes} minutes</p>
                <p style={{ marginTop: '4px' }}><strong>Leave Days Recorded:</strong> {doc.leaveDays?.length || 0}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: SYSTEM APPOINTMENTS */}
      {activeTab === 'appointments' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '18px', color: 'white', marginBottom: '16px' }}>Master Appointment Directory</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '10px' }}>Patient</th>
                  <th style={{ padding: '10px' }}>Doctor</th>
                  <th style={{ padding: '10px' }}>Slot Time</th>
                  <th style={{ padding: '10px' }}>Status</th>
                  <th style={{ padding: '10px' }}>Urgency</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map(app => (
                  <tr key={app.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '10px', color: 'white', fontWeight: 600 }}>{app.patient?.name}</td>
                    <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>Dr. {app.doctorProfile?.user?.name}</td>
                    <td style={{ padding: '10px', color: 'var(--text-primary)' }}>{new Date(app.slotStartTime).toLocaleString()}</td>
                    <td style={{ padding: '10px' }}>
                      <span className={`badge-status badge-${app.status}`}>{app.status}</span>
                    </td>
                    <td style={{ padding: '10px' }}>
                      {app.preVisitSummary ? (
                        <span className={`badge-urgency-${app.preVisitSummary.urgency}`}>
                          {app.preVisitSummary.urgency}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>N/A</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: NOTIFICATION LOGS */}
      {activeTab === 'logs' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '18px', color: 'white', marginBottom: '16px' }}>Notification Delivery & Job Queue Logs</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '10px' }}>Recipient</th>
                  <th style={{ padding: '10px' }}>Notification Type</th>
                  <th style={{ padding: '10px' }}>Status</th>
                  <th style={{ padding: '10px' }}>Retries</th>
                  <th style={{ padding: '10px' }}>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {notificationLogs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '10px', color: 'white' }}>{log.recipientEmail}</td>
                    <td style={{ padding: '10px', color: 'var(--accent-cyan)' }}>{log.type}</td>
                    <td style={{ padding: '10px' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: log.status === 'SENT' ? 'rgba(16, 185, 129, 0.2)' : log.status === 'FAILED' ? 'rgba(244, 63, 94, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                        color: log.status === 'SENT' ? '#6ee7b7' : log.status === 'FAILED' ? '#fca5a5' : '#fcd34d'
                      }}>
                        {log.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>{log.retryCount}</td>
                    <td style={{ padding: '10px', color: 'var(--text-muted)' }}>{new Date(log.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE DOCTOR MODAL */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ color: 'white', fontSize: '20px' }}>Create Doctor Profile</h3>
              <button onClick={() => setShowCreateModal(false)} className="btn-secondary" style={{ padding: '4px 8px' }}><X size={18} /></button>
            </div>

            <form onSubmit={handleCreateDoctor} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Doctor Full Name:</label>
                <input type="text" className="input-field" placeholder="Dr. Jane Doe" value={name} onChange={e => setName(e.target.value)} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Email Address:</label>
                  <input type="email" className="input-field" placeholder="doctor@healthcare.org" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div>
                  <label style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Specialisation:</label>
                  <input type="text" className="input-field" placeholder="Cardiology, Dermatology..." value={specialisation} onChange={e => setSpecialisation(e.target.value)} required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Working Start:</label>
                  <input type="text" className="input-field" placeholder="09:00" value={workingHoursStart} onChange={e => setWorkingHoursStart(e.target.value)} required />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Working End:</label>
                  <input type="text" className="input-field" placeholder="17:00" value={workingHoursEnd} onChange={e => setWorkingHoursEnd(e.target.value)} required />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Slot Duration (m):</label>
                  <input type="number" className="input-field" value={slotDurationMinutes} onChange={e => setSlotDurationMinutes(e.target.value)} required />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Bio / Qualifications:</label>
                <textarea className="input-field" rows={3} placeholder="Brief summary of experience..." value={bio} onChange={e => setBio(e.target.value)} />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Create Profile</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MARK LEAVE MODAL */}
      {showLeaveModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ color: 'white', fontSize: '20px' }}>Mark Doctor Leave & Trigger Conflict Flow</h3>
              <button onClick={() => setShowLeaveModal(false)} className="btn-secondary" style={{ padding: '4px 8px' }}><X size={18} /></button>
            </div>

            {leaveNotificationResult && (
              <div style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#6ee7b7', padding: '12px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
                {leaveNotificationResult}
              </div>
            )}

            <form onSubmit={handleMarkLeave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Select Doctor:</label>
                <select className="input-field" value={selectedDoctorId} onChange={e => setSelectedDoctorId(e.target.value)} required>
                  <option value="">-- Choose Doctor --</option>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>{d.user.name} ({d.specialisation})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Start Date:</label>
                  <input type="date" className="input-field" value={leaveStart} onChange={e => setLeaveStart(e.target.value)} required />
                </div>
                <div>
                  <label style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>End Date:</label>
                  <input type="date" className="input-field" value={leaveEnd} onChange={e => setLeaveEnd(e.target.value)} required />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Reason:</label>
                <input type="text" className="input-field" value={leaveReason} onChange={e => setLeaveReason(e.target.value)} />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button type="button" onClick={() => setShowLeaveModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Process Leave & Notify Patients</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
