import React from "react";
import { STAGE_OPTIONS } from "../../../constants/workflow";
import { AdminShellCard, FilterLabel, PanelHeader, ROLE_OPTIONS } from "./adminDashboardShared";

const AdminRolesPanel = ({ users, loadingUsers, savingId, deletingId, onFieldChange, onSaveUser, onDeleteRequest }) => (
  <AdminShellCard>
    <PanelHeader
      eyebrow="User Access"
      title="Role assignment"
      description="Every account is shown here with its current role and assigned workflow stage."
    />
    <div className="space-y-3 p-4 sm:p-6">
      {loadingUsers && <p className="text-sm text-slate-500">Loading users...</p>}
      {!loadingUsers && users.length === 0 && <p className="text-sm text-slate-500">No users found.</p>}

      {!loadingUsers &&
        users.map((user) => (
          <div key={user.id} className="rounded-[26px] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] p-4 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="break-all text-base font-semibold text-slate-950">{user.name || user.email}</p>
                  <span className={`status-pill ${user.role === "admin" ? "" : "warn"}`}>{user.role || "staff"}</span>
                </div>
                <p className="mt-1 break-all text-sm text-slate-600">{user.email}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[420px]">
                <FilterLabel label="Role">
                  <select
                    value={user.role || "staff"}
                    onChange={(e) => onFieldChange(user.id, "role", e.target.value)}
                    className="glass-input w-full px-3 py-2 text-sm outline-none"
                  >
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </FilterLabel>

                <FilterLabel label="Assigned Stage">
                  <select
                    value={user.assigned_stage || ""}
                    onChange={(e) => onFieldChange(user.id, "assigned_stage", e.target.value)}
                    className="glass-input w-full px-3 py-2 text-sm outline-none"
                  >
                    <option value="">Unassigned</option>
                    {STAGE_OPTIONS.map((stage) => (
                      <option key={stage} value={stage}>
                        {stage}
                      </option>
                    ))}
                  </select>
                </FilterLabel>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => onSaveUser(user)} disabled={savingId === user.id} className="btn-primary disabled:opacity-60">
                {savingId === user.id ? "Saving..." : "Save Changes"}
              </button>

              {user.role === "staff" && (
                <button type="button" onClick={() => onDeleteRequest(user)} disabled={deletingId === user.id} className="btn-danger disabled:opacity-60">
                  Delete Staff
                </button>
              )}
            </div>
          </div>
        ))}
    </div>
  </AdminShellCard>
);

export default AdminRolesPanel;
