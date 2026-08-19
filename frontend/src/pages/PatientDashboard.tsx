import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Calendar as CalendarIcon, Clock, Stethoscope, AlertTriangle, FileText, CheckCircle, Pill, Search, X } from 'lucide-react';

interface Doctor {
  id: string;
  specialisation: string;
  workingHoursStart: string;
  workingHoursEnd: string;
  slotDurationMinutes: number;
  bio?: string;
  user: { id: string; name: string; email: string };
}

interface TimeSlot {
  startTime: string;
  endTime: string;
  available: boolean;
  heldByMe?: boolean;
}

export const PatientDashboard: React.FC = () => {
  const { token, user } = useAuth();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [isOnLeave, setIsOnLeave] = useState(false);
  const [leaveReason, setLeaveReason] = useState('');

  // Hold State
  const [heldSlot, setHeldSlot] = useState<TimeSlot | null>(null);
  const [holdTimer, setHoldTimer] = useState<number>(180); // 3 minutes in seconds
  const [showBookingModal, setShowBookingModal] = useState(false);

  // Form State
  const [symptoms, setSymptoms] = useState('');
  const [duration, setDuration] = useState('2 days');
  const [severity, setSeverity] = useState('Moderate');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState<any>(null);

  // Appointments & Reminders
  const [appointments, setAppointments] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'book' | 'history' | 'reminders'>('book');

  useEffect(() => {
    fetchDoctors();
    fetchAppointments();
    fetchReminders();
  }, []);

  useEffect(() => {
    if (selectedDoctor && selectedDate) {
      fetchSlots(selectedDoctor.id, selectedDate);
    }
  }, [selectedDoctor, selectedDate]);

  // TTL Countdown timer for slot hold
  useEffect(() => {
    let interval: any = null;
    if (heldSlot && holdTimer > 0) {
      interval = setInterval(() => {
        setHoldTimer(prev => {
          if (prev <= 1) {
            setHeldSlot(null);
            setShowBookingModal(false);
            if (selectedDoctor) fetchSlots(selectedDoctor.id, selectedDate);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [heldSlot, holdTimer]);

  const fetchDoctors = async () => {
    try {
      const res = await fetch(`/api/patient/doctors?query=${searchQuery}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setDoctors(data.doctors || []);
    } catch (err) {
      console.error('Failed to fetch doctors:', err);
    }
  };

  const fetchSlots = async (doctorId: string, dateStr: string) => {
    try {
      const res = await fetch(`/api/patient/slots?doctorId=${doctorId}&date=${dateStr}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setSlots(data.slots || []);
        setIsOnLeave(data.isOnLeave || false);
        setLeaveReason(data.leaveReason || '');
      }
    } catch (err) {
      console.error('Failed to fetch slots:', err);
    }
  };

  const fetchAppointments = async () => {
    try {
      const res = await fetch('/api/patient/appointments', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setAppointments(data.appointments || []);
    } catch (err) {
      console.error('Failed to fetch appointments:', err);
    }
  };

  const fetchReminders = async () => {
    try {
      const res = await fetch('/api/patient/reminders', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setReminders(data.reminders || []);
    } catch (err) {
      console.error('Failed to fetch reminders:', err);
    }
  };

  const handleHoldSlot = async (slot: TimeSlot) => {
    if (!selectedDoctor) return;
    try {
      const res = await fetch('/api/patient/hold-slot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          doctorId: selectedDoctor.id,
          slotStartTime: slot.startTime,
          slotEndTime: slot.endTime,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setHeldSlot(slot);
        setHoldTimer(180); // Reset 3-min timer
        setShowBookingModal(true);
        fetchSlots(selectedDoctor.id, selectedDate);
      } else {
        alert(data.error || 'Could not hold slot');
        fetchSlots(selectedDoctor.id, selectedDate);
      }
    } catch (err: any) {
      alert('Error holding slot: ' + err.message);
    }
  };

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctor || !heldSlot) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/patient/book', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          doctorId: selectedDoctor.id,
          slotStartTime: heldSlot.startTime,
          slotEndTime: heldSlot.endTime,
          symptoms,
          duration,
          severity,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setBookingSuccess(data);
        setShowBookingModal(false);
        setHeldSlot(null);
        setSymptoms('');
        fetchAppointments();
        if (selectedDoctor) fetchSlots(selectedDoctor.id, selectedDate);
      } else {
        alert(data.error || 'Booking failed');
        fetchSlots(selectedDoctor.id, selectedDate);
      }
    } catch (err: any) {
      alert('Error confirming booking: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelAppointment = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this appointment?')) return;
    try {
      const res = await fetch(`/api/patient/appointments/${id}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchAppointments();
      }
    } catch (err) {
      console.error('Cancel failed:', err);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '30px auto', padding: '0 20px' }}>
      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <button
          onClick={() => setActiveTab('book')}
          className={activeTab === 'book' ? 'btn-primary' : 'btn-secondary'}
        >
          <Stethoscope size={18} />
          Book Appointment
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}
        >
          <FileText size={18} />
          My Appointments ({appointments.length})
        </button>
        <button
          onClick={() => setActiveTab('reminders')}
          className={activeTab === 'reminders' ? 'btn-primary' : 'btn-secondary'}
        >
          <Pill size={18} />
          Medication Reminders ({reminders.length})
        </button>
      </div>

      {/* Booking Confirmation Success Banner */}
      {bookingSuccess && (
        <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px', borderLeft: '4px solid var(--accent-emerald)', background: 'rgba(16, 185, 129, 0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <CheckCircle size={28} color="var(--accent-emerald)" />
              <div>
                <h3 style={{ color: 'white', fontSize: '18px' }}>Appointment Confirmed!</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                  AI Pre-Visit Urgency Assessment: <span className={`badge-urgency-${bookingSuccess.urgency}`}>{bookingSuccess.urgency}</span>
                  {bookingSuccess.isAiFallback && <span style={{ marginLeft: '10px', fontSize: '12px', color: 'var(--accent-amber)' }}>(Fallback Mode Active)</span>}
                </p>
              </div>
            </div>
            <button onClick={() => setBookingSuccess(null)} className="btn-secondary" style={{ padding: '4px 10px' }}><X size={16} /></button>
          </div>
        </div>
      )}

      {/* TAB 1: BOOK APPOINTMENT */}
      {activeTab === 'book' && (
        <div className="grid-2">
          {/* Doctor List */}
          <div>
            <div className="glass-panel" style={{ padding: '24px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', color: 'white', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Search size={20} color="var(--accent-blue)" />
                Find a Specialist
              </h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Search by name or specialisation (e.g. Cardiology)"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                <button onClick={fetchDoctors} className="btn-primary" style={{ padding: '0 18px' }}>Search</button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {doctors.map(doc => (
                <div
                  key={doc.id}
                  className="glass-panel"
                  style={{
                    padding: '20px',
                    borderColor: selectedDoctor?.id === doc.id ? 'var(--accent-blue)' : 'var(--border-color)',
                    cursor: 'pointer',
                  }}
                  onClick={() => setSelectedDoctor(doc)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h4 style={{ fontSize: '17px', color: 'white', fontWeight: 700 }}>{doc.user.name}</h4>
                      <span style={{
                        display: 'inline-block',
                        background: 'rgba(6, 182, 212, 0.15)',
                        color: 'var(--accent-cyan)',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 600,
                        marginTop: '4px'
                      }}>
                        {doc.specialisation}
                      </span>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '8px' }}>
                        {doc.bio || 'General Consultation'}
                      </p>
                      <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>
                        Working hours: {doc.workingHoursStart} - {doc.workingHoursEnd} ({doc.slotDurationMinutes} min slots)
                      </p>
                    </div>
                    <button className={selectedDoctor?.id === doc.id ? 'btn-primary' : 'btn-secondary'} style={{ fontSize: '12px', padding: '6px 12px' }}>
                      {selectedDoctor?.id === doc.id ? 'Selected' : 'Select'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Real-time Slots Picker */}
          <div>
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '18px', color: 'white', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CalendarIcon size={20} color="var(--accent-purple)" />
                Available Slots
              </h3>

              {!selectedDoctor ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Select a doctor from the list to view real-time availability.
                </div>
              ) : (
                <div>
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Select Date:</label>
                    <input
                      type="date"
                      className="input-field"
                      value={selectedDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={e => setSelectedDate(e.target.value)}
                    />
                  </div>

                  {isOnLeave ? (
                    <div style={{ background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.3)', color: '#fca5a5', padding: '16px', borderRadius: '10px' }}>
                      <AlertTriangle size={20} style={{ marginBottom: '6px' }} />
                      <p style={{ fontWeight: 600 }}>Doctor is on leave on {selectedDate}</p>
                      <p style={{ fontSize: '13px', marginTop: '4px' }}>Reason: {leaveReason}</p>
                    </div>
                  ) : (
                    <div>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                        Showing slots for <strong style={{ color: 'white' }}>{selectedDoctor.user.name}</strong> on {selectedDate}:
                      </p>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '10px' }}>
                        {slots.map((s, idx) => {
                          const timeStr = new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          return (
                            <button
                              key={idx}
                              disabled={!s.available}
                              onClick={() => handleHoldSlot(s)}
                              style={{
                                padding: '12px 8px',
                                borderRadius: '8px',
                                border: s.heldByMe ? '2px solid var(--accent-amber)' : s.available ? '1px solid var(--accent-blue)' : '1px solid rgba(255,255,255,0.05)',
                                background: s.heldByMe ? 'rgba(245, 158, 11, 0.2)' : s.available ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.02)',
                                color: s.available ? 'white' : 'var(--text-muted)',
                                cursor: s.available ? 'pointer' : 'not-allowed',
                                fontSize: '13px',
                                fontWeight: 600,
                                textAlign: 'center',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              {timeStr}
                              {s.heldByMe && <span style={{ display: 'block', fontSize: '10px', color: 'var(--accent-amber)' }}>HELD</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SYMPTOM FORM MODAL WITH LIVE HOLD TIMER */}
      {showBookingModal && heldSlot && selectedDoctor && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ color: 'white', fontSize: '20px' }}>Complete Symptom Form</h3>
              <button onClick={() => setShowBookingModal(false)} className="btn-secondary" style={{ padding: '4px 8px' }}><X size={18} /></button>
            </div>

            {/* Hold TTL Timer */}
            <div style={{
              background: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: '#fcd34d',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px'
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={16} /> Slot Held: {new Date(heldSlot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span style={{ fontWeight: 700 }}>
                Hold expires in: {Math.floor(holdTimer / 60)}:{(holdTimer % 60).toString().padStart(2, '0')}
              </span>
            </div>

            <form onSubmit={handleConfirmBooking} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
                  Describe your symptoms in detail:
                </label>
                <textarea
                  className="input-field"
                  rows={4}
                  placeholder="e.g. Chest tightness, headache for 2 days, mild shortness of breath..."
                  value={symptoms}
                  onChange={e => setSymptoms(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
                    Symptom Duration:
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. 3 days"
                    value={duration}
                    onChange={e => setDuration(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
                    Perceived Severity:
                  </label>
                  <select
                    className="input-field"
                    value={severity}
                    onChange={e => setSeverity(e.target.value)}
                  >
                    <option value="Mild">Mild</option>
                    <option value="Moderate">Moderate</option>
                    <option value="Severe">Severe</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button type="button" onClick={() => setShowBookingModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Analyzing Symptoms & Confirming...' : 'Confirm Appointment & Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: APPOINTMENT HISTORY */}
      {activeTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ fontSize: '20px', color: 'white' }}>My Appointment History</h3>
          {appointments.length === 0 ? (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No appointment history found.
            </div>
          ) : (
            appointments.map((app) => (
              <div key={app.id} className="glass-panel" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h4 style={{ fontSize: '18px', color: 'white', fontWeight: 700 }}>
                      Dr. {app.doctorProfile?.user?.name} ({app.doctorProfile?.specialisation})
                    </h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
                      <CalendarIcon size={14} style={{ marginRight: '6px' }} />
                      {new Date(app.slotStartTime).toLocaleString()}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className={`badge-status badge-${app.status}`}>{app.status}</span>
                    {app.status === 'BOOKED' && (
                      <button onClick={() => handleCancelAppointment(app.id)} className="btn-danger">
                        Cancel
                      </button>
                    )}
                  </div>
                </div>

                {/* Pre-visit AI Urgency */}
                {app.preVisitSummary && (
                  <div style={{ marginTop: '16px', background: 'rgba(255, 255, 255, 0.03)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                      <strong style={{ fontSize: '13px', color: 'white' }}>AI Pre-Visit Assessment:</strong>
                      <span className={`badge-urgency-${app.preVisitSummary.urgency}`}>
                        {app.preVisitSummary.urgency} Urgency
                      </span>
                      {app.preVisitSummary.isFallback && (
                        <span style={{ fontSize: '11px', color: 'var(--accent-amber)' }}>(Fallback Summary)</span>
                      )}
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      Chief Complaint: {app.preVisitSummary.chiefComplaint}
                    </p>
                  </div>
                )}

                {/* Post-visit AI Patient Summary */}
                {app.postVisitSummary && (
                  <div style={{ marginTop: '16px', background: 'rgba(16, 185, 129, 0.08)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                    <h5 style={{ color: 'var(--accent-emerald)', fontSize: '15px', marginBottom: '8px' }}>
                      Post-Visit Summary & Care Plan:
                    </h5>
                    <p style={{ fontSize: '14px', color: 'white', marginBottom: '10px' }}>
                      {app.postVisitSummary.summaryText}
                    </p>

                    {/* Prescriptions & Medication Schedule */}
                    {app.prescription && (
                      <div style={{ marginTop: '12px' }}>
                        <strong style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Prescribed Medications:</strong>
                        <ul style={{ paddingLeft: '20px', marginTop: '6px', fontSize: '13px', color: 'var(--text-primary)' }}>
                          {JSON.parse(app.prescription.medications || '[]').map((m: any, idx: number) => (
                            <li key={idx}>
                              <strong>{m.drug}</strong> {m.dosage} — {m.frequency} for {m.duration}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 3: MEDICATION REMINDERS */}
      {activeTab === 'reminders' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '20px', color: 'white', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Pill size={22} color="var(--accent-emerald)" />
            Medication Reminder Schedule
          </h3>

          {reminders.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No active medication reminders found.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '12px' }}>Medication</th>
                    <th style={{ padding: '12px' }}>Dosage</th>
                    <th style={{ padding: '12px' }}>Scheduled Dose Time</th>
                    <th style={{ padding: '12px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reminders.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '12px', color: 'white', fontWeight: 600 }}>{r.medicationName}</td>
                      <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{r.dosage}</td>
                      <td style={{ padding: '12px', color: 'var(--text-primary)' }}>{new Date(r.scheduledTime).toLocaleString()}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 700,
                          background: r.status === 'SENT' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                          color: r.status === 'SENT' ? '#6ee7b7' : '#fcd34d'
                        }}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
