import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Calendar, Clock, User, AlertTriangle, FileText, Plus, Pill, CheckCircle, X } from 'lucide-react';

interface PrescriptionInput {
  drug: string;
  dosage: string;
  frequency: string;
  duration: string;
}

export const DoctorDashboard: React.FC = () => {
  const { token, user } = useAuth();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Active appointment for consultation
  const [activeAppointment, setActiveAppointment] = useState<any | null>(null);
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [medications, setMedications] = useState<PrescriptionInput[]>([
    { drug: '', dosage: '', frequency: 'Once daily', duration: '7 days' }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Doctor Leave State
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveStart, setLeaveStart] = useState('');
  const [leaveEnd, setLeaveEnd] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveResult, setLeaveResult] = useState<string | null>(null);

  useEffect(() => {
    fetchSchedule();
  }, [selectedDate]);

  const fetchSchedule = async () => {
    try {
      const res = await fetch(`/api/doctor/schedule?date=${selectedDate}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setAppointments(data.appointments || []);
      }
    } catch (err) {
      console.error('Failed to fetch doctor schedule:', err);
    }
  };

  const handleAddMedicationRow = () => {
    setMedications(prev => [...prev, { drug: '', dosage: '', frequency: 'Once daily', duration: '7 days' }]);
  };

  const handleMedChange = (index: number, field: keyof PrescriptionInput, value: string) => {
    setMedications(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemoveMedicationRow = (index: number) => {
    setMedications(prev => prev.filter((_, i) => i !== index));
  };

  const handleCompleteConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAppointment) return;

    setIsSubmitting(true);
    try {
      const filteredMeds = medications.filter(m => m.drug.trim() !== '');

      const res = await fetch('/api/doctor/post-visit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          appointmentId: activeAppointment.id,
          clinicalNotes,
          medications: filteredMeds,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(`Consultation submitted! ${data.isAiFallback ? '(AI Fallback Mode Used)' : 'AI Post-Visit Summary Generated.'}`);
        setActiveAppointment(null);
        setClinicalNotes('');
        setMedications([{ drug: '', dosage: '', frequency: 'Once daily', duration: '7 days' }]);
        fetchSchedule();
      } else {
        alert(data.error || 'Failed to submit consultation');
      }
    } catch (err: any) {
      alert('Error submitting consultation: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/doctor/leave', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          startDate: leaveStart,
          endDate: leaveEnd,
          reason: leaveReason,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setLeaveResult(data.message);
        setTimeout(() => {
          setShowLeaveModal(false);
          setLeaveResult(null);
        }, 2000);
        fetchSchedule();
      } else {
        alert(data.error || 'Failed to mark leave');
      }
    } catch (err: any) {
      alert('Error marking leave: ' + err.message);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '30px auto', padding: '0 20px' }}>
      {/* Top Header Controls */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '22px', color: 'white', fontWeight: 700 }}>Doctor Consultation Dashboard</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '2px' }}>
            Review AI Pre-Visit summaries and submit post-visit care plans
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block' }}>Schedule Date:</label>
            <input
              type="date"
              className="input-field"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              style={{ padding: '8px 12px' }}
            />
          </div>

          <button onClick={() => setShowLeaveModal(true)} className="btn-secondary" style={{ marginTop: '16px' }}>
            <Calendar size={16} />
            Mark Leave Days
          </button>
        </div>
      </div>

      {/* Appointment Schedule List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {appointments.length === 0 ? (
          <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No appointments scheduled for {selectedDate}.
          </div>
        ) : (
          appointments.map((app) => {
            const preSummary = app.preVisitSummary;
            const suggestedQs = preSummary?.suggestedQuestions ? JSON.parse(preSummary.suggestedQuestions) : [];

            return (
              <div key={app.id} className="glass-panel" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <h3 style={{ fontSize: '19px', color: 'white', fontWeight: 700 }}>
                        {app.patient?.name}
                      </h3>
                      <span className={`badge-status badge-${app.status}`}>{app.status}</span>
                    </div>

                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
                      <Clock size={14} style={{ marginRight: '6px' }} />
                      Time Slot: {new Date(app.slotStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(app.slotEndTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>

                  {app.status === 'BOOKED' && (
                    <button
                      onClick={() => {
                        setActiveAppointment(app);
                        setClinicalNotes(app.postVisitNotes?.notes || '');
                      }}
                      className="btn-primary"
                    >
                      <FileText size={16} />
                      Start / Complete Consultation
                    </button>
                  )}
                </div>

                {/* AI Pre-Visit Summary Card */}
                {preSummary && (
                  <div style={{
                    marginTop: '18px',
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '18px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>AI Pre-Visit Summary</span>
                        <span className={`badge-urgency-${preSummary.urgency}`}>
                          {preSummary.urgency} Urgency
                        </span>
                      </div>
                      {preSummary.isFallback && (
                        <span style={{ fontSize: '11px', color: 'var(--accent-amber)', background: 'rgba(245,158,11,0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                          Fallback Mode Active
                        </span>
                      )}
                    </div>

                    <p style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: '12px' }}>
                      <strong>Chief Complaint:</strong> {preSummary.chiefComplaint}
                    </p>

                    {suggestedQs.length > 0 && (
                      <div>
                        <strong style={{ fontSize: '12px', color: 'var(--accent-cyan)' }}>Suggested Doctor Questions:</strong>
                        <ul style={{ paddingLeft: '20px', marginTop: '4px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                          {suggestedQs.map((q: string, idx: number) => (
                            <li key={idx}>{q}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* POST-VISIT CONSULTATION MODAL */}
      {activeAppointment && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ maxWidth: '700px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ color: 'white', fontSize: '20px' }}>
                Post-Visit Notes & Prescription — Patient: {activeAppointment.patient?.name}
              </h3>
              <button onClick={() => setActiveAppointment(null)} className="btn-secondary" style={{ padding: '4px 8px' }}><X size={18} /></button>
            </div>

            <form onSubmit={handleCompleteConsultation} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
                  Clinical Notes (Doctor Entry):
                </label>
                <textarea
                  className="input-field"
                  rows={4}
                  placeholder="Enter diagnosis, findings, and general care advice..."
                  value={clinicalNotes}
                  onChange={e => setClinicalNotes(e.target.value)}
                  required
                />
              </div>

              {/* Prescription Builder */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <label style={{ fontSize: '14px', color: 'white', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Pill size={18} color="var(--accent-emerald)" />
                    Prescribe Medications
                  </label>
                  <button type="button" onClick={handleAddMedicationRow} className="btn-secondary" style={{ fontSize: '12px', padding: '4px 10px' }}>
                    <Plus size={14} /> Add Medication
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {medications.map((med, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr 1fr auto', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Drug Name"
                        value={med.drug}
                        onChange={e => handleMedChange(idx, 'drug', e.target.value)}
                      />
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Dosage (e.g. 500mg)"
                        value={med.dosage}
                        onChange={e => handleMedChange(idx, 'dosage', e.target.value)}
                      />
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Frequency (e.g. twice daily)"
                        value={med.frequency}
                        onChange={e => handleMedChange(idx, 'frequency', e.target.value)}
                      />
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Duration (e.g. 7 days)"
                        value={med.duration}
                        onChange={e => handleMedChange(idx, 'duration', e.target.value)}
                      />
                      <button type="button" onClick={() => handleRemoveMedicationRow(idx)} className="btn-danger" style={{ padding: '8px' }}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '14px' }}>
                <button type="button" onClick={() => setActiveAppointment(null)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Generating AI Patient Summary...' : 'Submit & Generate Patient Summary'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DOCTOR LEAVE MODAL */}
      {showLeaveModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ color: 'white', fontSize: '20px' }}>Declare Doctor Leave Days</h3>
              <button onClick={() => setShowLeaveModal(false)} className="btn-secondary" style={{ padding: '4px 8px' }}><X size={18} /></button>
            </div>

            {leaveResult && (
              <div style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#6ee7b7', padding: '10px', borderRadius: '6px', fontSize: '13px', marginBottom: '16px' }}>
                {leaveResult}
              </div>
            )}

            <form onSubmit={handleMarkLeave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
                <label style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Reason for Leave:</label>
                <input type="text" className="input-field" placeholder="e.g. Medical conference, Annual Leave" value={leaveReason} onChange={e => setLeaveReason(e.target.value)} />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button type="button" onClick={() => setShowLeaveModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Mark Leave & Notify Patients</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
