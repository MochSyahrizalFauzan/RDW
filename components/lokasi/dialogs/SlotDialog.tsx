"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription as DialogDesc,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Field from "@/components/lokasi/Field";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyRow = any;

export type SlotForm = {
  rack_id: string;
  slot_code: string;
  slot_label: string;
  notes: string;
};

export default function SlotDialog({
  open,
  onOpenChange,
  isAdmin,
  form,
  setForm,
  racks,
  selectedWarehouseId,
  selectedRackId,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isAdmin: boolean;
  form: SlotForm;
  setForm: React.Dispatch<React.SetStateAction<SlotForm>>;
  racks: AnyRow[];
  selectedWarehouseId: string;
  selectedRackId: string;
  onSubmit: () => void;
}) {
  const valueRack = form.rack_id || selectedRackId || "";

  const rackOptions = racks
    .filter((r) =>
      selectedWarehouseId ? String(r.warehouse_id) === String(selectedWarehouseId) : true
    )
    .map((r) => ({
      rack_id: String(r.rack_id),
      label: `${r.warehouse_code}/${r.rack_code} ${r.zone ? `(${r.zone})` : ""}`,
    }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Tambah Slot</DialogTitle>
          <DialogDesc>Slot berada di dalam rak.</DialogDesc>
        </DialogHeader>

        {!isAdmin ? (
          <div className="rounded-xl border p-4 text-sm text-muted-foreground">
            Akses ditolak: hanya admin.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Rak *">
              <Select
                value={valueRack}
                onValueChange={(v) => setForm((p) => ({ ...p, rack_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih rak" />
                </SelectTrigger>
                <SelectContent>
                  {rackOptions.map((r) => (
                    <SelectItem key={r.rack_id} value={r.rack_id}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Kode Slot *">
              <Input
                value={form.slot_code}
                onChange={(e) => setForm((p) => ({ ...p, slot_code: e.target.value }))}
                placeholder="S1"
              />
            </Field>

            <Field label="Label (opsional)">
              <Input
                value={form.slot_label}
                onChange={(e) => setForm((p) => ({ ...p, slot_label: e.target.value }))}
                placeholder="Slot atas kiri"
              />
            </Field>

            <div className="sm:col-span-2">
              <Field label="Catatan (opsional)">
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Keterangan..."
                />
              </Field>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={onSubmit} disabled={!isAdmin}>
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
