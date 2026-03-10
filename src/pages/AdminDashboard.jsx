import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { STAGE_LABELS, STAGE_OPTIONS } from "../constants/workflow";

const ROLE_OPTIONS = ["admin", "staff"];
const ADMIN_TABS = [
  { key: "roles", label: "Assign Role" },
  { key: "status", label: "Lot Status" },
];

const initialFilters = {
  lotNo: "",
  status: "",
  stage: "",
  clothType: "",
  partyName: "",
  greyPartyName: "",
  startDate: "",
  endDate: "",
};

const one = (v) => (Array.isArray(v) ? v[0] : v) || null;
const n = (v) => (typeof v === "number" ? v : Number(v || 0));

const stageLabel = (stage) => STAGE_LABELS[stage] || stage || "-";

const getProcessedMeters = (lot) => {
  const folding = one(lot.folding);
  const finishing = one(lot.finishing);
  const stenter = one(lot.stenter);
  const dyeing = one(lot.dyeing);
  const checking = one(lot.grey_checking);
  const inward = one(lot.grey_inward);
  const candidates = [
    n(folding?.input_meters),
    n(finishing?.finished_meters),
    n(stenter?.stentered_meters),
    n(dyeing?.dyed_meters),
    n(checking?.checked_meters),
    n(inward?.meters),
  ];
  return candidates.find((x) => x > 0) || 0;
};

const toPrintableDate = (v) => (v ? new Date(v).toLocaleString() : "-");

const toCsv = (rows) => {
  const headers = [
    "Lot No",
    "Stage",
    "Status",
    "Party",
    "Grey Party",
    "Cloth Type",
    "Checked Meters",
    "Bleached No",
    "Dyed Meters",
    "Stentered Meters",
    "Finished Meters",
    "Processed Meters",
    "Created At",
  ];
  const escape = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const lines = [headers.map(escape).join(",")];

  for (const lot of rows) {
    const checking = one(lot.grey_checking);
    const bleaching = one(lot.bleaching);
    const dyeing = one(lot.dyeing);
    const stenter = one(lot.stenter);
    const finishing = one(lot.finishing);
    lines.push(
      [
        lot.lot_no,
        stageLabel(lot.current_stage),
        lot.status,
        lot.party?.name || "",
        lot.grey_party?.name || "",
        lot.cloth_type || "",
        checking?.checked_meters ?? "",
        bleaching?.bleach_group_no ?? "",
        dyeing?.dyed_meters ?? "",
        stenter?.stentered_meters ?? "",
        finishing?.finished_meters ?? "",
        getProcessedMeters(lot),
        toPrintableDate(lot.created_at),
      ]
        .map(escape)
        .join(","),
    );
  }

  return lines.join("\n");
};

