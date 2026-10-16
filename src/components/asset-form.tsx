"use client";

import { useRef } from "react";
import { createAsset } from "@/app/actions/asset-actions";
import { useI18n } from "@/components/i18n-provider";

interface Area {
  id: string;
  name: string;
}

export function AssetForm({ areas }: { areas: Area[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const { t } = useI18n();

  async function handleAction(formData: FormData) {
    await createAsset(formData);
    formRef.current?.reset();
  }

  return (
    <form ref={formRef} action={handleAction} className="flex gap-2">
      <input
        type="text"
        name="name"
        placeholder={`${t.assets.name}...`}
        required
        className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <select
        name="areaId"
        required
        className="rounded-md border border-input bg-background px-2 py-2 text-sm"
      >
        <option value="">{t.assets.selectArea}...</option>
        {areas.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        {t.common.add}
      </button>
    </form>
  );
}
