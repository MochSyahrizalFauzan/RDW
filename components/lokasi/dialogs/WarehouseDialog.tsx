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

export type WarehouseForm = {
  warehouse_code: string;
  warehouse_name: string;
  address: string;
  capacity: string;
};

export default function WarehouseDialog({
  open,
  onOpenChange,
  isAdmin,
  form,
  setForm,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isAdmin: boolean;
  form: WarehouseForm;
  setForm: React.Dispatch<React.SetStateAction<WarehouseForm>>;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Tambah Gudang</DialogTitle>
          <DialogDesc>Isi data gudang baru.</DialogDesc>
        </DialogHeader>

        {!isAdmin ? (
          <div className="rounded-xl border p-4 text-sm text-muted-foreground">
            Akses ditolak: hanya admin.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Kode Gudang *">
              <Input
                value={form.warehouse_code}
                onChange={(e) =>
                  setForm((p) => ({ ...p, warehouse_code: e.target.value }))
                }
                placeholder="G1"
              />
            </Field>

            <Field label="Nama Gudang *">
              <Input
                value={form.warehouse_name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, warehouse_name: e.target.value }))
                }
                placeholder="Gudang Karasak"
              />
            </Field>

            <div className="sm:col-span-2">
              <Field label="Alamat">
                <Textarea
                  value={form.address}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, address: e.target.value }))
                  }
                  placeholder="Alamat gudang..."
                />
              </Field>
            </div>

            <Field label="Kapasitas (opsional)">
              <Input
                value={form.capacity}
                onChange={(e) =>
                  setForm((p) => ({ ...p, capacity: e.target.value }))
                }
                placeholder="100"
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
