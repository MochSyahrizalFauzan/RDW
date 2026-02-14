"use client";

import React from "react";

export default function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <div className="text-sm font-semibold">{label}</div>
      {children}
    </div>
  );
}
