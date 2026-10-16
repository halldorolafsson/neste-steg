"use client";

import { useRef } from "react";
import { createInboxTask } from "@/app/actions/task-actions";
import { useI18n } from "@/components/i18n-provider";

export function InboxForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const { t } = useI18n();

  async function handleAction(formData: FormData) {
    await createInboxTask(formData);
    formRef.current?.reset();
  }

  return (
    <form ref={formRef} action={handleAction} className="flex gap-2">
      <input
        type="text"
        name="title"
        placeholder={t.inbox.placeholder}
        required
        autoFocus
        className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <button
        type="submit"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        {t.common.add}
      </button>
    </form>
  );
}
