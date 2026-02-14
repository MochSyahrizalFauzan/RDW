"use client";

import React from "react";

import { Button } from "@/components/ui/button";
import { AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator as DSep,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { AlertTriangle, ArrowLeftRight, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */
type EquipmentRow = any;

export default function EquipmentRowActions({
  row,
  isAdmin,
  onEdit,
  onMove,
  onDelete,
}: {
  row: EquipmentRow;
  isAdmin: boolean;
  onEdit: (row: EquipmentRow) => void;
  onMove: (row: EquipmentRow) => void;
  onDelete: (row: EquipmentRow) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Aksi</DropdownMenuLabel>
        <DSep />

        <DropdownMenuItem onClick={() => onEdit(row)} disabled={!isAdmin}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => onMove(row)} disabled={!isAdmin}>
          <ArrowLeftRight className="mr-2 h-4 w-4" />
          Pindahkan
        </DropdownMenuItem>

        <DSep />

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <DropdownMenuItem
              onSelect={(ev) => ev.preventDefault()}
              disabled={!isAdmin}
              className="text-rose-600 focus:text-rose-600"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Hapus
            </DropdownMenuItem>
          </AlertDialogTrigger>

          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hapus Barang?</AlertDialogTitle>
              <AlertDialogDescription>
                Data barang <b>{row?.equipment_code}</b> akan dihapus permanen.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction
                className="bg-rose-600 hover:bg-rose-600"
                onClick={() => onDelete(row)}
              >
                Hapus
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {!isAdmin && (
          <>
            <DSep />
            <div className="px-2 py-2 text-xs text-muted-foreground flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5" />
              Aksi edit/pindah/hapus hanya untuk Admin.
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
