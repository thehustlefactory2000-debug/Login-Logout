import React from "react";
import {
  AdminShellCard,
  BLEACH_TYPE_OPTIONS,
  FINISHING_TYPE_OPTIONS,
  FOLDING_TYPE_OPTIONS,
  FilterLabel,
  INSTRUCTION_STAGE_CARDS,
  InstructionStageCard,
  MetricCard,
  PanelHeader,
  getInstructionSelectionSummary,
  getStatusTone,
  one,
  stageLabel,
} from "./adminDashboardShared";

const AdminInstructionsPanel = ({
  instructionEditor,
  instructionLots,
  activeInstructionLotId,
  loadingInstruction,
  loadingLots,
  savingInstruction,
  instructionEditorRef,
  onInstructionFieldChange,
  onLoadInstructionLot,
  onLoadInstructionLotById,
  onCloseInstructionLotPage,
  onToggleInstructionStage,
  onSaveInstructionChanges,
}) => (
  <div className="space-y-4">
    <AdminShellCard>
      <PanelHeader eyebrow="Lot Lookup" title="Instruction editor" description="Load a lot by number to adjust the planned downstream stages created from checking." />
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:p-6">
        <FilterLabel label="Lot No">
          <input
            type="number"
            value={instructionEditor.lotNo}
            onChange={(e) => onInstructionFieldChange("lotNo", e.target.value)}
            className="glass-input w-full px-3 py-2 text-sm outline-none sm:min-w-[220px]"
            placeholder="Enter lot number"
          />
        </FilterLabel>
        <button type="button" onClick={() => onLoadInstructionLot(instructionEditor.lotNo)} disabled={loadingInstruction} className="btn-primary disabled:opacity-60">
          {loadingInstruction ? "Loading..." : "Load Instructions"}
        </button>
      </div>
    </AdminShellCard>

    {activeInstructionLotId && instructionEditor.lotId && (
      <div ref={instructionEditorRef} className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onCloseInstructionLotPage} className="btn-secondary">
            Back To Lots
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Lot" value={`#${instructionEditor.lotNo || "-"}`} tone="slate" />
          <MetricCard label="Current Stage" value={stageLabel(instructionEditor.currentStage)} tone="blue" />
          <MetricCard label="Checked Meters" value={instructionEditor.checkedMeters || "-"} tone="emerald" />
          <MetricCard label="Length / Jodis" value={`${instructionEditor.checkedLength || "-"} / ${instructionEditor.checkedJodis || "-"}`} tone="amber" />
        </div>

        <AdminShellCard>
          <PanelHeader eyebrow="Stage Planner" title="Stage instructions" description="Completed stages stay locked. All other selected stages will be inserted, updated, or removed when you save." />
          <div className="grid grid-cols-1 gap-3 p-4 sm:p-6 lg:grid-cols-2">
            {INSTRUCTION_STAGE_CARDS.map((stage) => {
              const includeKey = `include_${stage.key}`;
              const lockedKey = `${stage.key === "bleaching" ? "bleach" : stage.key}_locked`;
              return (
                <InstructionStageCard
                  key={stage.key}
                  title={stage.label}
                  description={stage.description}
                  selected={instructionEditor[includeKey]}
                  locked={instructionEditor[lockedKey]}
                  onToggle={() => onToggleInstructionStage(stage.key)}
                >
                  {stage.key === "bleaching" && (
                    <FilterLabel label="Bleach Type">
                      <select
                        value={instructionEditor.bleach_type}
                        onChange={(e) => onInstructionFieldChange("bleach_type", e.target.value)}
                        className="glass-input w-full px-3 py-2 text-sm text-slate-900 outline-none"
                        disabled={instructionEditor.bleach_locked}
                      >
                        <option value="">Select Bleach Type</option>
                        {BLEACH_TYPE_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </FilterLabel>
                  )}
                  {stage.key === "masrise" && (
                    <FilterLabel label="Masrise Instruction">
                      <textarea
                        value={instructionEditor.masrise_instruction}
                        onChange={(e) => onInstructionFieldChange("masrise_instruction", e.target.value)}
                        rows={3}
                        className="glass-input w-full rounded-2xl px-3 py-2 text-sm text-slate-900 outline-none"
                        disabled={instructionEditor.masrise_locked}
                      />
                    </FilterLabel>
                  )}
                  {(stage.key === "dyeing" || stage.key === "stenter") && (
                    <p className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                      Planned Input Meters: {instructionEditor.checkedMeters || "-"}
                    </p>
                  )}
                  {stage.key === "finishing" && (
                    <FilterLabel label="Finishing Type">
                      <select
                        value={instructionEditor.finishing_type}
                        onChange={(e) => onInstructionFieldChange("finishing_type", e.target.value)}
                        className="glass-input w-full px-3 py-2 text-sm text-slate-900 outline-none"
                        disabled={instructionEditor.finishing_locked}
                      >
                        <option value="">Select Finishing Type</option>
                        {FINISHING_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </FilterLabel>
                  )}
                  {stage.key === "folding" && (
                    <FilterLabel label="Folding Type">
                      <select
                        value={instructionEditor.folding_type}
                        onChange={(e) => onInstructionFieldChange("folding_type", e.target.value)}
                        className="glass-input w-full px-3 py-2 text-sm text-slate-900 outline-none"
                        disabled={instructionEditor.folding_locked}
                      >
                        <option value="">Select Folding Type</option>
                        {FOLDING_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </FilterLabel>
                  )}
                </InstructionStageCard>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-slate-200/80 px-4 py-4 sm:px-6">
            <button type="button" onClick={onSaveInstructionChanges} disabled={savingInstruction} className="btn-primary disabled:opacity-60">
              {savingInstruction ? "Saving..." : "Save Instruction Changes"}
            </button>
            <p className="text-xs text-slate-500">Only non-completed stages can be edited or removed.</p>
          </div>
        </AdminShellCard>
      </div>
    )}

    {!activeInstructionLotId && (
      <AdminShellCard>
        <PanelHeader
          eyebrow="Checking Queue"
          title="Lots ready for planning"
          description="Only lots with checking meters appear here. Open any lot to manage its planned stages."
          action={<span className="status-pill">{instructionLots.length} lots</span>}
        />
        <div className="space-y-3 p-4 sm:p-6">
          {loadingLots ? (
            <p className="text-sm text-slate-600">Loading lots...</p>
          ) : instructionLots.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">No checking-stage lots found.</p>
          ) : (
            instructionLots.map((lot) => {
              const checking = one(lot.grey_checking);
              const selected = getInstructionSelectionSummary(lot);

              return (
                <div key={lot.id} className="rounded-[26px] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] p-4 shadow-sm">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-950">Lot #{lot.lot_no}</p>
                        <span className={`status-pill ${getStatusTone(lot.status)}`}>{lot.status}</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">Current Stage: {stageLabel(lot.current_stage)}</p>
                    </div>
                    <button type="button" onClick={() => onLoadInstructionLotById(lot.id, lot.lot_no)} className="btn-dark btn-sm">
                      Open
                    </button>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2 xl:grid-cols-4">
                    <p className="rounded-xl bg-slate-50 px-3 py-2">Checked Meters: {checking?.checked_meters ?? "-"}</p>
                    <p className="rounded-xl bg-slate-50 px-3 py-2">Length: {checking?.checked_length ?? "-"}</p>
                    <p className="rounded-xl bg-slate-50 px-3 py-2">Jodis: {checking?.jodis ?? "-"}</p>
                    <p className="rounded-xl bg-slate-50 px-3 py-2">Stages: {selected.join(", ") || "-"}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </AdminShellCard>
    )}
  </div>
);

export default AdminInstructionsPanel;
