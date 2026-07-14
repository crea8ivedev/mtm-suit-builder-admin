import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import DashboardLayout from "../components/layout/DashboardLayout";
import LoadingState from "../components/ui/LoadingState";
import { GarmentDropdown } from "../components/styleAdjustments/StyleListUI";
import {
  fetchJacketMeasurementFields,
  fetchTrouserMeasurementFields,
  fetchVestMeasurementFields,
  fetchShirtMeasurementFields,
  fetchJacketSizeTemplate,
  fetchTrouserSizeTemplate,
  fetchVestSizeTemplate,
  fetchShirtSizeTemplate,
  SIZE_TEMPLATE_TYPES,
} from "../lib/shopify";
import {
  AddMeasurementFieldModal,
  EditMeasurementFieldModal,
  DeleteMeasurementFieldModal,
} from "../components/measurements/MeasurementFieldModals";
import {
  AddStandardSizeModal,
  EditStandardSizeModal,
  DeleteStandardSizeModal,
} from "../components/measurements/StandardSizeModals";

const GARMENTS = ["Jacket", "Trouser", "Vest", "Shirt"];

const MEASUREMENT_TYPES = {
  Jacket: "jacket_custom_measurement",
  Trouser: "trouser_custom_measurement",
  Vest: "vest_custom_measurement",
  Shirt: "shirt_custom_measurement",
};

const MEASUREMENT_FETCHERS = {
  Jacket: fetchJacketMeasurementFields,
  Trouser: fetchTrouserMeasurementFields,
  Vest: fetchVestMeasurementFields,
  Shirt: fetchShirtMeasurementFields,
};

const SIZE_TEMPLATE_FETCHERS = {
  Jacket: fetchJacketSizeTemplate,
  Trouser: fetchTrouserSizeTemplate,
  Vest: fetchVestSizeTemplate,
  Shirt: fetchShirtSizeTemplate,
};

