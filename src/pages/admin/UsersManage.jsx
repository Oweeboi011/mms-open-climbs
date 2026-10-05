import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { subscribeToUsers } from "@/services/users";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LoadingSpinner from "@/components/LoadingSpinner";
import AddUserModal from "./users/AddUserModal";
import UserDetailModal from "./users/UserDetailModal";
import UsersTable from "./users/UsersTable";
import { matchesSearch, newestFirst } from "./users/usersModel";
import "./users/users.css";

export default function AdminUsersManage() {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  // The open user is looked up from the live list, so role and permission
  // changes show the moment Firestore confirms them.
  const [selectedId, setSelectedId] = useState(null);

  useEffect(
    () =>
      subscribeToUsers((docs) => {
        setUsers(newestFirst(docs));
        setLoading(false);
      }),
    [],
  );

  const selected = users.find((u) => u.id === selectedId) || null;
  const filtered = users.filter((u) => matchesSearch(u, search));

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
            <div className="admin-page-subtitle">
              {users.length} registered user{users.length !== 1 ? "s" : ""}
            </div>
          </div>
          <div className="users-header-actions">
            <Link to="/admin" className="btn btn-outline btn-sm">
              &larr; Back to Admin
            </Link>
            <button
              className="btn btn-primary"
              onClick={() => setAdding(true)}
              title="Create a new user account and send them a welcome email"
            >
              + Add User
            </button>
          </div>
        </div>

        <div className="admin-search">
          <input
            type="search"
            className="form-input users-search"
            placeholder="Search users…"
            aria-label="Search users"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : (
          <UsersTable users={filtered} currentUid={currentUser?.uid} onOpen={setSelectedId} />
        )}
      </main>
      <Footer />

      {adding && <AddUserModal onClose={() => setAdding(false)} />}
      {selected && (
        <UserDetailModal user={selected} isSelf={selected.id === currentUser?.uid} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
