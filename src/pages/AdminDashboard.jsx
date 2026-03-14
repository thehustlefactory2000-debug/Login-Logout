import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { syncLotWorkflowState } from "../lib/lotWorkflow";
import AdminBillingPanel from "../components/admin/dashboard/AdminBillingPanel";
import AdminDashboardHeader from "../components/admin/dashboard/AdminDashboardHeader";
import AdminInstructionsPanel from "../components/admin/dashboard/AdminInstructionsPanel";
import AdminRatesPanel from "../components/admin/dashboard/AdminRatesPanel";
import AdminRolesPanel from "../components/admin/dashboard/AdminRolesPanel";
import AdminStatusPanel from "../components/admin/dashboard/AdminStatusPanel";
import {
  ADMIN_TAB_SET,
  ConfirmDialog,
  TAB_DETAILS,
  emptyInstructionEditor,
  getProcessedMeters,
  initialFilters,
  one,
  stageLabel,
  toCsv,
  toPrintableDate,
} from "../components/admin/dashboard/adminDashboardShared";

const emptyFilterSuggestions = {
  lotNos: [],
  clothTypes: [],
  partyNames: [],
  greyPartyNames: [],
};

const AdminDashboard = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [filters, setFilters] = useState(initialFilters);
  const [filterSuggestions, setFilterSuggestions] = useState(emptyFilterSuggestions);
  const [lots, setLots] = useState([]);
  const [loadingLots, setLoadingLots] = useState(false);
  const [deletingLotId, setDeletingLotId] = useState("");
  const [deleteLotTarget, setDeleteLotTarget] = useState(null);
  const [instructionEditor, setInstructionEditor] = useState(emptyInstructionEditor);
  const [loadingInstruction, setLoadingInstruction] = useState(false);
  const [savingInstruction, setSavingInstruction] = useState(false);
  const instructionEditorRef = useRef(null);

  const activeTab = ADMIN_TAB_SET.has(searchParams.get("tab")) ? searchParams.get("tab") : "roles";
  const activeInstructionLotId = searchParams.get("lot") || "";

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

  const fetchFilterSuggestions = async () => {
    const [lotsResult, clothTypesResult, partyResult, greyPartyResult] = await Promise.all([
      supabase.from("lots").select("lot_no").order("lot_no", { ascending: false }).limit(20),
      supabase.from("cloth_types").select("name").order("name", { ascending: true }).limit(20),
      supabase.from("parties").select("name").eq("type", "party").order("name", { ascending: true }).limit(20),
      supabase.from("parties").select("name").eq("type", "grey_party").order("name", { ascending: true }).limit(20),
    ]);

    setFilterSuggestions({
      lotNos: [...new Set((lotsResult.data || []).map((row) => String(row.lot_no)).filter(Boolean))].slice(0, 10),
      clothTypes: [...new Set((clothTypesResult.data || []).map((row) => row.name).filter(Boolean))].slice(0, 10),
      partyNames: [...new Set((partyResult.data || []).map((row) => row.name).filter(Boolean))].slice(0, 10),
      greyPartyNames: [...new Set((greyPartyResult.data || []).map((row) => row.name).filter(Boolean))].slice(0, 10),
    });
  };

  const fetchLots = async () => {
    setLoadingLots(true);
    setError("");
    setSuccess("");

    let query = supabase
      .from("lots")
      .select(
        "id, lot_no, cloth_type, current_stage, status, created_at, party:party_id(name), grey_party:grey_party_id(name), grey_inward(meters), grey_checking(checked_meters, checked_length, jodis, taggas), bleaching(bleach_group_no, bleach_type, input_meters, output_meters, is_locked), masrise(input_meters, completed_meters, is_locked), dyeing(input_meters, dyed_meters, is_locked), stenter(input_meters, stentered_meters, stenter_type, is_locked), finishing(input_meters, finished_meters, finishing_type, is_locked), folding(input_meters, worker_name, folding_type, is_locked)",
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
      const filterParty = filters.partyName.trim().toLowerCase();
      const filterGreyParty = filters.greyPartyName.trim().toLowerCase();
      if (filterParty && !partyName.includes(filterParty)) return false;
      if (filterGreyParty && !greyPartyName.includes(filterGreyParty)) return false;
      return true;
    });

    setLots(filtered);
    setLoadingLots(false);
  };

  useEffect(() => {
    fetchUsers();
    fetchLots();
    fetchFilterSuggestions().catch(() => {});

    const channel = supabase
      .channel("realtime-admin-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, fetchUsers)
      .on("postgres_changes", { event: "*", schema: "public", table: "lots" }, () => {
        fetchLots();
        fetchFilterSuggestions().catch(() => {});
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "grey_inward" }, fetchLots)
      .on("postgres_changes", { event: "*", schema: "public", table: "grey_checking" }, fetchLots)
      .on("postgres_changes", { event: "*", schema: "public", table: "bleaching" }, fetchLots)
      .on("postgres_changes", { event: "*", schema: "public", table: "masrise" }, fetchLots)
      .on("postgres_changes", { event: "*", schema: "public", table: "dyeing" }, fetchLots)
      .on("postgres_changes", { event: "*", schema: "public", table: "stenter" }, fetchLots)
      .on("postgres_changes", { event: "*", schema: "public", table: "finishing" }, fetchLots)
      .on("postgres_changes", { event: "*", schema: "public", table: "folding" }, fetchLots)
      .on("postgres_changes", { event: "*", schema: "public", table: "cloth_types" }, () => fetchFilterSuggestions().catch(() => {}))
      .on("postgres_changes", { event: "*", schema: "public", table: "parties" }, () => fetchFilterSuggestions().catch(() => {}))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (activeTab !== "instructions" || !activeInstructionLotId) return;
    if (instructionEditor.lotId === activeInstructionLotId) return;
    loadInstructionLotById(activeInstructionLotId);
  }, [activeInstructionLotId, activeTab]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const updateField = (id, key, value) => {
    setUsers((prev) => prev.map((user) => (user.id === id ? { ...user, [key]: value } : user)));
  };

  const saveUser = async (user) => {
    setSavingId(user.id);
    setError("");
    setSuccess("");

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        role: user.role,
        assigned_stage: user.assigned_stage || null,
      })
      .eq("id", user.id);

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

    let deleteError = null;
    ({ error: deleteError } = await supabase.rpc("delete_lot", { p_lot_id: lot.id }));

    if (deleteError) {
      const message = deleteError.message || "";
      const missingDeleteRpc =
        message.includes("Could not find the function public.delete_lot") ||
        message.includes("function public.delete_lot");

      if (missingDeleteRpc) {
        ({ error: deleteError } = await supabase.from("lots").delete().eq("id", lot.id));
      }
    }

    if (deleteError) {
      setError(deleteError.message || "Failed to delete lot.");
    } else {
      setDeleteLotTarget(null);
      setSuccess(`Lot #${lot.lot_no} deleted from all stages.`);
      await fetchLots();
      await fetchFilterSuggestions();
    }

    setDeletingLotId("");
  };

  const stats = useMemo(() => {
    const totalLots = lots.length;
    const activeLots = lots.filter((lot) => lot.status === "active").length;
    const completedLots = lots.filter((lot) => lot.status === "completed").length;
    const cancelledLots = lots.filter((lot) => lot.status === "cancelled").length;
    const totalProcessedMeters = lots.reduce((sum, lot) => sum + getProcessedMeters(lot), 0);
    return { totalLots, activeLots, completedLots, cancelledLots, totalProcessedMeters };
  }, [lots]);

  const instructionLots = useMemo(
    () =>
      lots.filter((lot) => {
        const checking = one(lot.grey_checking);
        return Boolean(checking?.checked_meters);
      }),
    [lots],
  );

  const exportExcelCsv = () => {
    const csv = toCsv(lots);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lot_status_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  const resetFilters = () => {
    setFilters(initialFilters);
    setTimeout(fetchLots, 0);
  };

  const setActiveTab = (tabKey) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", tabKey);
    if (tabKey !== "instructions") next.delete("lot");
    setSearchParams(next);
    setIsSidebarOpen(false);
  };

  const openInstructionLotPage = (lotId) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", "instructions");
    next.set("lot", lotId);
    setSearchParams(next);
  };

  const closeInstructionLotPage = () => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", "instructions");
    next.delete("lot");
    setSearchParams(next);
    setInstructionEditor(emptyInstructionEditor);
  };

  const updateInstructionField = (key, value) => {
    setInstructionEditor((prev) => ({ ...prev, [key]: value }));
  };

  const loadInstructionLotById = async (lotId, fallbackLotNo = "") => {
    if (!lotId) {
      setError("Enter a valid lot number.");
      return;
    }

    setLoadingInstruction(true);
    setError("");
    setSuccess("");
    openInstructionLotPage(lotId);
    try {
      const { data: lot, error: lotError } = await supabase
        .from("lots")
        .select("id, lot_no, current_stage, status, grey_checking(checked_meters, checked_length, jodis), bleaching(id, bleach_type, next_stage, input_meters, is_locked), masrise(id, instruction, input_meters, is_locked), dyeing(id, input_meters, is_locked), stenter(id, input_meters, stenter_type, is_locked), finishing(id, input_meters, finishing_type, is_locked), folding(id, input_meters, folding_type, is_locked)")
        .eq("id", lotId)
        .single();

      if (lotError) throw lotError;

      const checking = one(lot.grey_checking);
      const bleaching = one(lot.bleaching);
      const masrise = one(lot.masrise);
      const dyeing = one(lot.dyeing);
      const stenter = one(lot.stenter);
      const finishing = one(lot.finishing);
      const folding = one(lot.folding);

      setInstructionEditor({
        lotNo: String(lot.lot_no || fallbackLotNo || ""),
        lotId: lot.id,
        currentStage: lot.current_stage || "",
        status: lot.status || "",
        checkedMeters: checking?.checked_meters ?? "",
        checkedLength: checking?.checked_length ?? "",
        checkedJodis: checking?.jodis ?? "",
        include_bleaching: Boolean(bleaching?.id),
        bleach_locked: Boolean(bleaching?.is_locked),
        bleach_type: bleaching?.bleach_type || "",
        include_masrise: Boolean(masrise?.id),
        masrise_locked: Boolean(masrise?.is_locked),
        masrise_instruction: masrise?.instruction || "",
        include_dyeing: Boolean(dyeing?.id),
        dyeing_locked: Boolean(dyeing?.is_locked),
        include_stenter: Boolean(stenter?.id),
        stenter_locked: Boolean(stenter?.is_locked),
        stenter_type: stenter?.stenter_type || "",
        include_finishing: Boolean(finishing?.id),
        finishing_locked: Boolean(finishing?.is_locked),
        finishing_type: finishing?.finishing_type || "",
        include_folding: Boolean(folding?.id),
        folding_locked: Boolean(folding?.is_locked),
        folding_type: folding?.folding_type || "",
      });
      setTimeout(() => {
        instructionEditorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    } catch (e) {
      setError(e.message || "Failed to load lot instructions.");
    } finally {
      setLoadingInstruction(false);
    }
  };

  const loadInstructionLot = async (lotNoValue) => {
    const lotNo = Number(lotNoValue);
    if (!Number.isFinite(lotNo)) {
      setError("Enter a valid lot number.");
      return;
    }

    const matchingLot = lots.find((lot) => Number(lot.lot_no) === lotNo);
    if (matchingLot?.id) {
      await loadInstructionLotById(matchingLot.id, lotNoValue);
      return;
    }

    setLoadingInstruction(true);
    setError("");
    setSuccess("");
    try {
      const { data, error: lotError } = await supabase.from("lots").select("id, lot_no").eq("lot_no", lotNo).single();
      if (lotError) throw lotError;
      await loadInstructionLotById(data.id, lotNoValue);
    } catch (e) {
      setError(e.message || "Failed to load lot instructions.");
    } finally {
      setLoadingInstruction(false);
    }
  };

  const toggleInstructionStage = (stageKey) => {
    const lockedKey = `${stageKey === "bleaching" ? "bleach" : stageKey}_locked`;
    const includeKey = `include_${stageKey}`;

    setInstructionEditor((prev) => {
      if (prev[lockedKey]) return prev;
      const next = { ...prev, [includeKey]: !prev[includeKey] };
      if (!next[includeKey]) {
        if (stageKey === "bleaching") next.bleach_type = "";
        if (stageKey === "masrise") next.masrise_instruction = "";
        if (stageKey === "finishing") next.finishing_type = "";
        if (stageKey === "folding") next.folding_type = "";
      }
      return next;
    });
  };

  const upsertOrDeleteInstructionStage = async (table, stageState) => {
    const { include, locked, lotId, record, payload } = stageState;
    if (locked) return;
    if (include) {
      if (record?.id) {
        const { error: updateError } = await supabase.from(table).update(payload).eq("id", record.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from(table).insert({ lot_id: lotId, ...payload });
        if (insertError) throw insertError;
      }
    } else if (record?.id) {
      const { error: deleteError } = await supabase.from(table).delete().eq("id", record.id);
      if (deleteError) throw deleteError;
    }
  };

  const saveInstructionChanges = async () => {
    if (!instructionEditor.lotId) {
      setError("Load a lot first.");
      return;
    }

    const plannedMeters = instructionEditor.checkedMeters === "" ? null : Number(instructionEditor.checkedMeters);
    if (plannedMeters == null || !Number.isFinite(plannedMeters)) {
      setError("Checked meters are required in checking before changing instructions.");
      return;
    }

    setSavingInstruction(true);
    setError("");
    setSuccess("");
    try {
      const { data: snapshot, error: snapshotError } = await supabase
        .from("lots")
        .select("id, bleaching(id, is_locked), masrise(id, is_locked), dyeing(id, is_locked), stenter(id, is_locked), finishing(id, is_locked), folding(id, is_locked)")
        .eq("id", instructionEditor.lotId)
        .single();
      if (snapshotError) throw snapshotError;

      const bleaching = one(snapshot.bleaching);
      const masrise = one(snapshot.masrise);
      const dyeing = one(snapshot.dyeing);
      const stenter = one(snapshot.stenter);
      const finishing = one(snapshot.finishing);
      const folding = one(snapshot.folding);

      if (instructionEditor.include_bleaching && !instructionEditor.bleach_type) {
        throw new Error("Bleach type is required.");
      }
      if (instructionEditor.include_finishing && !instructionEditor.finishing_type) {
        throw new Error("Finishing type is required.");
      }
      if (instructionEditor.include_folding && !instructionEditor.folding_type) {
        throw new Error("Folding type is required.");
      }

      await upsertOrDeleteInstructionStage("bleaching", {
        include: instructionEditor.include_bleaching,
        locked: instructionEditor.bleach_locked,
        lotId: instructionEditor.lotId,
        record: bleaching,
        payload: {
          bleach_type: instructionEditor.bleach_type,
          next_stage: instructionEditor.include_dyeing ? "dyeing" : "stenter",
          input_meters: plannedMeters,
        },
      });

      await upsertOrDeleteInstructionStage("masrise", {
        include: instructionEditor.include_masrise,
        locked: instructionEditor.masrise_locked,
        lotId: instructionEditor.lotId,
        record: masrise,
        payload: {
          instruction: instructionEditor.masrise_instruction.trim() || null,
          input_meters: plannedMeters,
        },
      });

      await upsertOrDeleteInstructionStage("dyeing", {
        include: instructionEditor.include_dyeing,
        locked: instructionEditor.dyeing_locked,
        lotId: instructionEditor.lotId,
        record: dyeing,
        payload: {
          input_meters: plannedMeters,
          sent_to_stenter: true,
        },
      });

      await upsertOrDeleteInstructionStage("stenter", {
        include: instructionEditor.include_stenter,
        locked: instructionEditor.stenter_locked,
        lotId: instructionEditor.lotId,
        record: stenter,
        payload: {
          input_meters: plannedMeters,
        },
      });

      await upsertOrDeleteInstructionStage("finishing", {
        include: instructionEditor.include_finishing,
        locked: instructionEditor.finishing_locked,
        lotId: instructionEditor.lotId,
        record: finishing,
        payload: {
          input_meters: plannedMeters,
          finishing_type: instructionEditor.finishing_type,
        },
      });

      await upsertOrDeleteInstructionStage("folding", {
        include: instructionEditor.include_folding,
        locked: instructionEditor.folding_locked,
        lotId: instructionEditor.lotId,
        record: folding,
        payload: {
          input_meters: plannedMeters,
          folding_type: instructionEditor.folding_type,
        },
      });

      await syncLotWorkflowState(instructionEditor.lotId);
      await fetchLots();
      setSuccess("Lot instructions updated.");
    } catch (e) {
      setError(e.message || "Failed to update lot instructions.");
    } finally {
      setSavingInstruction(false);
    }
  };

  const activeTabConfig = TAB_DETAILS[activeTab];

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto flex min-h-screen max-w-[1600px] lg:gap-6 lg:px-4 lg:py-4">
        <AdminDashboardHeader
          activeTab={activeTab}
          profileEmail={profile?.email}
          userCount={users.length}
          onTabChange={setActiveTab}
          onSignOut={handleSignOut}
          isSidebarOpen={isSidebarOpen}
          onSidebarClose={() => setIsSidebarOpen(false)}
        />

        <main className="min-w-0 flex-1 px-4 py-4 lg:px-0 lg:py-0">
          <div className="mx-auto space-y-4 lg:max-w-none">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{activeTabConfig.eyebrow}</p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-950 sm:text-2xl">{activeTabConfig.title}</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{activeTabConfig.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(true)}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-700 lg:hidden"
                  aria-label="Open navigation"
                >
                  <span className="text-xl leading-none">=</span>
                </button>
              </div>
            </div>

            {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

            {activeTab === "roles" && (
              <AdminRolesPanel
                users={users}
                loadingUsers={loadingUsers}
                savingId={savingId}
                deletingId={deletingId}
                onFieldChange={updateField}
                onSaveUser={saveUser}
                onDeleteRequest={setDeleteTarget}
              />
            )}

            {activeTab === "status" && (
              <AdminStatusPanel
                filters={filters}
                filterSuggestions={filterSuggestions}
                lots={lots}
                stats={stats}
                loadingLots={loadingLots}
                deletingLotId={deletingLotId}
                onFilterChange={updateFilter}
                onFetchLots={fetchLots}
                onResetFilters={resetFilters}
                onExportPdf={exportPdf}
                onExportExcelCsv={exportExcelCsv}
                onDeleteLotRequest={setDeleteLotTarget}
                getProcessedMeters={getProcessedMeters}
              />
            )}

            {activeTab === "instructions" && (
              <AdminInstructionsPanel
                instructionEditor={instructionEditor}
                instructionLots={instructionLots}
                activeInstructionLotId={activeInstructionLotId}
                loadingInstruction={loadingInstruction}
                loadingLots={loadingLots}
                savingInstruction={savingInstruction}
                instructionEditorRef={instructionEditorRef}
                onInstructionFieldChange={updateInstructionField}
                onLoadInstructionLot={loadInstructionLot}
                onLoadInstructionLotById={loadInstructionLotById}
                onCloseInstructionLotPage={closeInstructionLotPage}
                onToggleInstructionStage={toggleInstructionStage}
                onSaveInstructionChanges={saveInstructionChanges}
              />
            )}

            {activeTab === "rates" && <AdminRatesPanel />}
            {activeTab === "billing" && <AdminBillingPanel />}
          </div>
        </main>
      </div>

      {deleteLotTarget && (
        <ConfirmDialog
          title="Delete Lot"
          description={`Delete lot #${deleteLotTarget.lot_no} from all workflow stages?`}
          hint="This action cannot be undone."
          onCancel={() => setDeleteLotTarget(null)}
          onConfirm={() => deleteLot(deleteLotTarget)}
          confirmLabel="Confirm Delete"
          busy={deletingLotId === deleteLotTarget.id}
          danger
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Staff Account"
          description={`Delete ${deleteTarget.name || deleteTarget.email}?`}
          hint="This action cannot be undone."
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => deleteStaff(deleteTarget)}
          confirmLabel="Confirm Delete"
          busy={deletingId === deleteTarget.id}
          danger
        />
      )}
    </div>
  );
};

export default AdminDashboard;