const AdminDashboard = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("roles");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [filters, setFilters] = useState(initialFilters);
  const [lots, setLots] = useState([]);
  const [loadingLots, setLoadingLots] = useState(false);
  const [deletingLotId, setDeletingLotId] = useState("");
  const [deleteLotTarget, setDeleteLotTarget] = useState(null);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    setError("");
    const { data, error: fetchError } = await supabase
      .from("profiles")
      .select("id, email, name, role, assigned_stage, created_at")
      .order("created_at", { ascending: true });

    if (fetchError) {
      setError(fetchError.message || "Failed to load users.");
      setLoadingUsers(false);
      return;
    }

    setUsers(data || []);
    setLoadingUsers(false);
  };

  const fetchLots = async () => {
    setLoadingLots(true);
    setError("");
    setSuccess("");

    let query = supabase
      .from("lots")
      .select(
        "id, lot_no, cloth_type, current_stage, status, created_at, party:party_id(name), grey_party:grey_party_id(name), grey_inward(meters), grey_checking(checked_meters, taggas), bleaching(bleach_group_no), dyeing(dyed_meters), stenter(stentered_meters), finishing(finished_meters, finishing_type), folding(input_meters, worker_name, folding_type)",
      )
      .order("created_at", { ascending: false });

    if (filters.lotNo.trim()) query = query.eq("lot_no", Number(filters.lotNo.trim()));
    if (filters.stage) query = query.eq("current_stage", filters.stage);
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.clothType.trim()) query = query.ilike("cloth_type", `%${filters.clothType.trim()}%`);
    if (filters.startDate) query = query.gte("created_at", `${filters.startDate}T00:00:00`);
    if (filters.endDate) query = query.lte("created_at", `${filters.endDate}T23:59:59`);

    const { data, error: fetchError } = await query;
    if (fetchError) {
      setError(fetchError.message || "Failed to load lot status.");
      setLoadingLots(false);
      return;
    }

    const filtered = (data || []).filter((lot) => {
      const partyName = (lot.party?.name || "").toLowerCase();
      const greyPartyName = (lot.grey_party?.name || "").toLowerCase();
      const fParty = filters.partyName.trim().toLowerCase();
      const fGreyParty = filters.greyPartyName.trim().toLowerCase();
      if (fParty && !partyName.includes(fParty)) return false;
      if (fGreyParty && !greyPartyName.includes(fGreyParty)) return false;
      return true;
    });

    setLots(filtered);
    setLoadingLots(false);
  };

  useEffect(() => {
    fetchUsers();
    fetchLots();

    const channel = supabase
      .channel("realtime-admin-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, fetchUsers)
      .on("postgres_changes", { event: "*", schema: "public", table: "lots" }, fetchLots)
      .on("postgres_changes", { event: "*", schema: "public", table: "grey_inward" }, fetchLots)
      .on("postgres_changes", { event: "*", schema: "public", table: "grey_checking" }, fetchLots)
      .on("postgres_changes", { event: "*", schema: "public", table: "bleaching" }, fetchLots)
      .on("postgres_changes", { event: "*", schema: "public", table: "dyeing" }, fetchLots)
      .on("postgres_changes", { event: "*", schema: "public", table: "stenter" }, fetchLots)
      .on("postgres_changes", { event: "*", schema: "public", table: "finishing" }, fetchLots)
      .on("postgres_changes", { event: "*", schema: "public", table: "folding" }, fetchLots)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const updateField = (id, key, value) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, [key]: value } : u)));
  };

  const saveUser = async (user) => {
    setSavingId(user.id);
    setError("");
    setSuccess("");

    const payload = {
      role: user.role,
      assigned_stage: user.assigned_stage || null,
    };

    const { error: updateError } = await supabase.from("profiles").update(payload).eq("id", user.id);

    if (updateError) {
      setError(updateError.message || "Failed to update profile.");
    } else {
      setSuccess("Profile updated.");
    }
    setSavingId("");
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/signin");
  };

  const deleteStaff = async (user) => {
    if (user.role !== "staff") {
      setError("Only staff users can be deleted.");
      return;
    }

    setDeletingId(user.id);
    setError("");
    setSuccess("");

    const { error: deleteError } = await supabase.from("profiles").delete().eq("id", user.id);

    if (deleteError) {
      setError(deleteError.message || "Failed to delete staff.");
    } else {
      setDeleteTarget(null);
      setSuccess("Staff deleted.");
      await fetchUsers();
    }

    setDeletingId("");
  };

  const deleteLot = async (lot) => {
    if (!lot?.id) return;

    setDeletingLotId(lot.id);
    setError("");
    setSuccess("");

    const { error: deleteError } = await supabase.from("lots").delete().eq("id", lot.id);

    if (deleteError) {
      setError(deleteError.message || "Failed to delete lot.");
    } else {
      setDeleteLotTarget(null);
      setSuccess(`Lot #${lot.lot_no} deleted from all stages.`);
      await fetchLots();
    }

    setDeletingLotId("");
  };

  const stats = useMemo(() => {
    const totalLots = lots.length;
    const activeLots = lots.filter((l) => l.status === "active").length;
    const completedLots = lots.filter((l) => l.status === "completed").length;
    const cancelledLots = lots.filter((l) => l.status === "cancelled").length;
    const totalProcessedMeters = lots.reduce((sum, lot) => sum + getProcessedMeters(lot), 0);
    return { totalLots, activeLots, completedLots, cancelledLots, totalProcessedMeters };
  }, [lots]);

  const exportExcelCsv = () => {
    const csv = toCsv(lots);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lot_status_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const rowsHtml = lots
      .map((lot) => {
        const checking = one(lot.grey_checking);
        const bleaching = one(lot.bleaching);
        const dyeing = one(lot.dyeing);
        const stenter = one(lot.stenter);
        const finishing = one(lot.finishing);
        return `
          <tr>
            <td>${lot.lot_no ?? ""}</td>
            <td>${stageLabel(lot.current_stage)}</td>
            <td>${lot.status ?? ""}</td>
            <td>${lot.party?.name ?? ""}</td>
            <td>${lot.grey_party?.name ?? ""}</td>
            <td>${lot.cloth_type ?? ""}</td>
            <td>${checking?.checked_meters ?? ""}</td>
            <td>${bleaching?.bleach_group_no ?? ""}</td>
            <td>${dyeing?.dyed_meters ?? ""}</td>
            <td>${stenter?.stentered_meters ?? ""}</td>
            <td>${finishing?.finished_meters ?? ""}</td>
            <td>${getProcessedMeters(lot)}</td>
            <td>${toPrintableDate(lot.created_at)}</td>
          </tr>
        `;
      })
      .join("");

    const html = `
      <html>
      <head>
        <title>Lot Status Report</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { font-size: 18px; margin: 0 0 12px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
          th { background: #f5f5f5; }
        </style>
      </head>
      <body>
        <h1>Lot Status Report - ${new Date().toLocaleString()}</h1>
        <table>
          <thead>
            <tr>
              <th>Lot No</th><th>Stage</th><th>Status</th><th>Party</th><th>Grey Party</th>
              <th>Cloth</th><th>Checked Mtr</th><th>Bleached No</th><th>Dyed Mtr</th>
              <th>Stentered Mtr</th><th>Finished Mtr</th><th>Processed Mtr</th><th>Created At</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const updateFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-6 sm:px-6">
      <div className="max-w-7xl mx-auto space-y-4 animate-slide-up">
        <div className="glass-card p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
              <p className="text-sm text-gray-600 mt-1">Signed in as {profile?.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-gray-800 to-gray-900 text-white text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
            >
              Logout
            </button>
          </div>

          <div className="mt-4 border-t border-gray-100/70 pt-4 flex flex-wrap gap-2">
            {ADMIN_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all duration-300 ${
                  activeTab === tab.key
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-600 shadow-lg"
                    : "bg-white/80 text-gray-700 border-gray-300 hover:bg-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
        {success && <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">{success}</div>}

        {activeTab === "roles" && (
          <div className="space-y-3">
            {loadingUsers && <div className="text-gray-600">Loading users...</div>}
            {!loadingUsers && users.length === 0 && <div className="text-gray-600">No users found.</div>}

            {!loadingUsers &&
              users.map((u) => (
                <div key={u.id} className="glass-card p-4">
                  <div className="mb-3">
                    <p className="font-semibold text-gray-900 break-all">{u.name || u.email}</p>
                    <p className="text-sm text-gray-600 break-all">{u.email}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="text-sm">
                      <span className="block mb-1 text-gray-700">Role</span>
                      <select
                        value={u.role || "staff"}
                        onChange={(e) => updateField(u.id, "role", e.target.value)}
                        className="w-full px-3 py-2 rounded-xl glass-input outline-none text-sm"
                      >
                        {ROLE_OPTIONS.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="text-sm">
                      <span className="block mb-1 text-gray-700">Assigned Stage</span>
                      <select
                        value={u.assigned_stage || ""}
                        onChange={(e) => updateField(u.id, "assigned_stage", e.target.value)}
                        className="w-full px-3 py-2 rounded-xl glass-input outline-none text-sm"
                      >
                        <option value="">Unassigned</option>
                        {STAGE_OPTIONS.map((stage) => (
                          <option key={stage} value={stage}>
                            {stage}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => saveUser(u)}
                      disabled={savingId === u.id}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold shadow-lg disabled:opacity-60"
                    >
                      {savingId === u.id ? "Saving..." : "Save"}
                    </button>

                    {u.role === "staff" && (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(u)}
                        disabled={deletingId === u.id}
                        className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold shadow-lg disabled:opacity-60"
                      >
                        Delete Staff
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}

        {activeTab === "status" && (
          <div className="space-y-4">
            <div className="glass-card p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Check Lot Status</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <input
                  type="number"
                  placeholder="Lot No"
                  value={filters.lotNo}
                  onChange={(e) => updateFilter("lotNo", e.target.value)}
                  className="glass-input rounded-xl px-3 py-2 text-sm outline-none"
                />
                <select
                  value={filters.stage}
                  onChange={(e) => updateFilter("stage", e.target.value)}
                  className="glass-input rounded-xl px-3 py-2 text-sm outline-none"
                >
                  <option value="">All Stages</option>
                  {[...STAGE_OPTIONS, "completed"].map((stage) => (
                    <option key={stage} value={stage}>
                      {stage}
                    </option>
                  ))}
                </select>
                <select
                  value={filters.status}
                  onChange={(e) => updateFilter("status", e.target.value)}
                  className="glass-input rounded-xl px-3 py-2 text-sm outline-none"
                >
                  <option value="">All Status</option>
                  <option value="active">active</option>
                  <option value="completed">completed</option>
                  <option value="cancelled">cancelled</option>
                </select>
                <input
                  type="text"
                  placeholder="Cloth Type"
                  value={filters.clothType}
                  onChange={(e) => updateFilter("clothType", e.target.value)}
                  className="glass-input rounded-xl px-3 py-2 text-sm outline-none"
                />
                <input
                  type="text"
                  placeholder="Party Name"
                  value={filters.partyName}
                  onChange={(e) => updateFilter("partyName", e.target.value)}
                  className="glass-input rounded-xl px-3 py-2 text-sm outline-none"
                />
                <input
                  type="text"
                  placeholder="Grey Party Name"
                  value={filters.greyPartyName}
                  onChange={(e) => updateFilter("greyPartyName", e.target.value)}
                  className="glass-input rounded-xl px-3 py-2 text-sm outline-none"
                />
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => updateFilter("startDate", e.target.value)}
                  className="glass-input rounded-xl px-3 py-2 text-sm outline-none"
                />
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => updateFilter("endDate", e.target.value)}
                  className="glass-input rounded-xl px-3 py-2 text-sm outline-none"
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={fetchLots}
                  disabled={loadingLots}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold shadow-lg disabled:opacity-60"
                >
                  {loadingLots ? "Fetching..." : "Fetch Details"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilters(initialFilters);
                    setTimeout(fetchLots, 0);
                  }}
                  className="px-4 py-2 rounded-xl bg-white/80 border border-gray-300 text-sm"
                >
                  Reset Filters
                </button>
                <button
                  type="button"
                  onClick={exportPdf}
                  disabled={!lots.length}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-gray-800 to-gray-900 text-white text-sm font-semibold shadow-lg disabled:opacity-60"
                >
                  Download PDF
                </button>
                <button
                  type="button"
                  onClick={exportExcelCsv}
                  disabled={!lots.length}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 text-white text-sm font-semibold shadow-lg disabled:opacity-60"
                >
                  Download Excel
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="glass-card p-4">
                <p className="text-xs text-gray-500">Total Lots</p>
                <p className="text-2xl font-semibold">{stats.totalLots}</p>
              </div>
              <div className="glass-card p-4">
                <p className="text-xs text-gray-500">Active</p>
                <p className="text-2xl font-semibold">{stats.activeLots}</p>
              </div>
              <div className="glass-card p-4">
                <p className="text-xs text-gray-500">Completed</p>
                <p className="text-2xl font-semibold">{stats.completedLots}</p>
              </div>
              <div className="glass-card p-4">
                <p className="text-xs text-gray-500">Cancelled</p>
                <p className="text-2xl font-semibold">{stats.cancelledLots}</p>
              </div>
              <div className="glass-card p-4">
                <p className="text-xs text-gray-500">Total Processed Meters</p>
                <p className="text-2xl font-semibold">{stats.totalProcessedMeters.toFixed(2)}</p>
              </div>
            </div>

            <div className="glass-card p-4 sm:p-6 overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-200">
                    <th className="py-2 pr-3">Lot</th>
                    <th className="py-2 pr-3">Stage</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Party</th>
                  <th className="py-2 pr-3">Grey Party</th>
                  <th className="py-2 pr-3">Cloth</th>
                  <th className="py-2 pr-3">Processed Meters</th>
                  <th className="py-2 pr-3">Created At</th>
                  <th className="py-2 pr-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {!loadingLots && !lots.length && (
                  <tr>
                      <td colSpan={9} className="py-4 text-gray-500">
                        No lots found for selected filters.
                      </td>
                    </tr>
                  )}
                  {lots.map((lot) => (
                    <tr key={lot.id} className="border-b border-gray-100">
                      <td className="py-2 pr-3 font-medium">#{lot.lot_no}</td>
                      <td className="py-2 pr-3">{stageLabel(lot.current_stage)}</td>
                      <td className="py-2 pr-3">{lot.status}</td>
                      <td className="py-2 pr-3">{lot.party?.name || "-"}</td>
                      <td className="py-2 pr-3">{lot.grey_party?.name || "-"}</td>
                      <td className="py-2 pr-3">{lot.cloth_type || "-"}</td>
                      <td className="py-2 pr-3">{getProcessedMeters(lot).toFixed(2)}</td>
                      <td className="py-2 pr-3">{toPrintableDate(lot.created_at)}</td>
                      <td className="py-2 pr-3">
                        <button
                          type="button"
                          onClick={() => setDeleteLotTarget(lot)}
                          disabled={deletingLotId === lot.id}
                          className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold shadow disabled:opacity-60"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {deleteLotTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              if (!deletingLotId) setDeleteLotTarget(null);
            }}
          />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-900">Delete Lot</h3>
            <p className="mt-2 text-sm text-gray-700">
              Delete lot <span className="font-semibold">#{deleteLotTarget.lot_no}</span> from all workflow stages?
            </p>
            <p className="mt-1 text-xs text-gray-500">This action cannot be undone.</p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteLotTarget(null)}
                disabled={Boolean(deletingLotId)}
                className="px-4 py-2 rounded-xl bg-white border border-gray-300 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteLot(deleteLotTarget)}
                disabled={deletingLotId === deleteLotTarget.id}
                className="px-4 py-2 rounded-xl bg-red-700 text-white text-sm font-semibold shadow-lg disabled:opacity-60"
              >
                {deletingLotId === deleteLotTarget.id ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              if (!deletingId) setDeleteTarget(null);
            }}
          />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-900">Delete Staff Account</h3>
            <p className="mt-2 text-sm text-gray-700">
              Delete <span className="font-semibold">{deleteTarget.name || deleteTarget.email}</span>?
            </p>
            <p className="mt-1 text-xs text-gray-500">This action cannot be undone.</p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={Boolean(deletingId)}
                className="px-4 py-2 rounded-xl bg-white border border-gray-300 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteStaff(deleteTarget)}
                disabled={deletingId === deleteTarget.id}
                className="px-4 py-2 rounded-xl bg-red-700 text-white text-sm font-semibold shadow-lg disabled:opacity-60"
              >
                {deletingId === deleteTarget.id ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
