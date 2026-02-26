import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const FOLDING_TYPE_OPTIONS = [
  { value: "single_fold", label: "Single Fold" },
  { value: "double_fold", label: "Double Fold" },
  { value: "double_fold_checking", label: "Double Fold + Checking" },
  { value: "single_fold_cutting", label: "Single Fold + Cutting" },
];

const FoldingStagePanel = ({ userId }) => {
  const [mode, setMode] = useState("list");
  const [rows, setRows] = useState([]);
  const [lotData, setLotData] = useState(null);
  const [recordId, setRecordId] = useState(null);
  const [recordLocked, setRecordLocked] = useState(false);
  const [workerName, setWorkerName] = useState("");
  const [foldingType, setFoldingType] = useState("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadList = async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: listError } = await supabase
        .from("lots")
        .select("id, lot_no, finishing!inner(finished_meters, finishing_type)")
        .eq("current_stage", "folding")
        .eq("status", "active")
        .order("lot_no", { ascending: false });

      if (listError) throw listError;
      setRows(data || []);
    } catch (e) {
      setError(e.message || "Failed to load folding lots.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadList();

    const channel = supabase
      .channel("realtime-folding-stage")
      .on("postgres_changes", { event: "*", schema: "public", table: "lots" }, loadList)
      .on("postgres_changes", { event: "*", schema: "public", table: "finishing" }, loadList)
      .on("postgres_changes", { event: "*", schema: "public", table: "folding" }, loadList)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const openLot = async (lotId) => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const { data: lot, error: lotError } = await supabase
        .from("lots")
        .select("id, lot_no, current_stage, status, finishing!inner(finished_meters, finishing_type)")
        .eq("id", lotId)
        .single();
      if (lotError) throw lotError;
      if (lot.current_stage !== "folding") {
        throw new Error(`Lot is in ${lot.current_stage} stage, not folding.`);
      }

      const { data: existing, error: foldingError } = await supabase
        .from("folding")
        .select("id, worker_name, folding_type, is_locked")
        .eq("lot_id", lotId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (foldingError) throw foldingError;

      setLotData(lot);
      setRecordId(existing?.id || null);
      setRecordLocked(Boolean(existing?.is_locked));
      setWorkerName(existing?.worker_name || "");
      setFoldingType(existing?.folding_type || "");
      setMode("form");
    } catch (e) {
      setError(e.message || "Failed to open folding lot.");
    } finally {
      setLoading(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!lotData?.id) {
      setError("Open a valid lot first.");
      return;
    }
    if (!workerName.trim() || !foldingType) {
      setError("Labour name and folding type are required.");
      return;
    }
    if (recordLocked) {
      setError("This folding record is already sent/locked.");
      return;
    }

    const finishing = Array.isArray(lotData.finishing) ? lotData.finishing[0] : lotData.finishing;
    const inputMeters = finishing?.finished_meters ?? null;

    setSaving(true);
    try {
      if (recordId) {
        const { error: updateError } = await supabase
          .from("folding")
          .update({
            input_meters: inputMeters,
            worker_name: workerName.trim(),
            folding_type: foldingType,
          })
          .eq("id", recordId);
        if (updateError) throw updateError;
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from("folding")
          .insert({
            lot_id: lotData.id,
            input_meters: inputMeters,
            worker_name: workerName.trim(),
            folding_type: foldingType,
            created_by: userId,
          })
          .select("id")
          .single();
        if (insertError) throw insertError;
        setRecordId(inserted.id);
      }

      setSuccess("Folding data saved. You can now complete this lot.");
      await loadList();
    } catch (e) {
      setError(e.message || "Failed to save folding data.");
    } finally {
      setSaving(false);
    }
  };

  const sendToCompleted = async () => {
    setError("");
    setSuccess("");
    if (!lotData?.id) {
      setError("Open a lot first.");
      return;
    }

    setSending(true);
    try {
      const { error: rpcError } = await supabase.rpc("send_folding_to_completed", {
        p_lot_id: lotData.id,
        p_done_by: userId,
      });
      if (rpcError) throw rpcError;

      setSuccess(`Lot #${lotData.lot_no} marked as completed.`);
      setMode("list");
      setLotData(null);
      setRecordId(null);
      setRecordLocked(false);
      setWorkerName("");
      setFoldingType("");
      await loadList();
    } catch (e) {
      setError(e.message || "Failed to complete lot.");
    } finally {
      setSending(false);
    }
  };

  if (mode === "list") {
    return (
      <div className="glass-card p-4 sm:p-6">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Folding Dashboard</h2>
          <button
            type="button"
            onClick={loadList}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-gray-100 border border-gray-300 text-sm disabled:opacity-60"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

        {loading ? (
          <p className="text-sm text-gray-600">Loading lots in folding stage...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-600">No lots are currently in folding stage.</p>
        ) : (
          <div className="space-y-3">
            {rows.map((lot) => {
              const finishing = Array.isArray(lot.finishing) ? lot.finishing[0] : lot.finishing;
              return (
                <div key={lot.id} className="rounded-lg border border-gray-200 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-gray-900">Lot #{lot.lot_no}</p>
                    <button
                      type="button"
                      onClick={() => openLot(lot.id)}
                      className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-gray-800 to-gray-900 text-white text-xs font-semibold shadow"
                    >
                      Open
                    </button>
                  </div>
                  <p>Finishing Type: {finishing?.finishing_type || "-"}</p>
                  <p>Meters From Previous Stage: {finishing?.finished_meters ?? "-"}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const finishing = Array.isArray(lotData?.finishing) ? lotData.finishing[0] : lotData?.finishing;

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => {
          setMode("list");
          setLotData(null);
          setRecordId(null);
          setRecordLocked(false);
          setWorkerName("");
          setFoldingType("");
          setError("");
          setSuccess("");
        }}
        className="px-4 py-2 rounded-xl bg-white/80 border border-gray-300 text-sm"
      >
        Back To Folding Dashboard
      </button>

      <div className="glass-card p-4 sm:p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Folding Entry</h2>
        <p className="text-sm text-gray-600 mb-4">Lot No: <span className="font-semibold">{lotData?.lot_no}</span></p>

        <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm">
          <p>Finishing Type: <span className="font-medium">{finishing?.finishing_type || "-"}</span></p>
          <p>Meters From Previous Stage: <span className="font-medium">{finishing?.finished_meters ?? "-"}</span></p>
        </div>

        {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
        {success && <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">{success}</div>}

        <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="block mb-1 text-gray-700">Labour Name</span>
            <input
              type="text"
              value={workerName}
              onChange={(e) => setWorkerName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl glass-input outline-none"
              disabled={recordLocked || sending}
            />
          </label>

          <label className="text-sm">
            <span className="block mb-1 text-gray-700">Folding Type</span>
            <select
              value={foldingType}
              onChange={(e) => setFoldingType(e.target.value)}
              className="w-full px-3 py-2 rounded-xl glass-input outline-none"
              required
              disabled={recordLocked || sending}
            >
              <option value="">Select Folding Type</option>
              {FOLDING_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>

          <div className="sm:col-span-2 flex flex-col sm:flex-row gap-2">
            <button
              type="submit"
              disabled={saving || recordLocked || sending}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold shadow-lg disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={sendToCompleted}
              disabled={sending || recordLocked || !lotData?.id}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-gray-800 to-gray-900 text-white text-sm font-semibold shadow-lg disabled:opacity-60"
            >
              {sending ? "Sending..." : "Mark Lot Completed"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FoldingStagePanel;

