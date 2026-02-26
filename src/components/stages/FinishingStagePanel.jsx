import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const FINISHING_TYPE_OPTIONS = [
  { value: "cold_felt", label: "Cold Felt" },
  { value: "double_felt", label: "Double Felt" },
  { value: "single_felt", label: "Single Felt" },
  { value: "cold_finish", label: "Cold Finish" },
];

const FinishingStagePanel = ({ userId }) => {
  const [mode, setMode] = useState("list");
  const [rows, setRows] = useState([]);
  const [lotData, setLotData] = useState(null);
  const [recordId, setRecordId] = useState(null);
  const [recordLocked, setRecordLocked] = useState(false);
  const [finishingType, setFinishingType] = useState("");

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
        .select("id, lot_no, stenter!inner(stentered_meters, stenter_no)")
        .eq("current_stage", "finishing")
        .eq("status", "active")
        .order("lot_no", { ascending: false });

      if (listError) throw listError;
      setRows(data || []);
    } catch (e) {
      setError(e.message || "Failed to load finishing lots.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadList();
  }, []);

  const openLot = async (lotId) => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const { data: lot, error: lotError } = await supabase
        .from("lots")
        .select("id, lot_no, current_stage, status, stenter!inner(stentered_meters, stenter_no)")
        .eq("id", lotId)
        .single();
      if (lotError) throw lotError;
      if (lot.current_stage !== "finishing") {
        throw new Error(`Lot is in ${lot.current_stage} stage, not finishing.`);
      }

      const { data: existing, error: finishingError } = await supabase
        .from("finishing")
        .select("id, finishing_type, is_locked")
        .eq("lot_id", lotId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (finishingError) throw finishingError;

      setLotData(lot);
      setRecordId(existing?.id || null);
      setRecordLocked(Boolean(existing?.is_locked));
      setFinishingType(existing?.finishing_type || "");
      setMode("form");
    } catch (e) {
      setError(e.message || "Failed to open finishing lot.");
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
    if (!finishingType) {
      setError("Finishing type is required.");
      return;
    }
    if (recordLocked) {
      setError("This finishing record is already sent/locked.");
      return;
    }

    const stenter = Array.isArray(lotData.stenter) ? lotData.stenter[0] : lotData.stenter;
    const inputMeters = stenter?.stentered_meters ?? null;

    setSaving(true);
    try {
      if (recordId) {
        const { error: updateError } = await supabase
          .from("finishing")
          .update({
            input_meters: inputMeters,
            finished_meters: inputMeters,
            finishing_type: finishingType,
          })
          .eq("id", recordId);
        if (updateError) throw updateError;
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from("finishing")
          .insert({
            lot_id: lotData.id,
            input_meters: inputMeters,
            finished_meters: inputMeters,
            finishing_type: finishingType,
            created_by: userId,
          })
          .select("id")
          .single();
        if (insertError) throw insertError;
        setRecordId(inserted.id);
      }

      setSuccess("Finishing data saved. You can now send to folding stage.");
      await loadList();
    } catch (e) {
      setError(e.message || "Failed to save finishing data.");
    } finally {
      setSaving(false);
    }
  };

  const sendToFolding = async () => {
    setError("");
    setSuccess("");
    if (!lotData?.id) {
      setError("Open a lot first.");
      return;
    }

    setSending(true);
    try {
      const { error: rpcError } = await supabase.rpc("send_finishing_to_folding", {
        p_lot_id: lotData.id,
        p_done_by: userId,
      });
      if (rpcError) throw rpcError;

      setSuccess(`Lot #${lotData.lot_no} sent to folding stage.`);
      setMode("list");
      setLotData(null);
      setRecordId(null);
      setRecordLocked(false);
      setFinishingType("");
      await loadList();
    } catch (e) {
      setError(e.message || "Failed to send lot to folding.");
    } finally {
      setSending(false);
    }
  };

  if (mode === "list") {
    return (
      <div className="glass-card p-4 sm:p-6">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Finishing Dashboard</h2>
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
          <p className="text-sm text-gray-600">Loading lots in finishing stage...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-600">No lots are currently in finishing stage.</p>
        ) : (
          <div className="space-y-3">
            {rows.map((lot) => {
              const stenter = Array.isArray(lot.stenter) ? lot.stenter[0] : lot.stenter;
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
                  <p>Stenter No: {stenter?.stenter_no ?? "-"}</p>
                  <p>Stentered Meters: {stenter?.stentered_meters ?? "-"}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const stenter = Array.isArray(lotData?.stenter) ? lotData.stenter[0] : lotData?.stenter;

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => {
          setMode("list");
          setLotData(null);
          setRecordId(null);
          setRecordLocked(false);
          setFinishingType("");
          setError("");
          setSuccess("");
        }}
        className="px-4 py-2 rounded-xl bg-white/80 border border-gray-300 text-sm"
      >
        Back To Finishing Dashboard
      </button>

      <div className="glass-card p-4 sm:p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Finishing Entry</h2>
        <p className="text-sm text-gray-600 mb-4">Lot No: <span className="font-semibold">{lotData?.lot_no}</span></p>

        <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm">
          <p>Stenter No: <span className="font-medium">{stenter?.stenter_no ?? "-"}</span></p>
          <p>Meters From Previous Stage: <span className="font-medium">{stenter?.stentered_meters ?? "-"}</span></p>
        </div>

        {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
        {success && <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">{success}</div>}

        <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="block mb-1 text-gray-700">Finishing Type</span>
            <select
              value={finishingType}
              onChange={(e) => setFinishingType(e.target.value)}
              className="w-full px-3 py-2 rounded-xl glass-input outline-none"
              required
              disabled={recordLocked || sending}
            >
              <option value="">Select Finishing Type</option>
              {FINISHING_TYPE_OPTIONS.map((opt) => (
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
              onClick={sendToFolding}
              disabled={sending || recordLocked || !lotData?.id}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-gray-800 to-gray-900 text-white text-sm font-semibold shadow-lg disabled:opacity-60"
            >
              {sending ? "Sending..." : "Send To Folding Stage"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FinishingStagePanel;

