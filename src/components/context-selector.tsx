"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";
import type { EnergyLevel } from "@/types";

interface ContextSelectorProps {
  currentMinutes: number;
  currentEnergy: EnergyLevel;
  currentLocation: string;
  locations: { name: string; slug: string }[];
}

const timeOptions = [15, 30, 45, 60, 90, 120];

export function ContextSelector({
  currentMinutes,
  currentEnergy,
  currentLocation,
  locations,
}: ContextSelectorProps) {
  const router = useRouter();
  const { t } = useI18n();

  const energyOptions: { value: EnergyLevel; label: string }[] = [
    { value: "LOW", label: t.energy.LOW },
    { value: "MEDIUM", label: t.energy.MEDIUM },
    { value: "HIGH", label: t.energy.HIGH },
  ];

  const locationOptions = locations.map((location) => ({
    value: location.slug,
    label: location.name,
  }));

  function update(key: string, value: string) {
    const params = new URLSearchParams(window.location.search);
    params.set(key, value);
    router.push(`/?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2 rounded-lg border bg-card p-3 shadow-sm">
      <select
        value={currentMinutes.toString()}
        onChange={(e) => update("minutes", e.target.value)}
        className="rounded-md border bg-background px-2 py-1 text-xs"
      >
        {timeOptions.map((m) => (
          <option key={m} value={m}>{m} {t.common.min}</option>
        ))}
      </select>

      <select
        value={currentEnergy}
        onChange={(e) => update("energy", e.target.value)}
        className="rounded-md border bg-background px-2 py-1 text-xs"
      >
        {energyOptions.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      <select
        value={currentLocation}
        onChange={(e) => update("location", e.target.value)}
        className="rounded-md border bg-background px-2 py-1 text-xs"
      >
        {locationOptions.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
