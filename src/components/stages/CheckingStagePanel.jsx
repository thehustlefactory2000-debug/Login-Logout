import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { buildSearchIndex, filterIndexedRows } from "../../lib/stageSearch";

const CHECKING_METHOD_OPTIONS = [
  "Cotton_fabric/Poly_stamp",
  "Cotton_tube",
  "Roto/Plain_tube",
  "Roto_stamp",
  "others",
];

const CHECKING_METHOD_TO_DB = {
  "Cotton_fabric/Poly_stamp": "cotton_fabric",
  Cotton_tube: "cotton",
  "Roto/Plain_tube": "roto_tube",
  Roto_stamp: "roto_stamp",
  others: "others",
};

const DB_TO_CHECKING_METHOD = {
  cotton_fabric: "Cotton_fabric/Poly_stamp",
  cotton: "Cotton_tube",
  stamp: "Cotton_fabric/Poly_stamp",
  poly_stamp: "Cotton_fabric/Poly_stamp",
  roto_tube: "Roto/Plain_tube",
  roto_stamp: "Roto_stamp",
  others: "others",
};

const emptyForm = {
  checking_method: "",
  checker_name: "",
  input_meters: "",
  input_jodis: "",
  checked_meters: "",
  checked_jodis: "",
  taggas: "",
  tp: "",
  fold: "",
  border: "",
  less_short_meters: "",
  less_short_jodis: "",
};

