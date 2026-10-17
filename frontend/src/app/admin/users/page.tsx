"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  KeyRound,
  Lock,
  Plus,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  User,
  UserCheck,
  UserCog,
  UserPlus,
  UserX,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/components/providers/auth-provider";
import {
  adminCreateUser,
  adminGetTeam,
  adminGetUsers,
  adminResetUserPassword,
  adminUpdateUserRole,
  adminUpdateUserStatus,
  AdminUser,
  TeamMember,
} from "@/lib/api";

const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "doctor", label: "Doctor" },
  { value: "receptionist", label: "Receptionist" },
];

export default function AdminUsersPage() {
  const { accessToken } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    fullName: "",
    email: "",
    role: "doctor",
    password: "",
    teamMemberId: "",
    requiresPasswordChange: true,
  });

  // Edit / Link Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [editRole, setEditRole] = useState("doctor");
  const [editTeamMemberId, setEditTeamMemberId] = useState("");

  // Reset Password Modal
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPassword, setResetPassword] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [uList, tList] = await Promise.all([
        adminGetUsers(accessToken),
        adminGetTeam(accessToken || undefined).catch(() => []),
      ]);
      setUsers(uList);
      setTeamMembers(tList);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to load staff accounts.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (accessToken) {
      queueMicrotask(() => {
        loadData();
      });
    }
  }, [accessToken]);

  const showToast = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Create user
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await adminCreateUser(
        {
          fullName: createForm.fullName,
          email: createForm.email,
          role: createForm.role,
          password: createForm.password,
          teamMemberId: createForm.teamMemberId ? createForm.teamMemberId : null,
          requiresPasswordChange: createForm.requiresPasswordChange,
        },
        accessToken
      );
      showToast("Staff account created successfully.");
      setShowCreateModal(false);
      setCreateForm({
        fullName: "",
        email: "",
        role: "doctor",
        password: "",
        teamMemberId: "",
        requiresPasswordChange: true,
      });
      loadData();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to create account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle status
  const handleToggleStatus = async (user: AdminUser) => {
    const nextStatus = !user.isActive;
    const confirmMsg = nextStatus
      ? `Reactivate account for ${user.fullName}?`
      : `Deactivate account for ${user.fullName}? This will immediately revoke all active sessions.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await adminUpdateUserStatus(user.id, nextStatus, accessToken);
      showToast(nextStatus ? "Account reactivated." : "Account deactivated. Sessions revoked.");
      loadData();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to update account status.");
    }
  };

  // Edit role & team member link
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await adminUpdateUserRole(
        selectedUser.id,
        editRole,
        editTeamMemberId ? editTeamMemberId : null,
        accessToken
      );
      showToast("Staff account role and practitioner profile updated.");
      setShowEditModal(false);
      loadData();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to update role/link.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset password
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await adminResetUserPassword(selectedUser.id, resetPassword, accessToken);
      showToast("Password reset successfully. Active sessions revoked.");
      setShowResetModal(false);
      setResetPassword("");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to reset password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.fullName.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "all" || u.role.toLowerCase() === roleFilter.toLowerCase();
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink font-serif">Staff Accounts</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Manage authenticated user accounts, roles, access permissions, and practitioner profile links.
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          variant="primary"
          size="sm"
          className="gap-2"
        >
          <UserPlus className="h-4 w-4" />
          Create Staff Account
        </Button>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-[var(--radius-card)] text-xs flex items-center gap-2">
          <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 rounded-[var(--radius-card)] text-xs flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-600 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Filter bar */}
      <Card className="p-4 bg-surface border-line flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search staff by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 px-3 border border-line rounded-[var(--radius-input)] text-xs bg-surface text-ink w-full sm:w-72 focus:outline-none focus:border-primary"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-9 px-3 border border-line rounded-[var(--radius-input)] text-xs bg-surface text-ink focus:outline-none focus:border-primary"
          >
            <option value="all">All Roles</option>
            <option value="doctor">Doctors</option>
            <option value="receptionist">Receptionists</option>
            <option value="admin">Admins</option>
          </select>
        </div>
        <div className="text-xs text-muted-foreground">
          Showing {filteredUsers.length} of {users.length} accounts
        </div>
      </Card>

      {/* Users Table */}
      <Card className="border-line overflow-hidden bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-sand/30 border-b border-line text-muted-foreground uppercase font-medium">
              <tr>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Linked Team Member</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Security</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                    Loading staff accounts...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No staff accounts match the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const linkedTm = teamMembers.find((t) => t.id === u.teamMemberId);
                  const isDoctor = u.role.toLowerCase() === "doctor";

                  return (
                    <tr key={u.id} className="hover:bg-sand/10 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-ink">{u.fullName}</div>
                        <div className="text-muted-foreground text-[11px]">{u.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${
                            isDoctor
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : u.role.toLowerCase() === "admin"
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {linkedTm ? (
                          <div className="flex items-center gap-1.5 text-ink">
                            <UserCheck className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                            <span className="font-medium">{linkedTm.displayName || `${linkedTm.firstName} ${linkedTm.lastName}`}</span>
                          </div>
                        ) : isDoctor ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 text-[11px] font-medium border border-amber-200">
                            <AlertTriangle className="h-3 w-3" />
                            Unlinked Doctor
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            u.isActive
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {u.isActive ? "Active" : "Deactivated"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {u.requiresPasswordChange ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            <Lock className="h-3 w-3" />
                            Must Change Pwd
                          </span>
                        ) : (
                          <span className="text-emerald-700 text-[11px] flex items-center gap-1">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Normal
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[11px] px-2"
                            onClick={() => {
                              setSelectedUser(u);
                              setEditRole(u.role);
                              setEditTeamMemberId(u.teamMemberId || "");
                              setShowEditModal(true);
                            }}
                          >
                            <UserCog className="h-3.5 w-3.5 mr-1" />
                            Edit / Link
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[11px] px-2"
                            onClick={() => {
                              setSelectedUser(u);
                              setResetPassword("");
                              setShowResetModal(true);
                            }}
                          >
                            <KeyRound className="h-3.5 w-3.5 mr-1" />
                            Reset Pwd
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className={`h-7 text-[11px] px-2 ${
                              u.isActive
                                ? "text-rose-700 border-rose-300 hover:bg-rose-50"
                                : "text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                            }`}
                            onClick={() => handleToggleStatus(u)}
                          >
                            {u.isActive ? "Deactivate" : "Reactivate"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div role="dialog" aria-modal="true" aria-label="Create New Staff Account" className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-[var(--radius-modal)] border border-line shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-semibold text-ink text-base flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-primary" />
                Create New Staff Account
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-muted-foreground hover:text-ink text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-medium text-ink">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Staff Full Name"
                  value={createForm.fullName}
                  onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                  className="h-9 px-3 border border-line rounded-[var(--radius-input)] text-xs bg-surface text-ink w-full focus:outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-ink">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. robert.vance@marlowdental.com"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="h-9 px-3 border border-line rounded-[var(--radius-input)] text-xs bg-surface text-ink w-full focus:outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-ink">System Role</label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                  className="w-full h-9 px-3 border border-line rounded-[var(--radius-input)] text-xs bg-surface text-ink focus:outline-none focus:border-primary"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Practitioner link dropdown */}
              <div className="space-y-1">
                <label className="font-medium text-ink flex items-center justify-between">
                  <span>Link Practitioner Profile</span>
                  {createForm.role === "doctor" && (
                    <span className="text-[10px] text-amber-700 font-normal">Recommended for Doctors</span>
                  )}
                </label>
                <select
                  value={createForm.teamMemberId}
                  onChange={(e) => setCreateForm({ ...createForm, teamMemberId: e.target.value })}
                  className="w-full h-9 px-3 border border-line rounded-[var(--radius-input)] text-xs bg-surface text-ink focus:outline-none focus:border-primary"
                >
                  <option value="">-- None / Unlinked --</option>
                  {teamMembers.map((tm) => (
                    <option key={tm.id} value={tm.id}>
                      {tm.displayName || `${tm.firstName} ${tm.lastName}`} ({tm.role || "Practitioner"})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground">
                  Links this login to their clinical schedule & encounter records.
                </p>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-ink">Temporary Password</label>
                <input
                  type="password"
                  required
                  placeholder="At least 8 chars (Uppercase, Lowercase, Number)"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  className="h-9 px-3 border border-line rounded-[var(--radius-input)] text-xs bg-surface text-ink w-full font-mono focus:outline-none focus:border-primary"
                />
                <p className="text-[10px] text-muted-foreground">
                  Policy: Minimum 8 characters, at least 1 uppercase letter, 1 lowercase letter, and 1 digit.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="reqPwdChange"
                  checked={createForm.requiresPasswordChange}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, requiresPasswordChange: e.target.checked })
                  }
                  className="rounded border-line text-primary focus:ring-primary h-4 w-4"
                />
                <label htmlFor="reqPwdChange" className="text-ink font-medium cursor-pointer">
                  Require password change on first login
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
                  {isSubmitting ? "Creating..." : "Create Account"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT ROLE / LINK MODAL */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-[var(--radius-modal)] border border-line shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-semibold text-ink text-base flex items-center gap-2">
                <UserCog className="h-4 w-4 text-primary" />
                Edit Staff Account: {selectedUser.fullName}
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-muted-foreground hover:text-ink text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-medium text-ink">Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full h-9 px-3 border border-line rounded-[var(--radius-input)] text-xs bg-surface text-ink focus:outline-none focus:border-primary"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-ink">Linked Practitioner Profile</label>
                <select
                  value={editTeamMemberId}
                  onChange={(e) => setEditTeamMemberId(e.target.value)}
                  className="w-full h-9 px-3 border border-line rounded-[var(--radius-input)] text-xs bg-surface text-ink focus:outline-none focus:border-primary"
                >
                  <option value="">-- None / Unlinked --</option>
                  {teamMembers.map((tm) => (
                    <option key={tm.id} value={tm.id}>
                      {tm.displayName || `${tm.firstName} ${tm.lastName}`} ({tm.role || "Practitioner"})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground">
                  Linking a team member enables clinical scheduling and encounter creation for this doctor.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {showResetModal && selectedUser && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-[var(--radius-modal)] border border-line shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-semibold text-ink text-base flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" />
                Reset Password: {selectedUser.fullName}
              </h3>
              <button
                onClick={() => setShowResetModal(false)}
                className="text-muted-foreground hover:text-ink text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Setting a new temporary password will revoke all currently active sessions. The user will be required to change their password upon their next login.
            </p>

            <form onSubmit={handleResetSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-medium text-ink">New Temporary Password</label>
                <input
                  type="password"
                  required
                  placeholder="At least 8 chars (Upper, Lower, Digit)"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  className="h-9 px-3 border border-line rounded-[var(--radius-input)] text-xs bg-surface text-ink w-full font-mono focus:outline-none focus:border-primary"
                />
                <p className="text-[10px] text-muted-foreground">
                  Policy: Minimum 8 characters, at least 1 uppercase letter, 1 lowercase letter, and 1 digit.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowResetModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
                  {isSubmitting ? "Resetting..." : "Reset Password & Revoke Sessions"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
