import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import LoadingSpinner from '@/components/LoadingSpinner';
import WaiverText from '@/components/WaiverText';

export default function WaiverPrint() {
  const { registrationId } = useParams();
  const { currentUser, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [reg,     setReg]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const snap = await getDoc(doc(db, 'registrations', registrationId));
      if (!snap.exists()) { navigate('/'); return; }
      const data = { id: snap.id, ...snap.data() };
      // Only owner or admin can view
      if (data.userId !== currentUser.uid && !isAdmin) { navigate('/'); return; }
      setReg(data);
      setLoading(false);
    }
    load();
  }, [registrationId, currentUser, isAdmin, navigate]);

  if (loading) return <LoadingSpinner fullPage />;
  if (!reg)    return null;

  const signedDate = reg.waiverSignedAt?.toDate?.()
    ? reg.waiverSignedAt.toDate().toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' })
    : 'N/A';

  return (
    <div>
      {/* Toolbar — hidden on print */}
      <div className="no-print" style={{ background: 'var(--green-dark)', padding: '12px 32px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <button className="btn btn-outline" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} onClick={() => navigate(-1)}>
          &#8592; Back
        </button>
        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>Waiver for <strong style={{ color: '#fff' }}>{reg.name}</strong></span>
        <button className="btn btn-gold btn-sm" style={{ marginLeft: 'auto' }} onClick={() => window.print()}>
          &#128438; Print / Save PDF
        </button>
      </div>

      <div className="waiver-print-page">
        {/* Header */}
        <div className="waiver-print-header">
          <div className="waiver-print-org">Metropolitan Mountaineering Society</div>
          <div className="waiver-print-title">Waiver &amp; Release of Liability</div>
          <div className="waiver-print-event">
            <strong>{reg.climbTitle}</strong> &bull; {reg.climbDate} &bull; {reg.climbLocation}
          </div>
          <div style={{ marginTop: 6, fontSize: '0.72rem', color: 'var(--ink-soft)', letterSpacing: 1 }}>
            Open Climbs 2026 &bull; Registration ID: {registrationId}
          </div>
        </div>

        {/* Participant Info */}
        <div className="waiver-participant-info">
          <div className="waiver-info-item"><label>Full Name</label><span>{reg.name}</span></div>
          <div className="waiver-info-item"><label>Email</label><span>{reg.email}</span></div>
          <div className="waiver-info-item"><label>Mobile</label><span>{reg.mobile}</span></div>
          <div className="waiver-info-item"><label>Date of Birth</label><span>{reg.dateOfBirth || '—'}</span></div>
          <div className="waiver-info-item"><label>Address</label><span>{reg.address || '—'}</span></div>
          <div className="waiver-info-item"><label>Experience Level</label><span style={{ textTransform: 'capitalize' }}>{reg.experienceLevel || '—'}</span></div>
          <div className="waiver-info-item">
            <label>Emergency Contact</label>
            <span>{reg.emergencyContact?.name} ({reg.emergencyContact?.relationship}) — {reg.emergencyContact?.mobile}</span>
          </div>
          {reg.medicalConditions && (
            <div className="waiver-info-item" style={{ gridColumn: '1 / -1' }}>
              <label>Medical Conditions / Allergies</label>
              <span>{reg.medicalConditions}</span>
            </div>
          )}
        </div>

        {/* Waiver Text */}
        <div className="waiver-section">
          <WaiverText
            climbTitle={reg.climbTitle}
            climbDate={reg.climbDate}
            climbLocation={reg.climbLocation}
          />
        </div>

        {/* Signature Block */}
        <div className="waiver-signature-block">
          <div style={{ marginBottom: 14, fontSize: '0.72rem', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--ink-soft)' }}>
            Digital Signature
          </div>
          <div className="waiver-signature-name">{reg.waiverSignedName}</div>
          <div className="waiver-signature-meta">
            Signed electronically on {signedDate}
          </div>
        </div>

        <div style={{ marginTop: 32, fontSize: '0.72rem', color: 'var(--ink-soft)', textAlign: 'center', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          This document constitutes a legally binding waiver. Metropolitan Mountaineering Society &bull; Open Climbs 2026
        </div>
      </div>
    </div>
  );
}
