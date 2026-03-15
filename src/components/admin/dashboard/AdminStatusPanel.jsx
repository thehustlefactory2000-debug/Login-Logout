import React from "react";
import { STAGE_OPTIONS } from "../../../constants/workflow";
import {
  AdminShellCard,
  FilterLabel,
  MetricCard,
  PanelHeader,
  getStatusTone,
  getLotStageProgress,
  stageLabel,
  toPrintableDate,
} from "./adminDashboardShared";

const renderStageProgress = (lot) => (
  <div className="flex flex-wrap gap-1">
    {getLotStageProgress(lot).map((stage) => (
      <span
        key={stage.stage}
        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
          stage.done ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-400"
        }`}
      >
        {stage.shortLabel}
      </span>
    ))}
  </div>
);

const AdminStatusPanel = ({
  filters,
  filterSuggestions,
  lots,
  stats,
  loadingLots,
  deletingLotId,
  onFilterChange,
  onFetchLots,
  onResetFilters,
  onExportPdf,
  onExportExcelCsv,
  onDeleteLotRequest,
  getProcessedMeters,
}) => (
  <div className="space-y-4">
    <AdminShellCard>
      <PanelHeader
        eyebrow="Live Filters"
        title="Lot status explorer"
        description="Use the filters below to narrow the live lot list and export the current result set."
        action={
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onFetchLots} disabled={loadingLots} className="btn-primary disabled:opacity-60">
              {loadingLots ? "Fetching..." : "Fetch Details"}
            </button>
            <button type="button" onClick={onResetFilters} className="btn-secondary">
              Reset Filters
            </button>
          </div>
        }
      />

      <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-4">
        <FilterLabel label="Lot No">
          <>
            <input
              type="number"
              list="admin-lot-no-suggestions"
              placeholder="Search lot"
              value={filters.lotNo}
              onChange={(e) => onFilterChange("lotNo", e.target.value)}
              className="glass-input w-full px-3 py-2 text-sm outline-none"
            />
            <datalist id="admin-lot-no-suggestions">
              {filterSuggestions.lotNos.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
          </>
        </FilterLabel>
        <FilterLabel label="Stage">
          <select value={filters.stage} onChange={(e) => onFilterChange("stage", e.target.value)} className="glass-input w-full px-3 py-2 text-sm outline-none">
            <option value="">All Stages</option>
            {[...STAGE_OPTIONS, "completed"].map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </select>
        </FilterLabel>
        <FilterLabel label="Status">
          <select value={filters.status} onChange={(e) => onFilterChange("status", e.target.value)} className="glass-input w-full px-3 py-2 text-sm outline-none">
            <option value="">All Status</option>
            <option value="active">active</option>
            <option value="completed">completed</option>
            <option value="cancelled">cancelled</option>
          </select>
        </FilterLabel>
        <FilterLabel label="Cloth Type">
          <>
            <input
              type="text"
              list="admin-cloth-type-suggestions"
              placeholder="Cloth type"
              value={filters.clothType}
              onChange={(e) => onFilterChange("clothType", e.target.value)}
              className="glass-input w-full px-3 py-2 text-sm outline-none"
            />
            <datalist id="admin-cloth-type-suggestions">
              {filterSuggestions.clothTypes.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
          </>
        </FilterLabel>
        <FilterLabel label="Party Name">
          <>
            <input
              type="text"
              list="admin-party-suggestions"
              placeholder="Party name"
              value={filters.partyName}
              onChange={(e) => onFilterChange("partyName", e.target.value)}
              className="glass-input w-full px-3 py-2 text-sm outline-none"
            />
            <datalist id="admin-party-suggestions">
              {filterSuggestions.partyNames.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
          </>
        </FilterLabel>
        <FilterLabel label="Grey Party Name">
          <>
            <input
              type="text"
              list="admin-grey-party-suggestions"
              placeholder="Grey party name"
              value={filters.greyPartyName}
              onChange={(e) => onFilterChange("greyPartyName", e.target.value)}
              className="glass-input w-full px-3 py-2 text-sm outline-none"
            />
            <datalist id="admin-grey-party-suggestions">
              {filterSuggestions.greyPartyNames.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
          </>
        </FilterLabel>
        <FilterLabel label="Start Date">
          <input type="date" value={filters.startDate} onChange={(e) => onFilterChange("startDate", e.target.value)} className="glass-input w-full px-3 py-2 text-sm outline-none" />
        </FilterLabel>
        <FilterLabel label="End Date">
          <input type="date" value={filters.endDate} onChange={(e) => onFilterChange("endDate", e.target.value)} className="glass-input w-full px-3 py-2 text-sm outline-none" />
        </FilterLabel>
      </div>

      {(filters.lotNo.trim() || filters.stage || filters.status || filters.clothType.trim() || filters.partyName.trim() || filters.greyPartyName.trim() || filters.startDate || filters.endDate) && lots.length === 1 && (
        <div className="border-t border-slate-200 px-4 py-4 sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Filtered Lot Progress</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">Lot #{lots[0].lot_no}</p>
          <div className="mt-3">{renderStageProgress(lots[0])}</div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-slate-200 px-4 py-4 sm:px-6">
        <button type="button" onClick={onExportPdf} disabled={!lots.length} className="btn-dark disabled:opacity-60">
          Download PDF
        </button>
        <button type="button" onClick={onExportExcelCsv} disabled={!lots.length} className="btn-primary disabled:opacity-60">
          Download Excel
        </button>
      </div>
    </AdminShellCard>

    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <MetricCard label="Total Lots" value={stats.totalLots} tone="slate" />
      <MetricCard label="Active" value={stats.activeLots} tone="blue" />
      <MetricCard label="Completed" value={stats.completedLots} tone="emerald" />
      <MetricCard label="Cancelled" value={stats.cancelledLots} tone="red" />
      <MetricCard label="Processed Meters" value={stats.totalProcessedMeters.toFixed(2)} tone="amber" />
    </div>

    <AdminShellCard>
      <PanelHeader eyebrow="Lot Register" title="Current workflow lots" description="Mobile cards and desktop table reflect the same filtered result set." />

      <div className="space-y-3 p-4 lg:hidden">
        {!loadingLots && !lots.length && (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">No lots found for selected filters.</p>
        )}
        {lots.map((lot) => (
          <div key={lot.id} className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-900">#{lot.lot_no}</p>
                  <span className={`status-pill ${getStatusTone(lot.status)}`}>{lot.status}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{stageLabel(lot.current_stage)}</p>
              </div>
              <button
                type="button"
                onClick={() => onDeleteLotRequest(lot)}
                disabled={deletingLotId === lot.id}
                className="btn-danger btn-sm disabled:opacity-60"
              >
                Delete
              </button>
            </div>
            <div className="mt-3 space-y-2 text-xs text-slate-600">
              <p>Party: {lot.party?.name || "-"}</p>
              <p>Grey Party: {lot.grey_party?.name || "-"}</p>
              <p>Cloth: {lot.cloth_type || "-"}</p>
              <p>Processed: {getProcessedMeters(lot).toFixed(2)}</p>
              <p>Created: {toPrintableDate(lot.created_at)}</p>
            </div>
            <div className="mt-3 text-xs text-slate-600">
              <p className="mb-2 font-semibold uppercase tracking-[0.18em] text-[10px] text-slate-400">Progress</p>
              {renderStageProgress(lot)}
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto p-4 lg:block lg:p-6">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
              <th className="py-3 pr-3">Lot</th>
              <th className="py-3 pr-3">Stage</th>
              <th className="py-3 pr-3">Status</th>
              <th className="py-3 pr-3">Party</th>
              <th className="py-3 pr-3">Grey Party</th>
              <th className="py-3 pr-3">Cloth</th>
              <th className="py-3 pr-3">Processed</th>
              <th className="py-3 pr-3">Created</th>
              <th className="py-3 pr-3">Progress</th>
              <th className="py-3 pr-0">Action</th>
            </tr>
          </thead>
          <tbody>
            {!loadingLots && !lots.length && (
              <tr>
                <td colSpan={10} className="py-10 text-center text-sm text-slate-500">
                  No lots found for selected filters.
                </td>
              </tr>
            )}
            {lots.map((lot) => (
              <tr key={lot.id} className="border-b border-slate-100 text-slate-700">
                <td className="py-4 pr-3 font-semibold text-slate-900">#{lot.lot_no}</td>
                <td className="py-4 pr-3">{stageLabel(lot.current_stage)}</td>
                <td className="py-4 pr-3">
                  <span className={`status-pill ${getStatusTone(lot.status)}`}>{lot.status}</span>
                </td>
                <td className="py-4 pr-3">{lot.party?.name || "-"}</td>
                <td className="py-4 pr-3">{lot.grey_party?.name || "-"}</td>
                <td className="py-4 pr-3">{lot.cloth_type || "-"}</td>
                <td className="py-4 pr-3">{getProcessedMeters(lot).toFixed(2)}</td>
                <td className="py-4 pr-3">{toPrintableDate(lot.created_at)}</td>
                <td className="py-4 pr-3">{renderStageProgress(lot)}</td>
                <td className="py-4 pr-0">
                  <button
                    type="button"
                    onClick={() => onDeleteLotRequest(lot)}
                    disabled={deletingLotId === lot.id}
                    className="btn-danger btn-sm disabled:opacity-60"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShellCard>
  </div>
);

export default AdminStatusPanel;

