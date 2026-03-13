import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { buildSearchIndex, filterIndexedRows } from "../../lib/stageSearch";
import { syncLotWorkflowState } from "../../lib/lotWorkflow";

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

const BLEACH_TYPE_OPTIONS = [
  "hand_poly",
  "hand_cotton",
  "power_poly",
  "power_cotton",
  "power_cotton_squeezing",
  "others",
];

const FINISHING_TYPE_OPTIONS = [
  { value: "cold_felt", label: "Cold Felt" },
  { value: "double_felt", label: "Double Felt" },
  { value: "single_felt", label: "Single Felt" },
  { value: "cold_finish", label: "Cold Finish" },
];

const FOLDING_TYPE_OPTIONS = [
  { value: "single_fold", label: "Single Fold" },
  { value: "double_fold", label: "Double Fold" },
  { value: "double_fold_checking", label: "Double Fold + Checking" },
  { value: "single_fold_cutting", label: "Single Fold + Cutting" },
];

const STAGE_CARD_CONFIG = [
  { key: "bleaching", label: "Bleaching" },
  { key: "masrise", label: "Masrise" },
  { key: "dyeing", label: "Dyeing" },
  { key: "stenter", label: "Stenter" },
  { key: "finishing", label: "Finishing" },
  { key: "folding", label: "Folding" },
];

const emptyForm = {
  checking_method: "",
  checker_name: "",
  checked_jodis: "",
  checked_length: "",
  checked_meters: "",
  taggas: "",
  tp: "",
  fold: "",
  border: "",
  less_short_meters: "",
  less_short_jodis: "",
  include_bleaching: false,
  bleach_type: "",
  include_masrise: false,
  masrise_instruction: "",
  include_dyeing: false,
  include_stenter: false,
  include_finishing: false,
  finishing_type: "",
  include_folding: false,
  folding_type: "",
};

const one = (value) => (Array.isArray(value) ? value[0] : value) || null;

const calculateCheckedMeters = (jodisValue, lengthValue) => {
  const parsedJodis = Number(jodisValue);
  const parsedLength = Number(lengthValue);
  if (!Number.isFinite(parsedJodis) || !Number.isFinite(parsedLength)) return "";
  return (Math.round(parsedJodis * parsedLength * 100) / 100).toFixed(2);
};