const CheckingStagePanel = ({ userId }) => {
  const [mode, setMode] = useState("list");
  const [rows, setRows] = useState([]);
  const [selectedLotId, setSelectedLotId] = useState(null);
  const [lotData, setLotData] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [recordId, setRecordId] = useState(null);
  const [recordLocked, setRecordLocked] = useState(false);
  const [search, setSearch] = useState("");
  const [checkerNameSuggestions, setCheckerNameSuggestions] = useState([]);
  const [borderSuggestions, setBorderSuggestions] = useState([]);
  const [lessShortMetersEdited, setLessShortMetersEdited] = useState(false);
  const [lessShortJodisEdited, setLessShortJodisEdited] = useState(false);

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
          "id, lot_no, cloth_type, created_at, party:party_id(name), grey_party:grey_party_id(name), grey_inward!inner(meters, jodis, length, width, quantity, tagge, fold_details, border)",
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
          "id, lot_no, cloth_type, current_stage, status, party:party_id(name), grey_party:grey_party_id(name), grey_inward!inner(meters, jodis, length, width, quantity, tagge, fold_details, border)",
        )
        .eq("id", lotId)
        .single();

      if (lotError) throw lotError;
      if (lot.current_stage !== "checking") {
        throw new Error(`Lot is in ${lot.current_stage} stage, not checking.`);
      }

      const inward = Array.isArray(lot.grey_inward) ? lot.grey_inward[0] : lot.grey_inward;
      if (!inward) throw new Error("Grey inward data not found for this lot.");

      let existing = null;
      const { data: withNewCols, error: checkingError } = await supabase
        .from("grey_checking")
        .select("id, checking_method, checker_name, input_meters, checked_meters, jodis, taggas, tp, fold, border, less_short, less_short_meters, less_short_jodis, less_short_meters_manual, less_short_jodis_manual, is_locked")
        .eq("lot_id", lotId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (checkingError) {
        const message = checkingError.message || "";
        const missingCheckerCols =
          message.includes("checker_name") ||
          message.includes("border") ||
          message.includes("less_short_meters") ||
          message.includes("less_short_jodis") ||
          message.includes("less_short_meters_manual") ||
          message.includes("less_short_jodis_manual");
        if (missingCheckerCols) {
          const { data: legacy, error: legacyError } = await supabase
            .from("grey_checking")
            .select("id, checking_method, input_meters, checked_meters, jodis, taggas, tp, fold, less_short, is_locked")
            .eq("lot_id", lotId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (legacyError) throw legacyError;
          existing = legacy;
        } else {
          throw checkingError;
        }
      } else {
        existing = withNewCols;
      }

      setLotData(lot);
      setRecordId(existing?.id || null);
      setRecordLocked(Boolean(existing?.is_locked));
      const hasSplitLessShort =
        existing?.less_short_meters !== undefined || existing?.less_short_jodis !== undefined;
      const checkedJodis = existing?.jodis ?? "";
      const calculatedLessShortMeters = (() => {
        const inwardMeters = Number(inward?.meters ?? "");
        const savedCheckedMeters = Number(existing?.checked_meters ?? "");
        if (!Number.isFinite(inwardMeters) || !Number.isFinite(savedCheckedMeters)) return "";
        return Math.max(inwardMeters - savedCheckedMeters, 0);
      })();
      const calculatedLessShortJodis = (() => {
        const inwardJodis = Number(inward?.jodis ?? "");
        const savedCheckedJodis = Number(checkedJodis);
        if (!Number.isFinite(inwardJodis) || !Number.isFinite(savedCheckedJodis)) return "";
        return Math.max(inwardJodis - savedCheckedJodis, 0);
      })();

      setLessShortMetersEdited(Boolean(existing?.less_short_meters_manual));
      setLessShortJodisEdited(Boolean(existing?.less_short_jodis_manual) || (!hasSplitLessShort && existing?.less_short != null));
      setForm({
        checking_method: DB_TO_CHECKING_METHOD[existing?.checking_method] || "",
        checker_name: existing?.checker_name || "",
        input_meters: existing?.input_meters ?? inward.meters ?? "",
        input_jodis: inward.jodis ?? "",
        checked_meters: existing?.checked_meters ?? "",
        checked_jodis: checkedJodis,
        taggas: existing?.taggas ?? inward.tagge ?? "",
        tp: existing?.tp || "",
        fold: existing?.fold ?? inward.fold_details ?? "",
        border: existing?.border ?? inward.border ?? "",
        less_short_meters: existing?.less_short_meters ?? calculatedLessShortMeters,
        less_short_jodis: existing?.less_short_jodis ?? existing?.less_short ?? calculatedLessShortJodis,
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

    const channel = supabase
      .channel("realtime-checking-stage")
      .on("postgres_changes", { event: "*", schema: "public", table: "lots" }, loadList)
      .on("postgres_changes", { event: "*", schema: "public", table: "grey_inward" }, loadList)
      .on("postgres_changes", { event: "*", schema: "public", table: "grey_checking" }, loadList)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const indexedRows = useMemo(
    () =>
      rows.map((lot) => {
      const inward = Array.isArray(lot.grey_inward) ? lot.grey_inward[0] : lot.grey_inward;
        return {
          row: lot,
          index: buildSearchIndex({
            lot: lot.lot_no,
            party: lot.party?.name,
            grey_party: lot.grey_party?.name,
            cloth: lot.cloth_type,
            meters: inward?.meters,
            jodis: inward?.jodis,
            length: inward?.length,
            width: inward?.width,
            quantity: inward?.quantity,
            qty: inward?.quantity,
            tagge: inward?.tagge,
          }),
        };
      }),
    [rows],
  );

  const filteredRows = useMemo(() => filterIndexedRows(indexedRows, search), [indexedRows, search]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const inward = useMemo(() => {
    if (!lotData?.grey_inward) return null;
    return Array.isArray(lotData.grey_inward) ? lotData.grey_inward[0] : lotData.grey_inward;
  }, [lotData]);

  const calculatedLessShortMeters = useMemo(() => {
    const inwardMeters = Number(inward?.meters ?? "");
    const checkedMeters = Number(form.checked_meters ?? "");
    if (!Number.isFinite(inwardMeters) || !Number.isFinite(checkedMeters)) return "";
    return Math.max(inwardMeters - checkedMeters, 0);
  }, [inward, form.checked_meters]);

  const calculatedLessShortJodis = useMemo(() => {
    const inwardJodis = Number(inward?.jodis ?? "");
    const checkedJodis = Number(form.checked_jodis ?? "");
    if (!Number.isFinite(inwardJodis) || !Number.isFinite(checkedJodis)) return "";
    return Math.max(inwardJodis - checkedJodis, 0);
  }, [inward, form.checked_jodis]);

  useEffect(() => {
    if (recordLocked) return;
    if (!lessShortMetersEdited) {
      setForm((prev) => ({ ...prev, less_short_meters: calculatedLessShortMeters }));
    }
  }, [calculatedLessShortMeters, recordLocked, lessShortMetersEdited]);

  useEffect(() => {
    if (recordLocked) return;
    if (!lessShortJodisEdited) {
      setForm((prev) => ({ ...prev, less_short_jodis: calculatedLessShortJodis }));
    }
  }, [calculatedLessShortJodis, recordLocked, lessShortJodisEdited]);

  const searchCheckerNames = async (value) => {
    let query = supabase
      .from("grey_checking")
      .select("checker_name")
      .not("checker_name", "is", null)
      .order("checker_name", { ascending: true })
      .limit(15);

    if (value.trim()) query = query.ilike("checker_name", `%${value.trim()}%`);
    const { data, error: queryError } = await query;
    if (queryError) {
      const message = queryError.message || "";
      if (message.includes("checker_name")) {
        setCheckerNameSuggestions([]);
        return;
      }
      throw queryError;
    }
    const uniqueNames = [...new Set((data || []).map((row) => row.checker_name).filter(Boolean))];
    setCheckerNameSuggestions(uniqueNames.slice(0, 8));
  };

  const searchBorderSuggestions = async (value) => {
    let query = supabase
      .from("grey_checking")
      .select("border")
      .not("border", "is", null)
      .order("border", { ascending: true })
      .limit(20);

    if (value.trim()) query = query.ilike("border", `%${value.trim()}%`);
    const { data, error: queryError } = await query;
    if (queryError) {
      const message = queryError.message || "";
      if (message.includes("border")) {
        setBorderSuggestions([]);
        return;
      }
      throw queryError;
    }
    const uniqueValues = [...new Set((data || []).map((row) => row.border).filter(Boolean))];
    setBorderSuggestions(uniqueValues.slice(0, 8));
  };

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
        checking_method: CHECKING_METHOD_TO_DB[form.checking_method] || form.checking_method,
        checker_name: form.checker_name.trim() || null,
        input_meters: form.input_meters === "" ? null : Number(form.input_meters),
        checked_meters: form.checked_meters === "" ? null : Number(form.checked_meters),
        jodis: form.checked_jodis === "" ? null : Number(form.checked_jodis),
        taggas: form.taggas === "" ? null : Number(form.taggas),
        tp: form.tp.trim() || null,
        fold: form.fold.trim() || null,
        border: form.border.trim() || null,
        less_short_meters: form.less_short_meters === "" ? null : Number(form.less_short_meters),
        less_short_jodis: form.less_short_jodis === "" ? null : Number(form.less_short_jodis),
        less_short_meters_manual: lessShortMetersEdited,
        less_short_jodis_manual: lessShortJodisEdited,
        created_by: userId,
      };

      if (recordId) {
        const { error: updateError } = await supabase
          .from("grey_checking")
          .update({
            checking_method: payload.checking_method,
            checker_name: payload.checker_name,
            input_meters: payload.input_meters,
            checked_meters: payload.checked_meters,
            jodis: payload.jodis,
            taggas: payload.taggas,
            tp: payload.tp,
            fold: payload.fold,
            border: payload.border,
            less_short_meters: payload.less_short_meters,
            less_short_jodis: payload.less_short_jodis,
            less_short_meters_manual: payload.less_short_meters_manual,
            less_short_jodis_manual: payload.less_short_jodis_manual,
          })
          .eq("id", recordId);
        if (updateError) {
          const message = updateError.message || "";
          const missingCols =
            message.includes("checker_name") ||
            message.includes("border") ||
            message.includes("less_short_meters") ||
            message.includes("less_short_jodis");
          if (missingCols) {
            const { error: legacyUpdateError } = await supabase
              .from("grey_checking")
              .update({
                checking_method: payload.checking_method,
                input_meters: payload.input_meters,
                checked_meters: payload.checked_meters,
                jodis: payload.jodis,
                taggas: payload.taggas,
                tp: payload.tp,
                fold: payload.fold,
                less_short: payload.less_short_jodis,
              })
              .eq("id", recordId);
            if (legacyUpdateError) throw legacyUpdateError;
          } else {
            throw updateError;
          }
        }
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from("grey_checking")
          .insert(payload)
          .select("id")
          .single();
        if (insertError) {
          const message = insertError.message || "";
          const missingCols =
            message.includes("checker_name") ||
            message.includes("border") ||
            message.includes("less_short_meters") ||
            message.includes("less_short_jodis");
          if (missingCols) {
            const legacyPayload = {
              lot_id: payload.lot_id,
              checking_method: payload.checking_method,
              input_meters: payload.input_meters,
              checked_meters: payload.checked_meters,
              jodis: payload.jodis,
              taggas: payload.taggas,
              tp: payload.tp,
              fold: payload.fold,
              less_short: payload.less_short_jodis,
              created_by: payload.created_by,
            };
            const { data: legacyInserted, error: legacyInsertError } = await supabase
              .from("grey_checking")
              .insert(legacyPayload)
              .select("id")
              .single();
            if (legacyInsertError) throw legacyInsertError;
            setRecordId(legacyInserted.id);
          } else {
            throw insertError;
          }
        } else {
          setRecordId(inserted.id);
        }
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
      setLessShortMetersEdited(false);
      setLessShortJodisEdited(false);
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
          <h2 className="text-xl surface-title">Checking Dashboard</h2>
          <button
            type="button"
            onClick={loadList}
            disabled={loading}
            className="btn-secondary btn-sm disabled:opacity-60"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

        <div className="mb-3 flex justify-start">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search (e.g. lot:120, party:ram, qty:500)"
            className="w-full sm:max-w-md px-3 py-2 rounded-xl glass-input outline-none text-sm"
          />
        </div>

        {loading ? (
          <p className="text-sm text-gray-600">Loading lots in checking stage...</p>
        ) : filteredRows.length === 0 ? (
          <p className="text-sm text-gray-600">No lots are currently in checking stage.</p>
        ) : (
          <div className="space-y-3">
            {filteredRows.map((lot) => {
              const inward = Array.isArray(lot.grey_inward) ? lot.grey_inward[0] : lot.grey_inward;
              return (
                <div key={lot.id} className="rounded-xl border border-slate-200/80 bg-white/70 p-3 text-sm shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-gray-900">Lot #{lot.lot_no}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLotId(lot.id);
                        loadLot(lot.id);
                      }}
                      className="btn-dark btn-sm"
                    >
                      Open
                    </button>
                  </div>
                  <p>Party: {lot.party?.name || "-"}</p>
                  <p>Grey Party: {lot.grey_party?.name || "-"}</p>
                  <p>Cloth: {lot.cloth_type || "-"}</p>
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                    <p className="rounded-md bg-gray-50 px-2 py-1">Meters: {inward?.meters ?? "-"}</p>
                    <p className="rounded-md bg-gray-50 px-2 py-1">Jodis: {inward?.jodis ?? "-"}</p>
                    <p className="rounded-md bg-gray-50 px-2 py-1">Length: {inward?.length ?? "-"}</p>
                    <p className="rounded-md bg-gray-50 px-2 py-1">Width: {inward?.width ?? "-"}</p>
                    <p className="rounded-md bg-gray-50 px-2 py-1">Qty: {inward?.quantity || "-"}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

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
          setLessShortMetersEdited(false);
          setLessShortJodisEdited(false);
          setForm(emptyForm);
          setError("");
          setSuccess("");
        }}
        className="btn-secondary"
      >
        Back To Checking Dashboard
      </button>

      <div className="glass-card p-4 sm:p-6">
        <h2 className="text-xl surface-title mb-2">Checking Entry</h2>
        <p className="text-sm text-gray-600 mb-4">
          Lot No: <span className="font-semibold">{lotData?.lot_no || "-"}</span>
        </p>

        <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm space-y-2">
          <p className="font-semibold text-blue-900">Auto-fetched from Grey Inward</p>
          <p>Party: <span className="font-medium">{lotData?.party?.name || "-"}</span></p>
          <p>Grey Party: <span className="font-medium">{lotData?.grey_party?.name || "-"}</span></p>
          <p>Cloth Type: <span className="font-medium">{lotData?.cloth_type || "-"}</span></p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
            <p className="rounded-md bg-white/70 px-2 py-1">Meters: <span className="font-medium">{inward?.meters ?? "-"}</span></p>
            <p className="rounded-md bg-white/70 px-2 py-1">Jodis: <span className="font-medium">{inward?.jodis ?? "-"}</span></p>
            <p className="rounded-md bg-white/70 px-2 py-1">Length: <span className="font-medium">{inward?.length ?? "-"}</span></p>
            <p className="rounded-md bg-white/70 px-2 py-1">Width: <span className="font-medium">{inward?.width ?? "-"}</span></p>
            <p className="rounded-md bg-white/70 px-2 py-1">Quantity: <span className="font-medium">{inward?.quantity || "-"}</span></p>
            <p className="rounded-md bg-white/70 px-2 py-1">Tagge: <span className="font-medium">{inward?.tagge ?? "-"}</span></p>
          </div>
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
            <span className="block mb-1 text-gray-700">Checker Name</span>
            <input
              type="text"
              list="checker-name-suggestions"
              value={form.checker_name}
              onChange={(e) => {
                setField("checker_name", e.target.value);
                searchCheckerNames(e.target.value);
              }}
              onFocus={() => searchCheckerNames("")}
              className="w-full px-3 py-2 rounded-xl glass-input outline-none"
              disabled={recordLocked || sending}
            />
            <datalist id="checker-name-suggestions">
              {checkerNameSuggestions.map((name) => <option key={name} value={name} />)}
            </datalist>
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
            <span className="block mb-1 text-gray-700">Input Jodis</span>
            <input
              type="number"
              step="0.01"
              value={form.input_jodis}
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
            <span className="block mb-1 text-gray-700">Checked Jodis</span>
            <input
              type="number"
              step="0.01"
              value={form.checked_jodis}
              onChange={(e) => setField("checked_jodis", e.target.value)}
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
            <span className="block mb-1 text-gray-700">Border</span>
            <input
              type="text"
              list="checking-border-suggestions"
              value={form.border}
              onChange={(e) => {
                setField("border", e.target.value);
                searchBorderSuggestions(e.target.value);
              }}
              onFocus={() => searchBorderSuggestions("")}
              className="w-full px-3 py-2 rounded-xl glass-input outline-none"
              disabled={recordLocked || sending}
            />
            <datalist id="checking-border-suggestions">
              {borderSuggestions.map((value) => <option key={value} value={value} />)}
            </datalist>
          </label>

          <label className="text-sm">
            <span className="block mb-1 text-gray-700">Less / Short Meters</span>
            <input
              type="number"
              step="0.01"
              value={form.less_short_meters}
              onChange={(e) => {
                setLessShortMetersEdited(true);
                setField("less_short_meters", e.target.value);
              }}
              className="w-full px-3 py-2 rounded-xl glass-input outline-none"
              disabled={recordLocked || sending}
            />
          </label>

          <label className="text-sm">
            <span className="block mb-1 text-gray-700">Less / Short Jodis</span>
            <input
              type="number"
              step="0.01"
              value={form.less_short_jodis}
              onChange={(e) => {
                setLessShortJodisEdited(true);
                setField("less_short_jodis", e.target.value);
              }}
              className="w-full px-3 py-2 rounded-xl glass-input outline-none"
              disabled={recordLocked || sending}
            />
          </label>

          <div className="sm:col-span-2 flex flex-col sm:flex-row gap-2">
            <button
              type="submit"
              disabled={saving || recordLocked || sending}
              className="btn-primary disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={sendToNextStage}
              disabled={sending || recordLocked || !selectedLotId}
              className="btn-dark disabled:opacity-60"
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
