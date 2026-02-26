import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const BLEACH_TYPE_OPTIONS = [
  "hand_poly",
  "hand_cotton",
  "power_poly",
  "power_cotton",
  "power_cotton_squeezing",
  "others",
];

const NEXT_STAGE_OPTIONS = ["dyeing", "stenter"];

const BleachingStagePanel = ({ userId }) => {
  const [mode, setMode] = useState("list");
  const [rows, setRows] = useState([]);
  const [lotData, setLotData] = useState(null);
  const [recordId, setRecordId] = useState(null);
  const [bleachLotNo, setBleachLotNo] = useState(null);
  const [recordLocked, setRecordLocked] = useState(false);
  const [form, setForm] = useState({ bleach_type: "", next_stage: "" });

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
        .select(
          "id, lot_no, bleaching(bleach_group_no), grey_checking!inner(checked_meters, taggas)",
        )
        .eq("current_stage", "bleaching")
        .eq("status", "active")
        .order("lot_no", { ascending: false });

      if (listError) throw listError;
      setRows(data || []);
    } catch (e) {
      setError(e.message || "Failed to load bleaching lots.");
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
        .select("id, lot_no, current_stage, status, grey_checking!inner(checked_meters, taggas)")
        .eq("id", lotId)
        .single();
      if (lotError) throw lotError;
      if (lot.current_stage !== "bleaching") {
        throw new Error(`Lot is in ${lot.current_stage} stage, not bleaching.`);
      }

      const { data: existing, error: bleachError } = await supabase
        .from("bleaching")
        .select("id, bleach_group_no, bleach_type, next_stage, is_locked")
        .eq("lot_id", lotId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (bleachError) throw bleachError;

      setLotData(lot);
      setRecordId(existing?.id || null);
      setBleachLotNo(existing?.bleach_group_no || null);
      setRecordLocked(Boolean(existing?.is_locked));
      setForm({
        bleach_type: existing?.bleach_type || "",
        next_stage: existing?.next_stage || "",
      });
      setMode("form");
    } catch (e) {
      setError(e.message || "Failed to open bleaching lot.");
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
    if (!form.bleach_type || !form.next_stage) {
      setError("Bleach type and next stage are required.");
      return;
    }
    if (recordLocked) {
      setError("This bleaching record is already sent/locked.");
      return;
    }

    setSaving(true);
    try {
      if (recordId) {
        const { error: updateError } = await supabase
          .from("bleaching")
          .update({
            bleach_type: form.bleach_type,
            next_stage: form.next_stage,
          })
          .eq("id", recordId);
        if (updateError) throw updateError;
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from("bleaching")
          .insert({
            lot_id: lotData.id,
            bleach_type: form.bleach_type,
            next_stage: form.next_stage,
            created_by: userId,
          })
          .select("id, bleach_group_no")
          .single();
        if (insertError) throw insertError;
        setRecordId(inserted.id);
        setBleachLotNo(inserted.bleach_group_no);
      }

      setSuccess("Bleaching data saved. You can send this lot to next stage.");
      await loadList();
    } catch (e) {
      setError(e.message || "Failed to save bleaching data.");
    } finally {
      setSaving(false);
    }
  };

  const sendToNextStage = async () => {
    setError("");
    setSuccess("");
    if (!lotData?.id) {
      setError("Open a lot first.");
      return;
    }

    setSending(true);
    try {
      const { error: rpcError } = await supabase.rpc("send_bleaching_to_next_stage", {
        p_lot_id: lotData.id,
        p_done_by: userId,
      });
      if (rpcError) throw rpcError;

      setSuccess(`Lot #${lotData.lot_no} sent to next stage.`);
      setMode("list");
      setLotData(null);
      setRecordId(null);
      setBleachLotNo(null);
      setRecordLocked(false);
      setForm({ bleach_type: "", next_stage: "" });
      await loadList();
    } catch (e) {
      setError(e.message || "Failed to send lot to next stage.");
    } finally {
      setSending(false);
    }
  };

  if (mode === "list") {
    return (
      <div className="glass-card p-4 sm:p-6">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Bleaching Dashboard</h2>
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
          <p className="text-sm text-gray-600">Loading lots in bleaching stage...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-600">No lots are currently in bleaching stage.</p>
        ) : (
          <div className="space-y-3">
            {rows.map((lot) => {
              const checking = Array.isArray(lot.grey_checking) ? lot.grey_checking[0] : lot.grey_checking;
              const bleaching = Array.isArray(lot.bleaching) ? lot.bleaching[0] : lot.bleaching;
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
                  <p>Checked Meters: {checking?.checked_meters ?? "-"}</p>
                  <p>Tagga: {checking?.taggas ?? "-"}</p>
                  <p>Bleached Lot No: {bleaching?.bleach_group_no ?? "Will generate on first save"}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const checking = Array.isArray(lotData?.grey_checking) ? lotData.grey_checking[0] : lotData?.grey_checking;

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => {
          setMode("list");
          setLotData(null);
          setRecordId(null);
          setBleachLotNo(null);
          setRecordLocked(false);
          setForm({ bleach_type: "", next_stage: "" });
          setError("");
          setSuccess("");
        }}
        className="px-4 py-2 rounded-xl bg-white/80 border border-gray-300 text-sm"
      >
        Back To Bleaching Dashboard
      </button>

      <div className="glass-card p-4 sm:p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Bleaching Entry</h2>
        <p className="text-sm text-gray-600">Lot No: <span className="font-semibold">{lotData?.lot_no}</span></p>
        <p className="text-sm text-gray-600 mb-4">Bleached Lot No: <span className="font-semibold">{bleachLotNo || "Will generate on save"}</span></p>

        <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm space-y-1">
          <p>Checked Meters: <span className="font-medium">{checking?.checked_meters ?? "-"}</span></p>
          <p>Tagga: <span className="font-medium">{checking?.taggas ?? "-"}</span></p>
        </div>

        {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
        {success && <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">{success}</div>}

        <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="block mb-1 text-gray-700">Bleach Type</span>
            <select
              value={form.bleach_type}
              onChange={(e) => setForm((prev) => ({ ...prev, bleach_type: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl glass-input outline-none"
              required
              disabled={recordLocked || sending}
            >
              <option value="">Select Bleach Type</option>
              {BLEACH_TYPE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="block mb-1 text-gray-700">Next Stage</span>
            <select
              value={form.next_stage}
              onChange={(e) => setForm((prev) => ({ ...prev, next_stage: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl glass-input outline-none"
              required
              disabled={recordLocked || sending}
            >
              <option value="">Select Next Stage</option>
              {NEXT_STAGE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
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
              onClick={sendToNextStage}
              disabled={sending || recordLocked || !lotData?.id}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-gray-800 to-gray-900 text-white text-sm font-semibold shadow-lg disabled:opacity-60"
            >
              {sending ? "Sending..." : "Send To Next Stage"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BleachingStagePanel;

