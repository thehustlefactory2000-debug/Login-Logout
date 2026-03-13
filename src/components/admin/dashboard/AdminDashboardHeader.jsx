import React from "react";
import { ADMIN_TABS, AdminShellCard, TAB_DETAILS } from "./adminDashboardShared";

const NAV_COPY = {
  roles: "Manage user permissions",
  status: "View and filter lot statuses",
  instructions: "Create and manage instructions",
  rates: "Store stage-wise rates",
  billing: "Calculate payable amounts",
};

const AdminDashboardHeader = ({ activeTab, profileEmail, userCount, onTabChange, onSignOut, isSidebarOpen, onSidebarClose }) => (
  <>
    {isSidebarOpen && <button type="button" aria-label="Close sidebar overlay" className="fixed inset-0 z-30 bg-slate-950/45 lg:hidden" onClick={onSidebarClose} />}

    <aside
      className={`fixed inset-y-0 left-0 z-40 w-[288px] transform p-4 transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:bg-transparent lg:p-0 ${
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <AdminShellCard className="flex h-full flex-col border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,245,249,0.96))] text-slate-900 shadow-xl lg:rounded-none lg:border-r lg:border-l-0 lg:border-y-0">
        <div className="border-b border-slate-200 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white">
              SP
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Salon PWA</p>
              <h1 className="truncate text-xl font-semibold text-slate-950">Admin Dashboard</h1>
            </div>
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Signed in as</p>
          <p className="mt-2 break-all text-sm text-slate-700">{profileEmail || "-"}</p>
          <div className="mt-4 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-600">
            Team: <span className="font-semibold text-slate-900">{userCount}</span>
          </div>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
          {ADMIN_TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onTabChange(tab.key)}
                className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
                  active
                    ? "border-slate-300 bg-slate-100 text-slate-950"
                    : "border-slate-200 bg-white/80 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <div className="text-sm font-semibold">{tab.label}</div>
                <div className={`mt-1 text-xs ${active ? "text-slate-600" : "text-slate-500"}`}>{NAV_COPY[tab.key] || TAB_DETAILS[tab.key].eyebrow}</div>
              </button>
            );
          })}
        </div>

        <div className="border-t border-slate-200 px-4 py-4">
          <button type="button" onClick={onSignOut} className="w-full rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-200">
            Logout
          </button>
        </div>
      </AdminShellCard>
    </aside>
  </>
);

export default AdminDashboardHeader;
