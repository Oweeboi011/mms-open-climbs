import ResponsiveTable from "@/components/admin/ResponsiveTable";
import StatusPill from "@/components/StatusPill";
import { ROLE_TONE, addedByLabel, joinedLabel } from "./usersModel";

export default function UsersTable({ users, currentUid, onOpen }) {
  return (
    <ResponsiveTable>
      <table className="admin-table table-min-640 users-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Role</th>
            <th>Added By</th>
            <th>Joined</th>
          </tr>
        </thead>
        <tbody>
          {users.length === 0 ? (
            <tr>
              <td colSpan={4} className="users-empty">
                No users found.
              </td>
            </tr>
          ) : (
            users.map((user) => (
              <tr key={user.id} className="users-row" onClick={() => onOpen(user.id)}>
                <td>
                  <button type="button" className="users-row-name" onClick={() => onOpen(user.id)}>
                    {user.displayName}
                    {user.id === currentUid && <span className="users-you">YOU</span>}
                  </button>
                  <div className="users-row-email">{user.email}</div>
                </td>
                <td>
                  <StatusPill tone={ROLE_TONE[user.role] || "success"}>{user.role}</StatusPill>
                </td>
                <td className="users-row-soft">{addedByLabel(user)}</td>
                <td className="users-row-date">{joinedLabel(user)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </ResponsiveTable>
  );
}
