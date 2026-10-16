"use client";

import { createTask, updateTask } from "@/app/actions/task-actions";
import { useI18n } from "@/components/i18n-provider";
import {
  RealtimeTaskAgent,
  type RealtimeTaskDraft,
} from "@/components/realtime-task-agent";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface Area {
  id: string;
  name: string;
}

interface Asset {
  id: string;
  name: string;
}

interface Location {
  name: string;
  slug: string;
}

interface TaskFormProps {
  areas: Area[];
  assets?: Asset[];
  locations: Location[];
  task?: {
    id: string;
    title: string;
    description: string | null;
    areaId: string;
    assetId: string | null;
    estimatedMinutes: number | null;
    energyLevel: string;
    locationType: string;
    priority: string;
    dueDate: Date | null;
    status: string;
  };
}

export function TaskForm({ areas, assets = [], locations, task }: TaskFormProps) {
  const router = useRouter();
  const { t } = useI18n();
  const isEdit = !!task;
  const [title, setTitle] = useState(task?.title || "");
  const [description, setDescription] = useState(task?.description || "");
  const [dueDate, setDueDate] = useState(
    task?.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : ""
  );
  const [areaId, setAreaId] = useState(task?.areaId || "");
  const [priority, setPriority] = useState(task?.priority || "MEDIUM");
  const [energyLevel, setEnergyLevel] = useState(
    task?.energyLevel || "MEDIUM"
  );
  const [estimatedMinutes, setEstimatedMinutes] = useState(
    task?.estimatedMinutes?.toString() || ""
  );
  const [locationType, setLocationType] = useState(
    task?.locationType ||
      locations.find((location) => location.slug === "ANYWHERE")?.slug ||
      locations[0]?.slug ||
      ""
  );

  const energyOptions = [
    { value: "LOW", label: t.energy.LOW },
    { value: "MEDIUM", label: t.energy.MEDIUM },
    { value: "HIGH", label: t.energy.HIGH },
  ];

  const locationOptions = locations.map((location) => ({
    value: location.slug,
    label: location.name,
  }));

  const priorityOptions = [
    { value: "LOW", label: t.priority.LOW },
    { value: "MEDIUM", label: t.priority.MEDIUM },
    { value: "HIGH", label: t.priority.HIGH },
  ];

  const statusOptions = [
    { value: "INBOX", label: t.status.INBOX },
    { value: "TODO", label: t.status.TODO },
    { value: "IN_PROGRESS", label: t.status.IN_PROGRESS },
    { value: "DONE", label: t.status.DONE },
  ];

  async function handleAction(formData: FormData) {
    if (isEdit) {
      formData.set("id", task.id);
      await updateTask(formData);
    } else {
      await createTask(formData);
    }
    router.push("/tasks");
  }

  function handleAgentDraft(draft: RealtimeTaskDraft) {
    setTitle(draft.title);
    setDescription(draft.description);
    setDueDate(draft.dueDate);
    if (draft.areaId) setAreaId(draft.areaId);
    setPriority(draft.priority);
    setEnergyLevel(draft.energyLevel);
    setEstimatedMinutes(draft.estimatedMinutes?.toString() || "");
    setLocationType(draft.locationType);
  }

  return (
    <form action={handleAction} className="space-y-4">
      {!isEdit && (
        <RealtimeTaskAgent
          areas={areas}
          locations={locations}
          onDraft={handleAgentDraft}
        />
      )}

      {/* Tittel */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-foreground">
          {t.tasks.taskTitle} *
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Beskrivelse */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-foreground">
          {t.tasks.description}
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Område + Status (på én rad) */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="areaId" className="block text-sm font-medium text-foreground">
            {t.tasks.area} *
          </label>
          <select
            id="areaId"
            name="areaId"
            required
            value={areaId}
            onChange={(event) => setAreaId(event.target.value)}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Velg...</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        {isEdit && (
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-foreground">
              {t.tasks.status}
            </label>
            <select
              id="status"
              name="status"
              defaultValue={task.status}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {statusOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Eiendel */}
      {assets.length > 0 && (
        <div>
          <label htmlFor="assetId" className="block text-sm font-medium text-foreground">
            {t.tasks.asset}
          </label>
          <select
            id="assetId"
            name="assetId"
            defaultValue={task?.assetId || ""}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Ingen</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Prioritet + Energi + Tid */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label htmlFor="priority" className="block text-sm font-medium text-foreground">
            {t.tasks.priority}
          </label>
          <select
            id="priority"
            name="priority"
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {priorityOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="energyLevel" className="block text-sm font-medium text-foreground">
            {t.tasks.energy}
          </label>
          <select
            id="energyLevel"
            name="energyLevel"
            value={energyLevel}
            onChange={(event) => setEnergyLevel(event.target.value)}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {energyOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="estimatedMinutes" className="block text-sm font-medium text-foreground">
            {t.tasks.estimatedTime}
          </label>
          <input
            id="estimatedMinutes"
            name="estimatedMinutes"
            type="number"
            min={1}
            value={estimatedMinutes}
            onChange={(event) => setEstimatedMinutes(event.target.value)}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Sted + Frist */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="locationType" className="block text-sm font-medium text-foreground">
            {t.tasks.location}
          </label>
          <select
            id="locationType"
            name="locationType"
            value={locationType}
            onChange={(event) => setLocationType(event.target.value)}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {locationOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="dueDate" className="block text-sm font-medium text-foreground">
            {t.tasks.dueDate}
          </label>
          <input
            id="dueDate"
            name="dueDate"
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Knapper */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {isEdit ? t.common.save : t.common.create}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent"
        >
          {t.common.cancel}
        </button>
      </div>
    </form>
  );
}
