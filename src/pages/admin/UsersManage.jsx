import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/firebase/config';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import LoadingSpinner from '@/components/LoadingSpinner';

const createUserFn = httpsCallable(functions, 'createUser');

export default function AdminUsersManage() {
  const [users,       setUsers]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [showModal,   setShowModal]   = useState(false);
  const [newUser,     setNewUser]     = useState({ email: '', displayName: '', role: 'member' });
  const [creating,    setCreating]    = useState(false);
  const [createError, setCreateError] = useState('');
  const [createOk,    setCreateOk]    = useState('');

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  async function changeRole(uid, role) {
    await updateDoc(doc(db, 'users', uid), { role, updatedAt: serverTimestamp() });
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    setCreateError(''); setCreateOk('');
    setCreating(true);
    try {
      await createUserFn(newUser);
      setCreateOk(`Account created for ${newUser.email}. A welcome email with setup link has been sent.`);
      setNewUser({ email: '', displayName: '', role: 'member' });
    } catch (err) {
      setCreateError(err.message || 'Failed to create user.');
    } finally {
      setCreating(false);
    }
  }

  const filtered = users.filter(u =>
    !search ||
    u.displayName?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="admin-layout">
      <Header />
      <main className="admin-main">
        <div className="admin-breadcrumb">
          <Link to="/admin">Dashboard</Link>
          <span className="admin-breadcrumb-sep">/</span>
          <span>Users</span>
        </div>
        <div className="admin-page-header">
          <div>
            <div className="admin-page-title">Users</div>
            <div className="admin-page-subtitle">{users.length} registered user{users.length !== 1 ? 's' : ''}</div>
          </div>
          <button className="btn btn-primary" onClick={() => { setShowModal(true); setCreateError(''); setCreateOk(''); }}>
            + Add User
          </button>
        </div>

        {/* Add User Modal */}
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: '#fff', borderRadius: 'var(--radius-lg)', padding: 32, width: '100%', maxWidth: 440, boxShadow: 'var(--shadow-lg)' }}>
              <h2 style={{ fontFamily: 'var(--font-head)', fontSize: '1.3rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 20, color: 'var(--green-dark)' }}>
                Add New User
              </h2>
              {createError && <div className="alert alert-error">{createError}</div>}
              {createOk    && <div className="alert alert-success">{createOk}</div>}
              <form onSubmit={handleCreateUser}>
                <div className="form-group">
                  <label className="form-label required">Email Address</label>
                  <input type="email" className="form-input" required value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label required">Full Name</label>
                  <input type="text" className="form-input" required value={newUser.displayName} onChange={e => setNewUser(p => ({ ...p, displayName: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label required">Role</label>
                  <select className="form-select" required value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}>
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                  <div className="form-hint">The user will receive an email with a link to set their password.</div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  <button className="btn btn-primary" type="submit" disabled={creating}>
                    {creating ? <><span className="spinner spinner-sm" /> Sending…</> : 'Create & Send Invite'}
                  </button>
                  <button className="btn btn-outline" type="button" onClick={() => setShowModal(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="admin-search">
          <input
            type="search" className="form-input" placeholder="Search users…"
            value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 320 }}
          />
        </div>

        {loading ? <LoadingSpinner /> : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Added By</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--ink-soft)' }}>No users found.</td></tr>
                ) : filtered.map(user => (
                  <tr key={user.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{user.displayName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--ink-soft)' }}>{user.email}</div>
                    </td>
                    <td>
                      <span className={`status-badge status-${user.role}`}>{user.role}</span>
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--ink-soft)' }}>
                      {user.addedBy === 'self' ? 'Self-registered' : 'Admin'}
                    </td>
                    <td style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                      {user.createdAt?.toDate?.().toLocaleDateString('en-PH') || '—'}
                    </td>
                    <td>
                      <select
                        className="form-select"
                        style={{ padding: '4px 8px', fontSize: '0.75rem', width: 'auto' }}
                        value={user.role}
                        onChange={e => changeRole(user.id, e.target.value)}
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
