import { supabase } from "./supabaseClient";

const one = (value) => (Array.isArray(value) ? value[0] : value) || null;

const STAGE_ORDER = ["bleaching", "masrise", "dyeing", "stenter", "finishing", "folding"];

export const getLotWorkflowSnapshot = async (lotId) => {
  const { data, error } = await supabase
    .from("lots")
    .select("id, status, bleaching(id, is_locked), masrise(id, is_locked), dyeing(id, is_locked), stenter(id, is_locked), finishing(id, is_locked), folding(id, is_locked)")
    .eq("id", lotId)
    .single();

  if (error) throw error;
  return data;
};

const getPlannedStages = (lot) =>
  STAGE_ORDER.map((stage) => one(lot?.[stage])).filter((record) => record?.id);

export const getNextPendingStage = (lot) => {
  for (const stage of STAGE_ORDER) {
    const record = one(lot?.[stage]);
    if (record?.id && !record.is_locked) return stage;
  }
  return null;
};

export const isWorkflowCompleted = (lot) => {
  const plannedStages = getPlannedStages(lot);
  return plannedStages.length > 0 && plannedStages.every((record) => record.is_locked);
};

export const syncLotWorkflowState = async (lotId) => {
  const snapshot = await getLotWorkflowSnapshot(lotId);
  const nextPendingStage = getNextPendingStage(snapshot);
  const workflowCompleted = isWorkflowCompleted(snapshot);

  if (workflowCompleted) {
    const { error } = await supabase
      .from("lots")
      .update({ current_stage: "completed", status: "completed" })
      .eq("id", lotId);
    if (error) throw error;
    return "completed";
  }

  if (nextPendingStage) {
    const { error } = await supabase
      .from("lots")
      .update({ current_stage: nextPendingStage, status: "active" })
      .eq("id", lotId);
    if (error) throw error;
    return nextPendingStage;
  }

  const { error } = await supabase
    .from("lots")
    .update({ current_stage: "checking", status: "active" })
    .eq("id", lotId);
  if (error) throw error;
  return "checking";
};

export const markStageRecordCompleted = async (table, recordId) => {
  const { error } = await supabase
    .from(table)
    .update({ is_locked: true, locked_at: new Date().toISOString() })
    .eq("id", recordId);

  if (error) throw error;
};
