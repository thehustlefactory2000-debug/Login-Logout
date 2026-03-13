import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { buildSearchIndex, filterIndexedRows } from "../../lib/stageSearch";
import { markStageRecordCompleted, syncLotWorkflowState } from "../../lib/lotWorkflow";

const one = (value) => (Array.isArray(value) ? value[0] : value) || null;

const FinishingStagePanel = () => {
  const [mode, setMode] = useState("list");
  const [rows, setRows] = useState([]);
  const [lotData, setLotData] = useState(null);
  const [recordId, setRecordId] = useState(null);
  const [recordLocked, setRecordLocked] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
        .select("id, lot_no, status, stenter(input_meters), finishing(id, input_meters, finishing_type, is_locked)")
        .eq("status", "active")
        .order("lot_no", { ascending: false });
      if (listError) throw listError;
      setRows((data || []).filter((lot) => {
        const finishing = one(lot.finishing);
        return finishing?.id && !finishing.is_locked;
      }));
    } catch (e) {
      setError(e.message || "Failed to load finishing lots.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadList();
    const channel = supabase
      .channel("realtime-finishing-stage")
      .on("postgres_changes", { event: "*", schema: "public", table: "lots" }, loadList)
      .on("postgres_changes", { event: "*", schema: "public", table: "stenter" }, loadList)
      .on("postgres_changes", { event: "*", schema: "public", table: "finishing" }, loadList)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const indexedRows = useMemo(
    () =>
      rows.map((lot) => {
        const finishing = one(lot.finishing);
        return {
          row: lot,
          index: buildSearchIndex({
            lot: lot.lot_no,
            meters: finishing?.input_meters,
            type: finishing?.finishing_type,
          }),
        };
      }),
    [rows],
  );

  const filteredRows = useMemo(() => filterIndexedRows(indexedRows, search), [indexedRows, search]);

  const openLot = async (lotId) => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const { data: lot, error: lotError } = await supabase
        .from("lots")
        .select("id, lot_no, status, stenter(input_meters), finishing(id, input_meters, finishing_type, is_locked)")
        .eq("id", lotId)
        .single();
      if (lotError) throw lotError;
      const existing = one(lot.finishing);
      if (!existing?.id) throw new Error("Finishing instruction not found for this lot.");
      setLotData(lot);
      setRecordId(existing.id);
      setRecordLocked(Boolean(existing.is_locked));
      setMode("form");
    } catch (e) {
      setError(e.message || "Failed to open finishing lot.");
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
      await markStageRecordCompleted("finishing", recordId);
      await syncLotWorkflowState(lotData.id);
      setSuccess(`Lot #${lotData.lot_no} finishing marked completed.`);
      resetForm();
      await loadList();
    } catch (e) {
      setError(e.message || "Failed to complete finishing.");
    } finally {
      setSending(false);
    }
  };

  if (mode === "list") {
    return (
      <div className="glass-card p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-xl surface-title">Finishing Dashboard</h2>
          <button type="button" onClick={loadList} disabled={loading} className="btn-secondary btn-sm disabled:opacity-60">
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <div className="mb-3">
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search (e.g. lot:120, type:cold, meters:490)" className="w-full rounded-xl glass-input px-3 py-2 text-sm outline-none sm:max-w-md" />
        </div>
        {loading ? <p className="text-sm text-gray-600">Loading lots in finishing stage...</p> : filteredRows.length === 0 ? <p className="text-sm text-gray-600">No lots are currently in finishing stage.</p> : (
          <div className="space-y-3">
            {filteredRows.map((lot) => {
              const finishing = one(lot.finishing);
              return (
                <div key={lot.id} className="rounded-xl border border-slate-200/80 bg-white/70 p-3 text-sm shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-gray-900">Lot #{lot.lot_no}</p>
                    <button type="button" onClick={() => openLot(lot.id)} className="btn-dark btn-sm">Open</button>
                  </div>
                  <p>Finishing Type: {finishing?.finishing_type || "-"}</p>
                  <p>Planned Input Meters: {finishing?.input_meters ?? "-"}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const finishing = one(lotData?.finishing);
  const stenter = one(lotData?.stenter);

  return (
    <div className="space-y-3">
      <button type="button" onClick={resetForm} className="btn-secondary">Back To Finishing Dashboard</button>
      <div className="glass-card p-4 sm:p-6">
        <h2 className="mb-2 text-xl surface-title">Finishing Instruction</h2>
        <p className="mb-4 text-sm text-gray-600">Lot No: <span className="font-semibold">{lotData?.lot_no}</span></p>
        <div className="mb-4 space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm">
          <p>Finishing Type: <span className="font-medium">{finishing?.finishing_type || "-"}</span></p>
          <p>Planned Input Meters: <span className="font-medium">{finishing?.input_meters ?? stenter?.input_meters ?? "-"}</span></p>
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

export default FinishingStagePanel;