const StageCard = ({ title, description, selected, onToggle, disabled, children }) => (
  <div
    className={`rounded-2xl border p-4 shadow-sm transition ${
      selected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white/80"
    }`}
  >
    <div className="flex items-start justify-between gap-3">
      <div>
        <h4 className={`text-sm font-semibold ${selected ? "text-white" : "text-slate-900"}`}>{title}</h4>
        <p className={`mt-1 text-xs ${selected ? "text-slate-200" : "text-slate-600"}`}>{description}</p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
          selected ? "bg-white text-slate-900" : "border border-slate-300 bg-slate-50 text-slate-700"
        } disabled:opacity-60`}
      >
        {selected ? "Selected" : "Select"}
      </button>
    </div>
    {selected && children ? <div className="mt-4 space-y-3">{children}</div> : null}
  </div>
);

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

  const resetFormState = () => {
    setSelectedLotId(null);
    setLotData(null);
    setRecordId(null);
    setRecordLocked(false);
    setLessShortMetersEdited(false);
    setLessShortJodisEdited(false);
    setForm(emptyForm);
    setError("");
    setSuccess("");
  };

  const loadList = async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: listError } = await supabase
        .from("lots")
        .select("id, lot_no, cloth_type, created_at, party:party_id(name), grey_party:grey_party_id(name), grey_inward!inner(meters, jodis, length, width, quantity, tagge, fold_details, border)")
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
        const inward = one(lot.grey_inward);
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
  const inward = useMemo(() => one(lotData?.grey_inward), [lotData]);
  const calculatedCheckedMeters = useMemo(
    () => calculateCheckedMeters(form.checked_jodis, form.checked_length),
    [form.checked_jodis, form.checked_length],
  );

  const selectedStages = useMemo(
    () => STAGE_CARD_CONFIG.filter((stage) => form[`include_${stage.key}`]).map((stage) => stage.label),
    [form],
  );

  const calculatedLessShortMeters = useMemo(() => {
    const inwardMeters = Number(inward?.meters ?? "");
    const checkedMeters = Number(calculatedCheckedMeters ?? "");
    if (!Number.isFinite(inwardMeters) || !Number.isFinite(checkedMeters)) return "";
    return Math.max(inwardMeters - checkedMeters, 0);
  }, [calculatedCheckedMeters, inward]);

  const calculatedLessShortJodis = useMemo(() => {
    const inwardJodis = Number(inward?.jodis ?? "");
    const checkedJodis = Number(form.checked_jodis ?? "");
    if (!Number.isFinite(inwardJodis) || !Number.isFinite(checkedJodis)) return "";
    return Math.max(inwardJodis - checkedJodis, 0);
  }, [form.checked_jodis, inward]);

  useEffect(() => {
    if (recordLocked) return;
    setForm((prev) => ({ ...prev, checked_meters: calculatedCheckedMeters }));
  }, [calculatedCheckedMeters, recordLocked]);

  useEffect(() => {
    if (recordLocked || lessShortMetersEdited) return;
    setForm((prev) => ({ ...prev, less_short_meters: calculatedLessShortMeters }));
  }, [calculatedLessShortMeters, lessShortMetersEdited, recordLocked]);

  useEffect(() => {
    if (recordLocked || lessShortJodisEdited) return;
    setForm((prev) => ({ ...prev, less_short_jodis: calculatedLessShortJodis }));
  }, [calculatedLessShortJodis, lessShortJodisEdited, recordLocked]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const toggleStage = (stageKey) => {
    setForm((prev) => {
      const includeKey = `include_${stageKey}`;
      const nextSelected = !prev[includeKey];
      const next = { ...prev, [includeKey]: nextSelected };

      if (!nextSelected) {
        if (stageKey === "bleaching") next.bleach_type = "";
        if (stageKey === "masrise") next.masrise_instruction = "";
        if (stageKey === "finishing") {
          next.finishing_type = "";
          next.include_folding = false;
          next.folding_type = "";
        }
        if (stageKey === "folding") next.folding_type = "";
      }

      return next;
    });
  };

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
      if ((queryError.message || "").includes("checker_name")) {
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
      if ((queryError.message || "").includes("border")) {
        setBorderSuggestions([]);
        return;
      }
      throw queryError;
    }

    const uniqueValues = [...new Set((data || []).map((row) => row.border).filter(Boolean))];
    setBorderSuggestions(uniqueValues.slice(0, 8));
  };

  const loadLot = async (lotId, options = {}) => {
    const { keepMessages = false } = options;
    setLoading(true);
    if (!keepMessages) {
      setError("");
      setSuccess("");
    }

    try {
      const { data: lot, error: lotError } = await supabase
        .from("lots")
        .select("id, lot_no, cloth_type, current_stage, status, party:party_id(name), grey_party:grey_party_id(name), grey_inward!inner(meters, jodis, length, width, quantity, tagge, fold_details, border), bleaching(id, bleach_type, next_stage, is_locked), masrise(id, instruction, is_locked), dyeing(id, is_locked), stenter(id, is_locked), finishing(id, finishing_type, is_locked), folding(id, folding_type, is_locked)")
        .eq("id", lotId)
        .single();

      if (lotError) throw lotError;
      if (lot.current_stage !== "checking") {
        throw new Error(`Lot is in ${lot.current_stage} stage, not checking.`);
      }

      const inwardRow = one(lot.grey_inward);
      if (!inwardRow) throw new Error("Grey inward data not found for this lot.");

      const { data: checkingRow, error: checkingError } = await supabase
        .from("grey_checking")
        .select("id, checking_method, checker_name, checked_meters, checked_length, jodis, taggas, tp, fold, border, less_short, less_short_meters, less_short_jodis, less_short_meters_manual, less_short_jodis_manual, is_locked")
        .eq("lot_id", lotId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (checkingError) throw checkingError;

      const bleaching = one(lot.bleaching);
      const masrise = one(lot.masrise);
      const dyeing = one(lot.dyeing);
      const stenter = one(lot.stenter);
      const finishing = one(lot.finishing);
      const folding = one(lot.folding);
      const checkedJodis = checkingRow?.jodis ?? "";
      const checkedLength = checkingRow?.checked_length ?? "";
      const checkedMeters = checkingRow?.checked_meters ?? calculateCheckedMeters(checkedJodis, checkedLength);

      const inwardMeters = Number(inwardRow?.meters ?? "");
      const inwardJodis = Number(inwardRow?.jodis ?? "");
      const checkedMetersNumber = Number(checkedMeters ?? "");
      const checkedJodisNumber = Number(checkedJodis ?? "");

      setLotData(lot);
      setRecordId(checkingRow?.id || null);
      setRecordLocked(Boolean(checkingRow?.is_locked));
      setLessShortMetersEdited(Boolean(checkingRow?.less_short_meters_manual));
      setLessShortJodisEdited(Boolean(checkingRow?.less_short_jodis_manual) || (checkingRow?.less_short != null && checkingRow?.less_short_jodis == null));
      setForm({
        checking_method: DB_TO_CHECKING_METHOD[checkingRow?.checking_method] || "",
        checker_name: checkingRow?.checker_name || "",
        checked_jodis: checkedJodis,
        checked_length: checkedLength,
        checked_meters: checkedMeters,
        taggas: checkingRow?.taggas ?? inwardRow.tagge ?? "",
        tp: checkingRow?.tp || "",
        fold: checkingRow?.fold ?? inwardRow.fold_details ?? "",
        border: checkingRow?.border ?? inwardRow.border ?? "",
        less_short_meters: checkingRow?.less_short_meters ?? (Number.isFinite(inwardMeters) && Number.isFinite(checkedMetersNumber) ? Math.max(inwardMeters - checkedMetersNumber, 0) : ""),
        less_short_jodis: checkingRow?.less_short_jodis ?? checkingRow?.less_short ?? (Number.isFinite(inwardJodis) && Number.isFinite(checkedJodisNumber) ? Math.max(inwardJodis - checkedJodisNumber, 0) : ""),
        include_bleaching: Boolean(bleaching?.id),
        bleach_type: bleaching?.bleach_type || "",
        include_masrise: Boolean(masrise?.id),
        masrise_instruction: masrise?.instruction || "",
        include_dyeing: Boolean(dyeing?.id),
        include_stenter: Boolean(stenter?.id),
        include_finishing: Boolean(finishing?.id),
        finishing_type: finishing?.finishing_type || "",
        include_folding: Boolean(folding?.id),
        folding_type: folding?.folding_type || "",
      });
      setSelectedLotId(lotId);
      setMode("form");
    } catch (e) {
      setError(e.message || "Failed to open checking form.");
    } finally {
      setLoading(false);
    }
  };

  const upsertDownstreamStages = async (lotId, checkedMetersValue) => {
    const bleaching = one(lotData?.bleaching);
    const masrise = one(lotData?.masrise);
    const dyeing = one(lotData?.dyeing);
    const stenter = one(lotData?.stenter);
    const finishing = one(lotData?.finishing);
    const folding = one(lotData?.folding);
    const bleachingRequired = Boolean(form.include_bleaching);
    const masriseRequired = Boolean(form.include_masrise);
    const dyeingRequired = Boolean(form.include_dyeing);
    const stenterRequired = Boolean(form.include_stenter);
    const finishingRequired = Boolean(form.include_finishing);
    const foldingRequired = Boolean(form.include_folding);

    if (!bleachingRequired && !masriseRequired && !dyeingRequired && !stenterRequired && !finishingRequired && !foldingRequired) {
      throw new Error("Select at least one downstream stage.");
    }
    if (bleachingRequired && !form.bleach_type) throw new Error("Bleach type is required.");
    if (finishingRequired && !form.finishing_type) throw new Error("Finishing type is required.");
    if (foldingRequired && !finishingRequired) throw new Error("Folding requires finishing.");
    if (foldingRequired && !form.folding_type) throw new Error("Folding type is required.");

    if (bleachingRequired && bleaching?.id && !bleaching.is_locked) {
      const { error } = await supabase
        .from("bleaching")
        .update({
          bleach_type: form.bleach_type,
          next_stage: dyeingRequired ? "dyeing" : "stenter",
          input_meters: checkedMetersValue,
        })
        .eq("id", bleaching.id);
      if (error) throw error;
    } else if (bleachingRequired && !bleaching?.id) {
      const { error } = await supabase.from("bleaching").insert({
        lot_id: lotId,
        bleach_type: form.bleach_type,
        next_stage: dyeingRequired ? "dyeing" : "stenter",
        input_meters: checkedMetersValue,
        created_by: userId,
      });
      if (error) throw error;
    } else if (!bleachingRequired && bleaching?.id && !bleaching.is_locked) {
      const { error } = await supabase.from("bleaching").delete().eq("id", bleaching.id);
      if (error) throw error;
    }

    if (masriseRequired && masrise?.id && !masrise.is_locked) {
      const { error } = await supabase
        .from("masrise")
        .update({
          input_meters: checkedMetersValue,
          instruction: form.masrise_instruction.trim() || null,
        })
        .eq("id", masrise.id);
      if (error) throw error;
    } else if (masriseRequired && !masrise?.id) {
      const { error } = await supabase.from("masrise").insert({
        lot_id: lotId,
        input_meters: checkedMetersValue,
        instruction: form.masrise_instruction.trim() || null,
        created_by: userId,
      });
      if (error) throw error;
    } else if (!masriseRequired && masrise?.id && !masrise.is_locked) {
      const { error } = await supabase.from("masrise").delete().eq("id", masrise.id);
      if (error) throw error;
    }

    if (dyeingRequired) {
      if (dyeing?.id && !dyeing.is_locked) {
        const { error } = await supabase
          .from("dyeing")
          .update({
            input_meters: checkedMetersValue,
            sent_to_stenter: true,
          })
          .eq("id", dyeing.id);
        if (error) throw error;
      } else if (!dyeing?.id) {
        const { error } = await supabase.from("dyeing").insert({
          lot_id: lotId,
          input_meters: checkedMetersValue,
          sent_to_stenter: true,
          created_by: userId,
        });
        if (error) throw error;
      }
    } else if (dyeing?.id && !dyeing.is_locked) {
      const { error } = await supabase.from("dyeing").delete().eq("id", dyeing.id);
      if (error) throw error;
    }

    if (stenterRequired && stenter?.id && !stenter.is_locked) {
      const { error } = await supabase.from("stenter").update({ input_meters: checkedMetersValue }).eq("id", stenter.id);
      if (error) throw error;
    } else if (stenterRequired && !stenter?.id) {
      const { error } = await supabase.from("stenter").insert({
        lot_id: lotId,
        input_meters: checkedMetersValue,
        created_by: userId,
      });
      if (error) throw error;
    } else if (!stenterRequired && stenter?.id && !stenter.is_locked) {
      const { error } = await supabase.from("stenter").delete().eq("id", stenter.id);
      if (error) throw error;
    }

    if (finishingRequired) {
      if (finishing?.id && !finishing.is_locked) {
        const { error } = await supabase
          .from("finishing")
          .update({
            input_meters: checkedMetersValue,
            finishing_type: form.finishing_type,
          })
          .eq("id", finishing.id);
        if (error) throw error;
      } else if (!finishing?.id) {
        const { error } = await supabase.from("finishing").insert({
          lot_id: lotId,
          input_meters: checkedMetersValue,
          finishing_type: form.finishing_type,
          created_by: userId,
        });
        if (error) throw error;
      }
    } else if (finishing?.id && !finishing.is_locked) {
      const { error } = await supabase.from("finishing").delete().eq("id", finishing.id);
      if (error) throw error;
    }

    if (foldingRequired) {
      if (folding?.id && !folding.is_locked) {
        const { error } = await supabase
          .from("folding")
          .update({
            input_meters: checkedMetersValue,
            folding_type: form.folding_type,
          })
          .eq("id", folding.id);
        if (error) throw error;
      } else if (!folding?.id) {
        const { error } = await supabase.from("folding").insert({
          lot_id: lotId,
          input_meters: checkedMetersValue,
          folding_type: form.folding_type,
          created_by: userId,
        });
        if (error) throw error;
      }
    } else if (folding?.id && !folding.is_locked) {
      const { error } = await supabase.from("folding").delete().eq("id", folding.id);
      if (error) throw error;
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!lotData?.id) return setError("Select a valid lot from checking dashboard.");
    if (!form.checking_method) return setError("Checking method is required.");
    if (form.checked_jodis === "" || form.checked_length === "") return setError("Checked Jodis and Checked Length are required.");
    if (recordLocked) return setError("This checking record is already released.");

    setSaving(true);
    try {
      const checkedMetersValue = form.checked_meters === "" ? null : Number(form.checked_meters);
      const payload = {
        lot_id: lotData.id,
        checking_method: CHECKING_METHOD_TO_DB[form.checking_method] || form.checking_method,
        checker_name: form.checker_name.trim() || null,
        input_meters: inward?.meters == null ? null : Number(inward.meters),
        checked_meters: checkedMetersValue,
        checked_length: form.checked_length === "" ? null : Number(form.checked_length),
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

      let nextRecordId = recordId;
      if (recordId) {
        const { error: updateError } = await supabase
          .from("grey_checking")
          .update({
            checking_method: payload.checking_method,
            checker_name: payload.checker_name,
            input_meters: payload.input_meters,
            checked_meters: payload.checked_meters,
            checked_length: payload.checked_length,
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
        if (updateError) throw updateError;
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from("grey_checking")
          .insert(payload)
          .select("id")
          .single();
        if (insertError) throw insertError;
        nextRecordId = inserted.id;
        setRecordId(inserted.id);
      }

      await upsertDownstreamStages(lotData.id, checkedMetersValue);
      if (nextRecordId) setRecordId(nextRecordId);
      await loadList();
      await loadLot(lotData.id, { keepMessages: true });
      setSuccess("Checking data and stage instructions saved.");
    } catch (e) {
      setError(e.message || "Failed to save checking data.");
    } finally {
      setSaving(false);
    }
  };

  const assertSelectedStageRowsExist = async (lotId) => {
    const { data, error: lotError } = await supabase
      .from("lots")
      .select("id, bleaching(id), masrise(id), dyeing(id), stenter(id), finishing(id), folding(id)")
      .eq("id", lotId)
      .single();

    if (lotError) throw lotError;

    const missingStages = [];
    if (form.include_bleaching && !one(data.bleaching)?.id) missingStages.push("Bleaching");
    if (form.include_masrise && !one(data.masrise)?.id) missingStages.push("Masrise");
    if (form.include_dyeing && !one(data.dyeing)?.id) missingStages.push("Dyeing");
    if (form.include_stenter && !one(data.stenter)?.id) missingStages.push("Stenter");
    if (form.include_finishing && !one(data.finishing)?.id) missingStages.push("Finishing");
    if (form.include_folding && !one(data.folding)?.id) missingStages.push("Folding");

    if (missingStages.length > 0) {
      throw new Error(`Selected stage instructions are missing for: ${missingStages.join(", ")}. Save the checking form after fixing the schema, then release again.`);
    }
  };

  const sendToNextStage = async () => {
    setError("");
    setSuccess("");

    if (!lotData?.id) return setError("Open a lot first.");
    if (!recordId) return setError("Save checking data first.");

    setSending(true);
    try {
      await assertSelectedStageRowsExist(lotData.id);
      const now = new Date().toISOString();

      const { error: checkingError } = await supabase
        .from("grey_checking")
        .update({ is_locked: true, locked_at: now })
        .eq("id", recordId);
      if (checkingError) throw checkingError;

      const { error: inwardError } = await supabase
        .from("grey_inward")
        .update({ is_locked: true, locked_at: now })
        .eq("lot_id", lotData.id)
        .eq("is_locked", false);
      if (inwardError) throw inwardError;

      await syncLotWorkflowState(lotData.id);
      setSuccess(`Lot #${lotData.lot_no} released to selected stages.`);
      resetFormState();
      setMode("list");
      await loadList();
    } catch (e) {
      setError(e.message || "Failed to release lot to selected stages.");
    } finally {
      setSending(false);
    }
  };

  if (mode === "list") {
    return (
      <div className="glass-card p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-xl surface-title">Checking Dashboard</h2>
          <button type="button" onClick={loadList} disabled={loading} className="btn-secondary btn-sm disabled:opacity-60">
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <div className="mb-3 flex justify-start">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search (e.g. lot:120, party:ram, qty:500)"
            className="w-full rounded-xl glass-input px-3 py-2 text-sm outline-none sm:max-w-md"
          />
        </div>

        {loading ? (
          <p className="text-sm text-gray-600">Loading lots in checking stage...</p>
        ) : filteredRows.length === 0 ? (
          <p className="text-sm text-gray-600">No lots are currently in checking stage.</p>
        ) : (
          <div className="space-y-3">
            {filteredRows.map((lot) => {
              const inwardRow = one(lot.grey_inward);
              return (
                <div key={lot.id} className="rounded-xl border border-slate-200/80 bg-white/70 p-3 text-sm shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-gray-900">Lot #{lot.lot_no}</p>
                    <button type="button" onClick={() => loadLot(lot.id)} className="btn-dark btn-sm">
                      Open
                    </button>
                  </div>
                  <p>Party: {lot.party?.name || "-"}</p>
                  <p>Grey Party: {lot.grey_party?.name || "-"}</p>
                  <p>Cloth: {lot.cloth_type || "-"}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
                    <p className="rounded-md bg-gray-50 px-2 py-1">Meters: {inwardRow?.meters ?? "-"}</p>
                    <p className="rounded-md bg-gray-50 px-2 py-1">Jodis: {inwardRow?.jodis ?? "-"}</p>
                    <p className="rounded-md bg-gray-50 px-2 py-1">Length: {inwardRow?.length ?? "-"}</p>
                    <p className="rounded-md bg-gray-50 px-2 py-1">Width: {inwardRow?.width ?? "-"}</p>
                    <p className="rounded-md bg-gray-50 px-2 py-1">Qty: {inwardRow?.quantity || "-"}</p>
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
          resetFormState();
          setMode("list");
        }}
        className="btn-secondary"
      >
        Back To Checking Dashboard
      </button>

      <div className="glass-card p-4 sm:p-6">
        <h2 className="mb-2 text-xl surface-title">Checking Entry</h2>
        <p className="mb-4 text-sm text-gray-600">Lot No: <span className="font-semibold">{lotData?.lot_no || "-"}</span></p>

        <div className="mb-4 rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50 p-4 text-sm">
          <p className="font-semibold text-blue-950">Auto-fetched from Grey Inward</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <p className="rounded-xl bg-white/80 px-3 py-2">Party: <span className="font-medium">{lotData?.party?.name || "-"}</span></p>
            <p className="rounded-xl bg-white/80 px-3 py-2">Grey Party: <span className="font-medium">{lotData?.grey_party?.name || "-"}</span></p>
            <p className="rounded-xl bg-white/80 px-3 py-2">Cloth: <span className="font-medium">{lotData?.cloth_type || "-"}</span></p>
            <p className="rounded-xl bg-white/80 px-3 py-2">Meters: <span className="font-medium">{inward?.meters ?? "-"}</span></p>
            <p className="rounded-xl bg-white/80 px-3 py-2">Jodis: <span className="font-medium">{inward?.jodis ?? "-"}</span></p>
            <p className="rounded-xl bg-white/80 px-3 py-2">Length: <span className="font-medium">{inward?.length ?? "-"}</span></p>
            <p className="rounded-xl bg-white/80 px-3 py-2">Width: <span className="font-medium">{inward?.width ?? "-"}</span></p>
            <p className="rounded-xl bg-white/80 px-3 py-2">Quantity: <span className="font-medium">{inward?.quantity || "-"}</span></p>
            <p className="rounded-xl bg-white/80 px-3 py-2">Tagge: <span className="font-medium">{inward?.tagge ?? "-"}</span></p>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <p className="rounded-xl bg-white/80 px-3 py-2">Fold Details: <span className="font-medium">{inward?.fold_details || "-"}</span></p>
            <p className="rounded-xl bg-white/80 px-3 py-2">Border: <span className="font-medium">{inward?.border || "-"}</span></p>
          </div>
        </div>

        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {success && <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{success}</div>}

        <form onSubmit={save} className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-gray-700">Checking Method</span>
              <select
                value={form.checking_method}
                onChange={(e) => setField("checking_method", e.target.value)}
                className="w-full rounded-xl glass-input px-3 py-2 outline-none"
                required
                disabled={recordLocked || sending}
              >
                <option value="">Select Checking Method</option>
                {CHECKING_METHOD_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </label>

            <label className="text-sm">
              <span className="mb-1 block text-gray-700">Checker Name</span>
              <input
                type="text"
                list="checker-name-suggestions"
                value={form.checker_name}
                onChange={(e) => {
                  setField("checker_name", e.target.value);
                  searchCheckerNames(e.target.value);
                }}
                onFocus={() => searchCheckerNames("")}
                className="w-full rounded-xl glass-input px-3 py-2 outline-none"
                disabled={recordLocked || sending}
              />
              <datalist id="checker-name-suggestions">
                {checkerNameSuggestions.map((name) => <option key={name} value={name} />)}
              </datalist>
            </label>

            <label className="text-sm">
              <span className="mb-1 block text-gray-700">Checked Jodis</span>
              <input
                type="number"
                step="0.01"
                value={form.checked_jodis}
                onChange={(e) => setField("checked_jodis", e.target.value)}
                className="w-full rounded-xl glass-input px-3 py-2 outline-none"
                disabled={recordLocked || sending}
              />
            </label>

            <label className="text-sm">
              <span className="mb-1 block text-gray-700">Checked Length</span>
              <input
                type="number"
                step="0.01"
                value={form.checked_length}
                onChange={(e) => setField("checked_length", e.target.value)}
                className="w-full rounded-xl glass-input px-3 py-2 outline-none"
                disabled={recordLocked || sending}
              />
            </label>

            <label className="text-sm">
              <span className="mb-1 block text-gray-700">Checked Meters</span>
              <input type="number" step="0.01" value={form.checked_meters} readOnly className="w-full rounded-xl bg-gray-50 px-3 py-2 outline-none" />
            </label>

            <label className="text-sm">
              <span className="mb-1 block text-gray-700">Taggas</span>
              <input
                type="number"
                value={form.taggas}
                onChange={(e) => setField("taggas", e.target.value)}
                className="w-full rounded-xl glass-input px-3 py-2 outline-none"
                disabled={recordLocked || sending}
              />
            </label>

            <label className="text-sm">
              <span className="mb-1 block text-gray-700">TP</span>
              <input
                type="text"
                value={form.tp}
                onChange={(e) => setField("tp", e.target.value)}
                className="w-full rounded-xl glass-input px-3 py-2 outline-none"
                disabled={recordLocked || sending}
              />
            </label>

            <label className="text-sm">
              <span className="mb-1 block text-gray-700">Fold</span>
              <input
                type="text"
                value={form.fold}
                onChange={(e) => setField("fold", e.target.value)}
                className="w-full rounded-xl glass-input px-3 py-2 outline-none"
                disabled={recordLocked || sending}
              />
            </label>

            <label className="text-sm">
              <span className="mb-1 block text-gray-700">Border</span>
              <input
                type="text"
                list="checking-border-suggestions"
                value={form.border}
                onChange={(e) => {
                  setField("border", e.target.value);
                  searchBorderSuggestions(e.target.value);
                }}
                onFocus={() => searchBorderSuggestions("")}
                className="w-full rounded-xl glass-input px-3 py-2 outline-none"
                disabled={recordLocked || sending}
              />
              <datalist id="checking-border-suggestions">
                {borderSuggestions.map((value) => <option key={value} value={value} />)}
              </datalist>
            </label>

            <label className="text-sm">
              <span className="mb-1 block text-gray-700">Less / Short Meters</span>
              <input
                type="number"
                step="0.01"
                value={form.less_short_meters}
                onChange={(e) => {
                  setLessShortMetersEdited(true);
                  setField("less_short_meters", e.target.value);
                }}
                className="w-full rounded-xl glass-input px-3 py-2 outline-none"
                disabled={recordLocked || sending}
              />
            </label>

            <label className="text-sm">
              <span className="mb-1 block text-gray-700">Less / Short Jodis</span>
              <input
                type="number"
                step="0.01"
                value={form.less_short_jodis}
                onChange={(e) => {
                  setLessShortJodisEdited(true);
                  setField("less_short_jodis", e.target.value);
                }}
                className="w-full rounded-xl glass-input px-3 py-2 outline-none"
                disabled={recordLocked || sending}
              />
            </label>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Stage Planning</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Select only the stages this lot should go through. Selected stages receive the checked meters as planned input.
                </p>
              </div>
              <div className="rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white">
                <p className="text-xs uppercase tracking-wide text-slate-300">Selected Stages</p>
                <p className="mt-1 font-medium">{selectedStages.length ? selectedStages.join(", ") : "None selected"}</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
              <StageCard
                title="Bleaching"
                description="Send checked meters to bleaching with bleach type."
                selected={form.include_bleaching}
                onToggle={() => toggleStage("bleaching")}
                disabled={recordLocked || sending}
              >
                <label className="block text-sm">
                  <span className="mb-1 block text-slate-200">Bleach Type</span>
                  <select
                    value={form.bleach_type}
                    onChange={(e) => setField("bleach_type", e.target.value)}
                    className="w-full rounded-xl border border-white/20 bg-white/95 px-3 py-2 text-slate-900 outline-none"
                    disabled={recordLocked || sending}
                  >
                    <option value="">Select Bleach Type</option>
                    {BLEACH_TYPE_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </label>
              </StageCard>

              <StageCard
                title="Masrise"
                description="Keep a masrise instruction with the planned input meters."
                selected={form.include_masrise}
                onToggle={() => toggleStage("masrise")}
                disabled={recordLocked || sending}
              >
                <label className="block text-sm">
                  <span className="mb-1 block text-slate-200">Masrise Instruction</span>
                  <textarea
                    value={form.masrise_instruction}
                    onChange={(e) => setField("masrise_instruction", e.target.value)}
                    rows={3}
                    className="w-full rounded-2xl border border-white/20 bg-white/95 px-3 py-2 text-slate-900 outline-none"
                    placeholder="Enter masrise instruction for staff"
                    disabled={recordLocked || sending}
                  />
                </label>
              </StageCard>

              <StageCard
                title="Dyeing"
                description="Lot will appear in dyeing with planned input meters."
                selected={form.include_dyeing}
                onToggle={() => toggleStage("dyeing")}
                disabled={recordLocked || sending}
              >
                <p className="rounded-xl bg-white/10 px-3 py-2 text-sm text-slate-100">Planned Input Meters: {form.checked_meters || "-"}</p>
              </StageCard>

              <StageCard
                title="Stenter"
                description="Lot will appear in stenter with planned input meters."
                selected={form.include_stenter}
                onToggle={() => toggleStage("stenter")}
                disabled={recordLocked || sending}
              >
                <p className="rounded-xl bg-white/10 px-3 py-2 text-sm text-slate-100">Planned Input Meters: {form.checked_meters || "-"}</p>
              </StageCard>

              <StageCard
                title="Finishing"
                description="Select finishing type for the finishing staff."
                selected={form.include_finishing}
                onToggle={() => toggleStage("finishing")}
                disabled={recordLocked || sending}
              >
                <label className="block text-sm">
                  <span className="mb-1 block text-slate-200">Finishing Type</span>
                  <select
                    value={form.finishing_type}
                    onChange={(e) => setField("finishing_type", e.target.value)}
                    className="w-full rounded-xl border border-white/20 bg-white/95 px-3 py-2 text-slate-900 outline-none"
                    disabled={recordLocked || sending}
                  >
                    <option value="">Select Finishing Type</option>
                    {FINISHING_TYPE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </label>
              </StageCard>

              <StageCard
                title="Folding"
                description="Select folding type for final packing work."
                selected={form.include_folding}
                onToggle={() => toggleStage("folding")}
                disabled={recordLocked || sending}
              >
                <label className="block text-sm">
                  <span className="mb-1 block text-slate-200">Folding Type</span>
                  <select
                    value={form.folding_type}
                    onChange={(e) => setField("folding_type", e.target.value)}
                    className="w-full rounded-xl border border-white/20 bg-white/95 px-3 py-2 text-slate-900 outline-none"
                    disabled={recordLocked || sending}
                  >
                    <option value="">Select Folding Type</option>
                    {FOLDING_TYPE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </label>
                {!form.include_finishing ? <p className="text-xs text-amber-200">Folding requires Finishing to be selected before release.</p> : null}
              </StageCard>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="submit" disabled={saving || recordLocked || sending} className="btn-primary disabled:opacity-60">
              {saving ? "Saving..." : "Save"}
            </button>
            <button type="button" onClick={sendToNextStage} disabled={sending || recordLocked || !selectedLotId} className="btn-dark disabled:opacity-60">
              {sending ? "Releasing..." : "Release To Selected Stages"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CheckingStagePanel;