function SectionCard({ title, badge, action, children }) {
  return (
    <div className="bg-white rounded-[12px] p-[24px] flex flex-col gap-[16px] border border-gc-divider">
      <div className="flex items-center justify-between gap-[8px]">
        <div className="flex items-center gap-[8px]">
          <span className="font-garamond text-[18px] font-medium text-gc-near-black2">
            {title}
          </span>
          <span className="font-hanken text-[11px] font-medium text-[rgba(28,28,25,0.4)] uppercase tracking-wide">
            {badge}
          </span>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function RowCard({ primary, secondary, onEdit, onDelete }) {
  return (
    <div className="flex items-center justify-between gap-[16px] bg-gc-bg rounded-[8px] px-[16px] py-[12px] border border-gc-divider/50">
      <div className="flex flex-col min-w-0 gap-[2px]">
        <span className="font-hanken text-[13px] font-semibold text-gc-near-black2 truncate">
          {primary}
        </span>
        {secondary && (
          <span className="font-hanken text-[12px] text-[#6b7280] leading-relaxed break-words">
            {secondary}
          </span>
        )}
      </div>
      <div className="flex items-center gap-[6px] flex-shrink-0">
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center justify-center w-[28px] h-[28px] rounded-[6px] bg-white border border-gc-border-input cursor-pointer hover:opacity-80"
          title="Edit"
        >
          <Pencil size={12} className="text-gc-near-black2" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="flex items-center justify-center w-[28px] h-[28px] rounded-[6px] bg-red-50 border border-red-100 cursor-pointer hover:opacity-80"
          title="Delete"
        >
          <Trash2 size={12} className="text-red-700" />
        </button>
      </div>
    </div>
  );
}

function AddButton({ onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-hanken flex items-center gap-[6px] px-[12px] py-[7px] rounded-[8px] text-[12px] font-semibold text-white bg-gc-primary cursor-pointer hover:opacity-90"
    >
      <Plus size={13} />
      {label}
    </button>
  );
}

export default function Measurements() {
  const [garment, setGarment] = useState("Jacket");
  const [fields, setFields] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [addFieldOpen, setAddFieldOpen] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [deletingField, setDeletingField] = useState(null);

  const [addSizeOpen, setAddSizeOpen] = useState(false);
  const [editingSize, setEditingSize] = useState(null);
  const [deletingSize, setDeletingSize] = useState(null);

  const load = useCallback((g) => {
    setLoading(true);
    setError(null);
    Promise.all([MEASUREMENT_FETCHERS[g](), SIZE_TEMPLATE_FETCHERS[g]()])
      .then(([fieldsData, sizesData]) => {
        setFields(fieldsData);
        setSizes(sizesData);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load(garment);
  }, [garment, load]);

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-[24px] w-full">
        <div>
          <h2 className="gc-page-title">Measurements</h2>
          <p className="gc-page-subtitle">
            Measurement fields, ranges, and standard size chart per garment
          </p>
        </div>

        <div className="max-w-[280px]">
          <GarmentDropdown
            garments={GARMENTS}
            selected={garment}
            onSelect={setGarment}
          />
        </div>

        {loading ? (
          <LoadingState message="Loading measurements…" />
        ) : error ? (
          <p className="font-hanken text-[13px] text-red-600">{error}</p>
        ) : (
          <>
            <SectionCard
              title="Measurement Fields"
              badge={`${fields.length} fields`}
              action={
                <AddButton
                  label="Add Field"
                  onClick={() => setAddFieldOpen(true)}
                />
              }
            >
              {fields.length === 0 ? (
                <p className="font-hanken text-[13px] text-[#6b7280]">
                  No measurement fields configured for {garment} yet.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-[12px]">
                  {fields.map((f) => (
                    <RowCard
                      key={f.id ?? f.key}
                      primary={f.label}
                      secondary={`${f.min}–${f.max}`}
                      onEdit={() => setEditingField(f)}
                      onDelete={() => setDeletingField(f)}
                    />
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Standard Size Chart"
              badge={`${sizes.length} sizes`}
              action={
                <AddButton
                  label="Add Size"
                  onClick={() => setAddSizeOpen(true)}
                />
              }
            >
              {sizes.length === 0 ? (
                <p className="font-hanken text-[13px] text-[#6b7280]">
                  No standard sizes configured for {garment} yet.
                </p>
              ) : (
                <div className="grid grid-cols-1 2xl:grid-cols-2 gap-[12px]">
                  {sizes.map((s) => (
                    <RowCard
                      key={s.id}
                      primary={s.label}
                      secondary={Object.entries(s.values)
                        .filter(([, v]) => v)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join("  ·  ")}
                      onEdit={() => setEditingSize(s)}
                      onDelete={() => setDeletingSize(s)}
                    />
                  ))}
                </div>
              )}
            </SectionCard>
          </>
        )}
      </div>

      {addFieldOpen && (
        <AddMeasurementFieldModal
          garment={garment}
          garmentType={MEASUREMENT_TYPES[garment]}
          onClose={() => setAddFieldOpen(false)}
          onSaved={() => load(garment)}
        />
      )}
      {editingField && (
        <EditMeasurementFieldModal
          garment={garment}
          field={editingField}
          onClose={() => setEditingField(null)}
          onSaved={() => load(garment)}
        />
      )}
      {deletingField && (
        <DeleteMeasurementFieldModal
          garment={garment}
          field={deletingField}
          onClose={() => setDeletingField(null)}
          onDeleted={() => load(garment)}
        />
      )}

      {addSizeOpen && (
        <AddStandardSizeModal
          garment={garment}
          garmentType={SIZE_TEMPLATE_TYPES[garment]}
          onClose={() => setAddSizeOpen(false)}
          onSaved={() => load(garment)}
        />
      )}
      {editingSize && (
        <EditStandardSizeModal
          garment={garment}
          entry={editingSize}
          onClose={() => setEditingSize(null)}
          onSaved={() => load(garment)}
        />
      )}
      {deletingSize && (
        <DeleteStandardSizeModal
          garment={garment}
          entry={deletingSize}
          onClose={() => setDeletingSize(null)}
          onDeleted={() => load(garment)}
        />
      )}
    </DashboardLayout>
  );
}
