import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { buildSearchIndex, filterIndexedRows } from "../../lib/stageSearch";
import { markStageRecordCompleted, syncLotWorkflowState } from "../../lib/lotWorkflow";

const one = (value) => (Array.isArray(value) ? value[0] : value) || null;

const MasriseStagePanel = () => {
  const [mode, setMode] = useState("list");
  const [rows, setRows] = useState([]);
  const [lotData, setLotData] = useState(null);
  const [recordId, setRecordId] = useState(null);
  const [recordLocked, setRecordLocked] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [bulkSending, setBulkSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [bulkError, setBulkError] = useState("");
  const [bulkSuccess, setBulkSuccess] = useState("");
  const [selectedLotIds, setSelectedLotIds] = useState(() => new Set());

  const resetForm = () => {
    setMode("list");
    setLotData(null);
    setRecordId(null);
    setRecordLocked(false);
    setError("");
    setSuccess("");
  };

  const loadList = async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: listError } = await supabase
        .from("lots")
        .select("id, lot_no, status, masrise(id, input_meters, instruction, is_locked)")
        .eq("status", "active")
        .order("lot_no", { ascending: false });
      if (listError) throw listError;
      setRows((data || []).filter((lot) => {
        const masrise = one(lot.masrise);
        return masrise?.id && !masrise.is_locked;
      }));
    } catch (e) {
      setError(e.message || "Failed to load masrise lots.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadList();
    const channel = supabase
      .channel("realtime-masrise-stage")
      .on("postgres_changes", { event: "*", schema: "public", table: "lots" }, loadList)
      .on("postgres_changes", { event: "*", schema: "public", table: "masrise" }, loadList)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const indexedRows = useMemo(
    () =>
      rows.map((lot) => {
        const masrise = one(lot.masrise);
        return {
          row: lot,
          index: buildSearchIndex({
            lot: lot.lot_no,
            meters: masrise?.input_meters,
            instruction: masrise?.instruction,
          }),
        };
      }),
    [rows],
  );

  const filteredRows = useMemo(() => filterIndexedRows(indexedRows, search), [indexedRows, search]);

  useEffect(() => {
    setSelectedLotIds((prev) => {
      if (!prev.size) return prev;
      const allowed = new Set(rows.map((row) => row.id));
      const next = new Set();
      prev.forEach((id) => {
        if (allowed.has(id)) next.add(id);
      });
      return next;
    });
  }, [rows]);

  const toggleSelect = (lotId) => {
    setSelectedLotIds((prev) => {
      const next = new Set(prev);
      if (next.has(lotId)) next.delete(lotId);
      else next.add(lotId);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedLotIds(new Set(filteredRows.map((lot) => lot.id)));
  };

  const clearSelection = () => {
    setSelectedLotIds(new Set());
  };

  const sendSelected = async () => {
    if (!selectedLotIds.size) return;
    const confirmSend = window.confirm(
      `Mark ${selectedLotIds.size} selected lot${selectedLotIds.size === 1 ? "" : "s"} as completed? This will move them to the next stage.`,
    );
    if (!confirmSend) return;

    setBulkSending(true);
    setBulkError("");
    setBulkSuccess("");

    let successCount = 0;
    const failed = [];
    const selectedLots = rows.filter((lot) => selectedLotIds.has(lot.id));

    for (const lot of selectedLots) {
      const masrise = one(lot.masrise);
      if (!masrise?.id) {
        failed.push(`Lot #${lot.lot_no}: missing masrise record`);
        continue;
      }
      try {
        await markStageRecordCompleted("masrise", masrise.id);
        await syncLotWorkflowState(lot.id);
        successCount += 1;
      } catch (err) {
        failed.push(`Lot #${lot.lot_no}: ${err.message || "failed to complete"}`);
      }
    }

    if (successCount) {
      setBulkSuccess(`${successCount} lot${successCount === 1 ? "" : "s"} moved to next stage.`);
    }
    if (failed.length) {
      setBulkError(`Failed for ${failed.length} lot${failed.length === 1 ? "" : "s"}: ${failed.join(" | ")}`);
    }

    clearSelection();
    await loadList();
    setBulkSending(false);
  };

  const openLot = async (lotId) => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const { data: lot, error: lotError } = await supabase
        .from("lots")
        .select("id, lot_no, status, masrise(id, input_meters, instruction, is_locked)")
        .eq("id", lotId)
        .single();
      if (lotError) throw lotError;
      const existing = one(lot.masrise);
      if (!existing?.id) throw new Error("Masrise instruction not found for this lot.");
      setLotData(lot);
      setRecordId(existing.id);
      setRecordLocked(Boolean(existing.is_locked));
      setMode("form");
    } catch (e) {
      setError(e.message || "Failed to open masrise lot.");
    } finally {
      setLoading(false);
    }
  };

  const markCompleted = async () => {
    if (!lotData?.id || !recordId) return setError("Open a lot first.");
    setSending(true);
    setError("");
    setSuccess("");
    try {
      await markStageRecordCompleted("masrise", recordId);
      await syncLotWorkflowState(lotData.id);
      setSuccess(`Lot #${lotData.lot_no} masrise marked completed.`);
      resetForm();
      await loadList();
    } catch (e) {
      setError(e.message || "Failed to complete masrise.");
    } finally {
      setSending(false);
    }
  };

  if (mode === "list") {
    return (
      <div className="glass-card p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-xl surface-title">Masrise Dashboard</h2>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={loadList} disabled={loading} className="btn-secondary btn-sm disabled:opacity-60">
              {loading ? "Refreshing..." : "Refresh"}
            </button>
            <button type="button" onClick={selectAllVisible} disabled={!filteredRows.length} className="btn-secondary btn-sm disabled:opacity-60">
              Select All
            </button>
            <button type="button" onClick={clearSelection} disabled={!selectedLotIds.size} className="btn-secondary btn-sm disabled:opacity-60">
              Clear
            </button>
            <button type="button" onClick={sendSelected} disabled={!selectedLotIds.size || bulkSending} className="btn-dark btn-sm disabled:opacity-60">
              {bulkSending ? "Sending..." : `Send Selected (${selectedLotIds.size})`}
            </button>
          </div>
        </div>
        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {bulkError && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{bulkError}</div>}
        {bulkSuccess && <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{bulkSuccess}</div>}
        <div className="mb-3">
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search (e.g. lot:120, meters:490, instruction:soft)" className="w-full rounded-xl glass-input px-3 py-2 text-sm outline-none sm:max-w-md" />
        </div>
        {loading ? <p className="text-sm text-gray-600">Loading lots in masrise stage...</p> : filteredRows.length === 0 ? <p className="text-sm text-gray-600">No lots are currently in masrise stage.</p> : (
          <div className="space-y-3">
            {filteredRows.map((lot) => {
              const masrise = one(lot.masrise);
              const isSelected = selectedLotIds.has(lot.id);
              return (
                <div key={lot.id} className="rounded-xl border border-slate-200/80 bg-white/70 p-3 text-sm shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(lot.id)}
                        className="h-4 w-4"
                      />
                      <p className="font-semibold text-gray-900">Lot #{lot.lot_no}</p>
                    </label>
                    <button type="button" onClick={() => openLot(lot.id)} className="btn-dark btn-sm">Open</button>
                  </div>
                  <p>Planned Input Meters: {masrise?.input_meters ?? "-"}</p>
                  <p>Instruction: {masrise?.instruction || "-"}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const masrise = one(lotData?.masrise);

  return (
    <div className="space-y-3">
      <button type="button" onClick={resetForm} className="btn-secondary">Back To Masrise Dashboard</button>
      <div className="glass-card p-4 sm:p-6">
        <h2 className="mb-2 text-xl surface-title">Masrise Instruction</h2>
        <p className="mb-4 text-sm text-gray-600">Lot No: <span className="font-semibold">{lotData?.lot_no}</span></p>
        <div className="mb-4 space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm">
          <p>Planned Input Meters: <span className="font-medium">{masrise?.input_meters ?? "-"}</span></p>
          <p>Instruction: <span className="font-medium">{masrise?.instruction || "-"}</span></p>
        </div>
        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {success && <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{success}</div>}
        <button type="button" onClick={markCompleted} disabled={sending || recordLocked} className="btn-dark disabled:opacity-60">
          {sending ? "Completing..." : "Mark Completed"}
        </button>
      </div>
    </div>
  );
};

export default MasriseStagePanel;
