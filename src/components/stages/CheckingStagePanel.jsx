import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const CHECKING_METHOD_OPTIONS = [
  "cotton_fabric",
  "cotton",
  "stamp",
  "poly_stamp",
  "roto_stamp",
  "roto_tube",
  "others",
];

const emptyForm = {
  checking_method: "",
  input_meters: "",
  checked_meters: "",
  jodis: "",
  taggas: "",
  tp: "",
  fold: "",
  less_short: "",
};

const CheckingStagePanel = ({ userId }) => {
  const [mode, setMode] = useState("list");
  const [rows, setRows] = useState([]);
  const [selectedLotId, setSelectedLotId] = useState(null);
  const [lotData, setLotData] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [recordId, setRecordId] = useState(null);
  const [recordLocked, setRecordLocked] = useState(false);

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
          "id, lot_no, cloth_type, created_at, party:party_id(name), grey_party:grey_party_id(name), grey_inward!inner(meters, jodis, tagge, fold_details, border)",
        )
        .eq("current_stage", "checking")
        .eq("status", "active")
        .order("lot_no", { ascending: false });

      if (listError) throw listError;
      setRows(data || []);
    } catch (e) {
      setError(e.message || "Failed to load checking lots.");
    } finally {
      setLoading(false);
    }
  };

  const loadLot = async (lotId) => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const { data: lot, error: lotError } = await supabase
        .from("lots")
        .select(
          "id, lot_no, cloth_type, current_stage, status, party:party_id(name), grey_party:grey_party_id(name), grey_inward!inner(meters, jodis, tagge, fold_details, border)",
        )
        .eq("id", lotId)
        .single();

      if (lotError) throw lotError;
      if (lot.current_stage !== "checking") {
        throw new Error(`Lot is in ${lot.current_stage} stage, not checking.`);
      }

      const inward = Array.isArray(lot.grey_inward) ? lot.grey_inward[0] : lot.grey_inward;
      if (!inward) throw new Error("Grey inward data not found for this lot.");

      const { data: existing, error: checkingError } = await supabase
        .from("grey_checking")
        .select("id, checking_method, input_meters, checked_meters, jodis, taggas, tp, fold, less_short, is_locked")
        .eq("lot_id", lotId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (checkingError) throw checkingError;

      setLotData(lot);
      setRecordId(existing?.id || null);
      setRecordLocked(Boolean(existing?.is_locked));
      setForm({
        checking_method: existing?.checking_method || "",
        input_meters: existing?.input_meters ?? inward.meters ?? "",
        checked_meters: existing?.checked_meters ?? "",
        jodis: existing?.jodis ?? inward.jodis ?? "",
        taggas: existing?.taggas ?? inward.tagge ?? "",
        tp: existing?.tp || "",
        fold: existing?.fold ?? inward.fold_details ?? "",
        less_short: existing?.less_short ?? "",
      });
      setMode("form");
    } catch (e) {
      setError(e.message || "Failed to open checking form.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadList();
  }, []);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const save = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!lotData?.id) {
      setError("Select a valid lot from checking dashboard.");
      return;
    }
    if (!form.checking_method) {
      setError("Checking method is required.");
      return;
    }
    if (recordLocked) {
      setError("This checking record is already sent/locked.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        lot_id: lotData.id,
        checking_method: form.checking_method,
        input_meters: form.input_meters === "" ? null : Number(form.input_meters),
        checked_meters: form.checked_meters === "" ? null : Number(form.checked_meters),
        jodis: form.jodis === "" ? null : Number(form.jodis),
        taggas: form.taggas === "" ? null : Number(form.taggas),
        tp: form.tp.trim() || null,
        fold: form.fold.trim() || null,
        less_short: form.less_short === "" ? null : Number(form.less_short),
        created_by: userId,
      };

      if (recordId) {
        const { error: updateError } = await supabase
          .from("grey_checking")
          .update({
            checking_method: payload.checking_method,
            input_meters: payload.input_meters,
            checked_meters: payload.checked_meters,
            jodis: payload.jodis,
            taggas: payload.taggas,
            tp: payload.tp,
            fold: payload.fold,
            less_short: payload.less_short,
          })
          .eq("id", recordId);
        if (updateError) throw updateError;
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from("grey_checking")
          .insert(payload)
          .select("id")
          .single();
        if (insertError) throw insertError;
        setRecordId(inserted.id);
      }

      setSuccess("Checking data saved. You can edit until you send to next stage.");
      await loadList();
    } catch (e) {
      setError(e.message || "Failed to save checking data.");
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
      const { error: rpcError } = await supabase.rpc("send_checking_to_bleaching", {
        p_lot_id: lotData.id,
        p_done_by: userId,
      });
      if (rpcError) throw rpcError;

      setSuccess(`Lot #${lotData.lot_no} sent to bleaching.`);
      setMode("list");
      setSelectedLotId(null);
      setLotData(null);
      setRecordId(null);
      setRecordLocked(false);
      setForm(emptyForm);
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
          <h2 className="text-xl font-semibold text-gray-900">Checking Dashboard</h2>
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
          <p className="text-sm text-gray-600">Loading lots in checking stage...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-600">No lots are currently in checking stage.</p>
        ) : (
          <div className="space-y-3">
            {rows.map((lot) => {
              const inward = Array.isArray(lot.grey_inward) ? lot.grey_inward[0] : lot.grey_inward;
              return (
                <div key={lot.id} className="rounded-lg border border-gray-200 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-gray-900">Lot #{lot.lot_no}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLotId(lot.id);
                        loadLot(lot.id);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-gray-800 to-gray-900 text-white text-xs font-semibold shadow"
                    >
                      Open
                    </button>
                  </div>
                  <p>Party: {lot.party?.name || "-"}</p>
                  <p>Grey Party: {lot.grey_party?.name || "-"}</p>
                  <p>Cloth: {lot.cloth_type || "-"}</p>
                  <p>Input Meters: {inward?.meters ?? "-"}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const inward = Array.isArray(lotData?.grey_inward) ? lotData.grey_inward[0] : lotData?.grey_inward;

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => {
          setMode("list");
          setSelectedLotId(null);
          setLotData(null);
          setRecordId(null);
          setRecordLocked(false);
          setForm(emptyForm);
          setError("");
          setSuccess("");
        }}
        className="px-4 py-2 rounded-xl bg-white/80 border border-gray-300 text-sm"
      >
        Back To Checking Dashboard
      </button>

      <div className="glass-card p-4 sm:p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Checking Entry</h2>
        <p className="text-sm text-gray-600 mb-4">
          Lot No: <span className="font-semibold">{lotData?.lot_no || "-"}</span>
        </p>

        <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm space-y-1">
          <p className="font-semibold text-blue-900">Auto-fetched from Grey Inward</p>
          <p>Party: <span className="font-medium">{lotData?.party?.name || "-"}</span></p>
          <p>Grey Party: <span className="font-medium">{lotData?.grey_party?.name || "-"}</span></p>
          <p>Cloth Type: <span className="font-medium">{lotData?.cloth_type || "-"}</span></p>
          <p>Meters: <span className="font-medium">{inward?.meters ?? "-"}</span></p>
          <p>Jodis: <span className="font-medium">{inward?.jodis ?? "-"}</span></p>
          <p>Tagge: <span className="font-medium">{inward?.tagge ?? "-"}</span></p>
          <p>Fold Details: <span className="font-medium">{inward?.fold_details || "-"}</span></p>
          <p>Border: <span className="font-medium">{inward?.border || "-"}</span></p>
        </div>

        {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
        {success && <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">{success}</div>}

        <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="block mb-1 text-gray-700">Checking Method</span>
            <select
              value={form.checking_method}
              onChange={(e) => setField("checking_method", e.target.value)}
              className="w-full px-3 py-2 rounded-xl glass-input outline-none"
              required
              disabled={recordLocked || sending}
            >
              <option value="">Select Checking Method</option>
              {CHECKING_METHOD_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="block mb-1 text-gray-700">Input Meters</span>
            <input
              type="number"
              step="0.01"
              value={form.input_meters}
              readOnly
              className="w-full px-3 py-2 rounded-xl glass-input outline-none bg-gray-50"
            />
          </label>

          <label className="text-sm">
            <span className="block mb-1 text-gray-700">Checked Meters</span>
            <input
              type="number"
              step="0.01"
              value={form.checked_meters}
              onChange={(e) => setField("checked_meters", e.target.value)}
              className="w-full px-3 py-2 rounded-xl glass-input outline-none"
              disabled={recordLocked || sending}
            />
          </label>

          <label className="text-sm">
            <span className="block mb-1 text-gray-700">Jodis</span>
            <input
              type="number"
              value={form.jodis}
              onChange={(e) => setField("jodis", e.target.value)}
              className="w-full px-3 py-2 rounded-xl glass-input outline-none"
              disabled={recordLocked || sending}
            />
          </label>

          <label className="text-sm">
            <span className="block mb-1 text-gray-700">Taggas</span>
            <input
              type="number"
              value={form.taggas}
              onChange={(e) => setField("taggas", e.target.value)}
              className="w-full px-3 py-2 rounded-xl glass-input outline-none"
              disabled={recordLocked || sending}
            />
          </label>

          <label className="text-sm">
            <span className="block mb-1 text-gray-700">TP</span>
            <input
              type="text"
              value={form.tp}
              onChange={(e) => setField("tp", e.target.value)}
              className="w-full px-3 py-2 rounded-xl glass-input outline-none"
              disabled={recordLocked || sending}
            />
          </label>

          <label className="text-sm">
            <span className="block mb-1 text-gray-700">Fold</span>
            <input
              type="text"
              value={form.fold}
              onChange={(e) => setField("fold", e.target.value)}
              className="w-full px-3 py-2 rounded-xl glass-input outline-none"
              disabled={recordLocked || sending}
            />
          </label>

          <label className="text-sm">
            <span className="block mb-1 text-gray-700">Less / Short</span>
            <input
              type="number"
              step="0.01"
              value={form.less_short}
              onChange={(e) => setField("less_short", e.target.value)}
              className="w-full px-3 py-2 rounded-xl glass-input outline-none"
              disabled={recordLocked || sending}
            />
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
              disabled={sending || recordLocked || !selectedLotId}
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

export default CheckingStagePanel;

