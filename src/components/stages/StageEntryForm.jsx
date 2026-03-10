import React, { useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { STAGE_LABELS } from "../../constants/workflow";

const emptyValueByType = (type) => {
  if (type === "checkbox") return false;
  return "";
};

const StageEntryForm = ({ config, userId }) => {
  const isCheckingStage = config.expectedStage === "checking";
  const [lotNo, setLotNo] = useState("");
  const [lot, setLot] = useState(null);
  const [sourceDetails, setSourceDetails] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const initialForm = useMemo(
    () =>
      config.fields.reduce((acc, field) => {
        acc[field.key] = emptyValueByType(field.type);
        return acc;
      }, {}),
    [config.fields],
  );

  const [form, setForm] = useState(initialForm);

  const refreshLot = async (lotId) => {
    const { data, error: lotError } = await supabase
      .from("lots")
      .select("id, lot_no, current_stage, status")
      .eq("id", lotId)
      .single();

    if (lotError) throw lotError;
    setLot(data);
    return data;
  };

  const findLot = async () => {
    if (!lotNo.trim()) return;
    setLookupLoading(true);
    setError("");
    setSuccess("");
    try {
      const { data, error: lotError } = await supabase
        .from("lots")
        .select("id, lot_no, current_stage, status, cloth_type, party:party_id(name), grey_party:grey_party_id(name)")
        .eq("lot_no", Number(lotNo))
        .single();

      if (lotError) throw lotError;
      setLot(data);

      if (isCheckingStage) {
        const { data: inward, error: inwardError } = await supabase
          .from("grey_inward")
          .select("meters, jodis, length, width, quantity, tagge, fold_details, border, is_locked, created_at")
          .eq("lot_id", data.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (inwardError) throw inwardError;
        setSourceDetails(inward || null);

        if (inward) {
          setForm((prev) => ({
            ...prev,
            input_meters: inward.meters ?? "",
            jodis: inward.jodis ?? "",
            taggas: inward.tagge ?? "",
            fold: inward.fold_details ?? "",
          }));
        }
      } else {
        setSourceDetails(null);
      }
    } catch (e) {
      setLot(null);
      setSourceDetails(null);
      setError(e.message || "Lot not found.");
    } finally {
      setLookupLoading(false);
    }
  };

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const buildPayload = () => {
    const payload = { lot_id: lot.id, created_by: userId };
    for (const field of config.fields) {
      const value = form[field.key];
      if (field.type === "number") {
        payload[field.key] = value === "" ? null : Number(value);
      } else if (field.type === "checkbox") {
        payload[field.key] = Boolean(value);
      } else {
        payload[field.key] = value === "" ? null : value;
      }
    }
    return payload;
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!lot) {
      setError("Search and select a valid lot first.");
      return;
    }
    if (isCheckingStage && !sourceDetails) {
      setError("Grey Inward details not found for this lot. Cannot enter checking.");
      return;
    }
    if (lot.status !== "active") {
      setError("This lot is not active.");
      return;
    }
    if (lot.current_stage !== config.expectedStage) {
      setError(
        `Stage mismatch. Lot is currently in ${STAGE_LABELS[lot.current_stage] || lot.current_stage}.`,
      );
      return;
    }

    setSubmitting(true);
    try {
      const payload = buildPayload();
      const { error: insertError } = await supabase.from(config.table).insert(payload);
      if (insertError) throw insertError;
      const updatedLot = await refreshLot(lot.id);
      setSuccess(
        `Saved successfully. Lot #${updatedLot.lot_no} moved to ${STAGE_LABELS[updatedLot.current_stage] || updatedLot.current_stage}.`,
      );
      setForm(initialForm);
    } catch (e) {
      setError(e.message || "Failed to save stage record.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="glass-card p-4 sm:p-6">
      <h2 className="text-xl surface-title mb-4">{config.title}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 mb-4">
        <input
          type="number"
          placeholder="Enter Lot No"
          value={lotNo}
          onChange={(e) => setLotNo(e.target.value)}
          className="w-full px-3 py-2 rounded-xl glass-input outline-none"
        />
        <button
          type="button"
          onClick={findLot}
          disabled={lookupLoading}
          className="btn-dark disabled:opacity-60"
        >
          {lookupLoading ? "Searching..." : "Search Lot"}
        </button>
      </div>

      {lot && (
        <div className="mb-4 p-3 rounded-lg bg-gray-50 border border-gray-200 text-sm">
          <p>
            Lot #{lot.lot_no} | Current Stage:{" "}
            <span className="font-semibold">{STAGE_LABELS[lot.current_stage] || lot.current_stage}</span>
          </p>
          <p>Status: <span className="font-semibold">{lot.status}</span></p>
        </div>
      )}

      {isCheckingStage && lot && (
        <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm space-y-1">
          <p className="font-semibold text-blue-900">Auto-fetched from Grey Inward</p>
          <p>Party: <span className="font-medium">{lot.party?.name || "-"}</span></p>
          <p>Grey Party: <span className="font-medium">{lot.grey_party?.name || "-"}</span></p>
          <p>Cloth Type: <span className="font-medium">{lot.cloth_type || "-"}</span></p>
          <p>Meters: <span className="font-medium">{sourceDetails?.meters ?? "-"}</span></p>
          <p>Jodis: <span className="font-medium">{sourceDetails?.jodis ?? "-"}</span></p>
          <p>Length: <span className="font-medium">{sourceDetails?.length ?? "-"}</span></p>
          <p>Width: <span className="font-medium">{sourceDetails?.width ?? "-"}</span></p>
          <p>Quantity: <span className="font-medium">{sourceDetails?.quantity || "-"}</span></p>
          <p>Tagge: <span className="font-medium">{sourceDetails?.tagge ?? "-"}</span></p>
          <p>Fold Details: <span className="font-medium">{sourceDetails?.fold_details || "-"}</span></p>
          <p>Border: <span className="font-medium">{sourceDetails?.border || "-"}</span></p>
        </div>
      )}

      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">{success}</div>}

      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {config.fields.map((field) => (
          <label key={field.key} className={`text-sm ${field.type === "checkbox" ? "sm:col-span-2" : ""}`}>
            {field.type !== "checkbox" && <span className="block mb-1 text-gray-700">{field.label}</span>}

            {field.type === "select" && (
              <select
                value={form[field.key]}
                onChange={(e) => setField(field.key, e.target.value)}
                className="w-full px-3 py-2 rounded-xl glass-input outline-none"
                required
              >
                <option value="">Select {field.label}</option>
                {field.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            )}

            {field.type === "number" && (
              <input
                type="number"
                step="0.01"
                value={form[field.key]}
                onChange={(e) => setField(field.key, e.target.value)}
                className="w-full px-3 py-2 rounded-xl glass-input outline-none"
              />
            )}

            {field.type === "text" && (
              <input
                type="text"
                value={form[field.key]}
                onChange={(e) => setField(field.key, e.target.value)}
                className="w-full px-3 py-2 rounded-xl glass-input outline-none"
              />
            )}

            {field.type === "checkbox" && (
              <span className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form[field.key]}
                  onChange={(e) => setField(field.key, e.target.checked)}
                />
                <span className="text-gray-700">{field.label}</span>
              </span>
            )}
          </label>
        ))}

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto btn-primary disabled:opacity-60"
          >
            {submitting ? "Saving..." : "Save Stage Record"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default StageEntryForm;



