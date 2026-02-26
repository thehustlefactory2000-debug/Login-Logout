import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const CLOTH_TYPE_PRESETS = ["Cotton", "PC", "Dinear", "Roto"];
const OTHER_CLOTH = "__other__";

const GreyInwardEntryForm = ({ userId, onSaved, onSent, initialLotId = null }) => {
  const [partyName, setPartyName] = useState("");
  const [greyPartyName, setGreyPartyName] = useState("");
  const [clothType, setClothType] = useState("");
  const [selectedClothType, setSelectedClothType] = useState("");
  const [meters, setMeters] = useState("");
  const [jodis, setJodis] = useState("");
  const [tagge, setTagge] = useState("");
  const [foldDetails, setFoldDetails] = useState("");
  const [border, setBorder] = useState("");

  const [partySuggestions, setPartySuggestions] = useState([]);
  const [greyPartySuggestions, setGreyPartySuggestions] = useState([]);
  const [clothTypeOptions, setClothTypeOptions] = useState([]);

  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [currentLotId, setCurrentLotId] = useState(null);
  const [currentLotNo, setCurrentLotNo] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [nextLotPreview, setNextLotPreview] = useState(null);

  const loadNextLotPreview = async () => {
    const { data } = await supabase
      .from("lots")
      .select("lot_no")
      .order("lot_no", { ascending: false })
      .limit(1)
      .maybeSingle();
    setNextLotPreview((data?.lot_no || 0) + 1);
  };

  const loadClothTypes = async () => {
    const { data } = await supabase
      .from("cloth_types")
      .select("name")
      .order("name", { ascending: true });

    const dbTypes = (data || []).map((d) => d.name);
    setClothTypeOptions([...new Set([...CLOTH_TYPE_PRESETS, ...dbTypes])]);
  };

  const loadLotForEdit = async (lotId) => {
    const { data: lot, error: lotError } = await supabase
      .from("lots")
      .select("id, lot_no, cloth_type, party:party_id(name), grey_party:grey_party_id(name)")
      .eq("id", lotId)
      .single();

    if (lotError) throw lotError;

    const { data: inward, error: inwardError } = await supabase
      .from("grey_inward")
      .select("id, meters, jodis, tagge, fold_details, border, is_locked")
      .eq("lot_id", lotId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (inwardError) throw inwardError;

    setCurrentLotId(lot.id);
    setCurrentLotNo(lot.lot_no);
    setPartyName(lot.party?.name || "");
    setGreyPartyName(lot.grey_party?.name || "");

    const lotClothType = lot.cloth_type || "";
    if (lotClothType) {
      setClothTypeOptions((prev) => (prev.includes(lotClothType) ? prev : [...prev, lotClothType]));
      setSelectedClothType(lotClothType);
      setClothType("");
    } else {
      setSelectedClothType("");
      setClothType("");
    }

    setMeters(inward?.meters ?? "");
    setJodis(inward?.jodis ?? "");
    setTagge(inward?.tagge ?? "");
    setFoldDetails(inward?.fold_details ?? "");
    setBorder(inward?.border ?? "");
    setIsLocked(Boolean(inward?.is_locked));
  };

  useEffect(() => {
    loadNextLotPreview();
    loadClothTypes();
  }, []);

  useEffect(() => {
    if (!initialLotId) return;

    const load = async () => {
      setError("");
      setSuccess("");
      try {
        await loadLotForEdit(initialLotId);
      } catch (err) {
        setError(err.message || "Failed to load lot for editing.");
      }
    };

    load();
  }, [initialLotId]);

  const searchParty = async (value, type, setter) => {
    let query = supabase
      .from("parties")
      .select("name")
      .eq("type", type)
      .order("name", { ascending: true })
      .limit(8);

    if (value.trim()) query = query.ilike("name", `%${value.trim()}%`);
    const { data } = await query;
    setter((data || []).map((p) => p.name));
  };

  const findOrCreateParty = async (name, type) => {
    const cleanName = name.trim();
    const { data: existing, error: fetchError } = await supabase
      .from("parties")
      .select("id")
      .eq("name", cleanName)
      .eq("type", type)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (existing?.id) return existing.id;

    const { data: created, error: insertError } = await supabase
      .from("parties")
      .insert({ name: cleanName, type })
      .select("id")
      .single();

    if (insertError) {
      // If another request inserted same value in between select/insert, fetch and continue.
      if (insertError.code === "23505") {
        const { data: dupe } = await supabase
          .from("parties")
          .select("id")
          .eq("name", cleanName)
          .eq("type", type)
          .maybeSingle();
        if (dupe?.id) return dupe.id;
      }
      throw insertError;
    }
    return created.id;
  };

  const findOrCreateClothType = async (name) => {
    const cleanName = name.trim();
    const { data: existing, error: fetchError } = await supabase
      .from("cloth_types")
      .select("name")
      .eq("name", cleanName)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!existing) {
      const { error: insertError } = await supabase.from("cloth_types").insert({ name: cleanName });
      if (insertError) throw insertError;
    }
    return cleanName;
  };

  const resetFields = () => {
    setPartyName("");
    setGreyPartyName("");
    setClothType("");
    setSelectedClothType("");
    setMeters("");
    setJodis("");
    setTagge("");
    setFoldDetails("");
    setBorder("");
  };

  const startNewLot = async () => {
    resetFields();
    setCurrentLotId(null);
    setCurrentLotNo(null);
    setIsLocked(false);
    setError("");
    setSuccess("");
    await loadNextLotPreview();
  };

  const saveGreyInward = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const resolvedClothType =
      selectedClothType === OTHER_CLOTH ? clothType.trim() : selectedClothType.trim();

    if (!partyName.trim() || !greyPartyName.trim() || !resolvedClothType) {
      setError("Party name, grey party name, and cloth type are required.");
      return;
    }
    if (isLocked) {
      setError("This lot is already sent to checking. Start a new lot.");
      return;
    }

    setSaving(true);
    try {
      const partyId = await findOrCreateParty(partyName, "party");
      const greyPartyId = await findOrCreateParty(greyPartyName, "grey_party");
      const savedClothType = await findOrCreateClothType(resolvedClothType);

      let lotId = currentLotId;
      let lotNo = currentLotNo;

      if (!lotId) {
        const { data: lot, error: lotError } = await supabase
          .from("lots")
          .insert({
            party_id: partyId,
            grey_party_id: greyPartyId,
            cloth_type: savedClothType,
            created_by: userId,
          })
          .select("id, lot_no")
          .single();
        if (lotError) throw lotError;
        lotId = lot.id;
        lotNo = lot.lot_no;
      } else {
        const { error: lotUpdateError } = await supabase
          .from("lots")
          .update({
            party_id: partyId,
            grey_party_id: greyPartyId,
            cloth_type: savedClothType,
          })
          .eq("id", lotId);
        if (lotUpdateError) throw lotUpdateError;
      }

      const payload = {
        lot_id: lotId,
        meters: meters === "" ? null : Number(meters),
        jodis: jodis === "" ? null : Number(jodis),
        tagge: tagge === "" ? null : Number(tagge),
        fold_details: foldDetails.trim() || null,
        border: border.trim() || null,
        created_by: userId,
      };

      const { data: existingInward, error: inwardFetchError } = await supabase
        .from("grey_inward")
        .select("id, is_locked")
        .eq("lot_id", lotId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (inwardFetchError) throw inwardFetchError;

      if (existingInward?.is_locked) {
        throw new Error("Grey inward is locked for this lot. Start a new lot.");
      }

      if (existingInward?.id) {
        const { error: inwardUpdateError } = await supabase
          .from("grey_inward")
          .update({
            meters: payload.meters,
            jodis: payload.jodis,
            tagge: payload.tagge,
            fold_details: payload.fold_details,
            border: payload.border,
          })
          .eq("id", existingInward.id);
        if (inwardUpdateError) throw inwardUpdateError;
      } else {
        const { error: inwardInsertError } = await supabase
          .from("grey_inward")
          .insert(payload);
        if (inwardInsertError) throw inwardInsertError;
      }

      setCurrentLotId(lotId);
      setCurrentLotNo(lotNo);
      setSuccess(`Saved. Lot No: ${lotNo}. You can edit and save again until you send to checking.`);
      await loadClothTypes();
      if (onSaved) onSaved();
    } catch (err) {
      setError(err.message || "Failed to save grey inward entry.");
    } finally {
      setSaving(false);
    }
  };

  const sendToChecking = async () => {
    if (!currentLotId) {
      setError("Save lot first, then send to checking.");
      return;
    }
    setSending(true);
    setError("");
    setSuccess("");
    try {
      const { error: rpcError } = await supabase.rpc("send_grey_inward_to_checking", {
        p_lot_id: currentLotId,
        p_done_by: userId,
      });
      if (rpcError) throw rpcError;

      setIsLocked(true);
      setSuccess(`Lot No ${currentLotNo} sent to checking. Editing is now locked.`);
      if (onSent) onSent();
    } catch (err) {
      setError(err.message || "Failed to send lot to checking.");
    } finally {
      setSending(false);
    }
  };

  const disabled = isLocked || sending;

  return (
    <div className="glass-card p-4 sm:p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Grey Inward Entry</h2>
      <p className="text-sm text-gray-600 mb-4">
        Lot No: <span className="font-semibold">{currentLotNo ?? nextLotPreview ?? "-"}</span>
      </p>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">{success}</div>}

      <form onSubmit={saveGreyInward} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="text-sm">
          <span className="block mb-1 text-gray-700">Party Name</span>
          <input
            list="party-suggestions"
            value={partyName}
            onChange={(e) => {
              setPartyName(e.target.value);
              searchParty(e.target.value, "party", setPartySuggestions);
            }}
            onFocus={() => searchParty("", "party", setPartySuggestions)}
            className="w-full px-3 py-2 rounded-xl glass-input outline-none"
            required
            disabled={disabled}
          />
          <datalist id="party-suggestions">
            {partySuggestions.map((name) => <option key={name} value={name} />)}
          </datalist>
        </label>

        <label className="text-sm">
          <span className="block mb-1 text-gray-700">Grey Party Name</span>
          <input
            list="grey-party-suggestions"
            value={greyPartyName}
            onChange={(e) => {
              setGreyPartyName(e.target.value);
              searchParty(e.target.value, "grey_party", setGreyPartySuggestions);
            }}
            onFocus={() => searchParty("", "grey_party", setGreyPartySuggestions)}
            className="w-full px-3 py-2 rounded-xl glass-input outline-none"
            required
            disabled={disabled}
          />
          <datalist id="grey-party-suggestions">
            {greyPartySuggestions.map((name) => <option key={name} value={name} />)}
          </datalist>
        </label>

        <label className="text-sm">
          <span className="block mb-1 text-gray-700">Cloth Type</span>
          <select
            value={selectedClothType}
            onChange={(e) => setSelectedClothType(e.target.value)}
            className="w-full px-3 py-2 rounded-xl glass-input outline-none"
            required
            disabled={disabled}
          >
            <option value="">Select cloth type</option>
            {clothTypeOptions.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
            <option value={OTHER_CLOTH}>Other (Add New)</option>
          </select>
        </label>

        {selectedClothType === OTHER_CLOTH ? (
          <label className="text-sm">
            <span className="block mb-1 text-gray-700">New Cloth Type</span>
            <input
              type="text"
              value={clothType}
              onChange={(e) => setClothType(e.target.value)}
              className="w-full px-3 py-2 rounded-xl glass-input outline-none"
              required
              disabled={disabled}
            />
          </label>
        ) : (
          <div className="hidden sm:block" aria-hidden="true" />
        )}

        <label className="text-sm">
          <span className="block mb-1 text-gray-700">Meters</span>
          <input type="number" step="0.01" value={meters} onChange={(e) => setMeters(e.target.value)} className="w-full px-3 py-2 rounded-xl glass-input outline-none" disabled={disabled} />
        </label>

        <label className="text-sm">
          <span className="block mb-1 text-gray-700">Jodis</span>
          <input type="number" value={jodis} onChange={(e) => setJodis(e.target.value)} className="w-full px-3 py-2 rounded-xl glass-input outline-none" disabled={disabled} />
        </label>

        <label className="text-sm">
          <span className="block mb-1 text-gray-700">Tagge</span>
          <input type="number" value={tagge} onChange={(e) => setTagge(e.target.value)} className="w-full px-3 py-2 rounded-xl glass-input outline-none" disabled={disabled} />
        </label>

        <label className="text-sm sm:col-span-2">
          <span className="block mb-1 text-gray-700">Fold Details</span>
          <input type="text" value={foldDetails} onChange={(e) => setFoldDetails(e.target.value)} className="w-full px-3 py-2 rounded-xl glass-input outline-none" disabled={disabled} />
        </label>

        <label className="text-sm sm:col-span-2">
          <span className="block mb-1 text-gray-700">Border</span>
          <input type="text" value={border} onChange={(e) => setBorder(e.target.value)} className="w-full px-3 py-2 rounded-xl glass-input outline-none" disabled={disabled} />
        </label>

        <div className="sm:col-span-2 flex flex-col sm:flex-row gap-2">
          <button type="submit" disabled={saving || disabled} className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold shadow-lg disabled:opacity-60">
            {saving ? "Saving..." : "Save"}
          </button>
          <button type="button" onClick={sendToChecking} disabled={sending || !currentLotId || isLocked} className="px-4 py-2 rounded-xl bg-gradient-to-r from-gray-800 to-gray-900 text-white text-sm font-semibold shadow-lg disabled:opacity-60">
            {sending ? "Sending..." : "Send To Checking"}
          </button>
          {(isLocked || currentLotId) && (
            <button type="button" onClick={startNewLot} className="px-4 py-2 rounded-xl bg-white/80 border border-gray-300 text-sm">
              Start New Lot
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default GreyInwardEntryForm;

