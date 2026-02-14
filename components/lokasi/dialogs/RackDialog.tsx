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

export type RackForm = {
  warehouse_id: string;
  rack_code: string;
  zone: string;
  capacity: string;
};

export default function RackDialog({
  open,
  onOpenChange,
  isAdmin,
  form,
  setForm,
  warehouses,
  selectedWarehouseId,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isAdmin: boolean;
  form: RackForm;
  setForm: React.Dispatch<React.SetStateAction<RackForm>>;
  warehouses: AnyRow[];
  selectedWarehouseId: string;
  onSubmit: () => void;
}) {
  const valueWarehouse = form.warehouse_id || selectedWarehouseId || "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Tambah Rak</DialogTitle>
          <DialogDesc>Rak berada di dalam gudang.</DialogDesc>
        </DialogHeader>

        {!isAdmin ? (
          <div className="rounded-xl border p-4 text-sm text-muted-foreground">
            Akses ditolak: hanya admin.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Gudang *">
              <Select
                value={valueWarehouse}
                onValueChange={(v) => setForm((p) => ({ ...p, warehouse_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih gudang" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.warehouse_id} value={String(w.warehouse_id)}>
                      {w.warehouse_code} — {w.warehouse_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Kode Rak *">
              <Input
                value={form.rack_code}
                onChange={(e) => setForm((p) => ({ ...p, rack_code: e.target.value }))}
                placeholder="R1"
              />
            </Field>

            <Field label="Zona (opsional)">
              <Input
                value={form.zone}
                onChange={(e) => setForm((p) => ({ ...p, zone: e.target.value }))}
                placeholder="A / B / C"
              />
            </Field>

            <Field label="Kapasitas (opsional)">
              <Input
                value={form.capacity}
                onChange={(e) => setForm((p) => ({ ...p, capacity: e.target.value }))}
                placeholder="50"
              />
            </Field>
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
