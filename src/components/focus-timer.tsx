"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { startFocusSession, completeFocusSession } from "@/app/actions/focus-actions";
import { useI18n } from "@/components/i18n-provider";

interface Task {
  id: string;
  title: string;
}

interface FocusTimerProps {
  tasks: Task[];
}

type TimerState = "idle" | "running" | "paused" | "done";

export function FocusTimer({ tasks }: FocusTimerProps) {
  const { t } = useI18n();
  const [duration, setDuration] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [state, setState] = useState<TimerState>("idle");
  const [taskId, setTaskId] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [distractions, setDistractions] = useState(0);
  const [notes, setNotes] = useState("");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (state === "running") {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            clearTimer();
            setState("done");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearTimer();
    }
    return clearTimer;
  }, [state, clearTimer]);

  function selectDuration(mins: number) {
    setDuration(mins);
    setSecondsLeft(mins * 60);
  }

  async function handleStart() {
    const formData = new FormData();
    formData.set("durationMin", duration.toString());
    if (taskId) formData.set("taskId", taskId);

    const id = await startFocusSession(formData);
    setSessionId(id);
    setSecondsLeft(duration * 60);
    setState("running");
  }

  function handlePause() {
    setState(state === "paused" ? "running" : "paused");
  }

  async function handleStop() {
    clearTimer();
    if (sessionId) {
      await completeFocusSession(sessionId, distractions, notes || undefined);
    }
    setState("idle");
    setSessionId(null);
    setDistractions(0);
    setNotes("");
    setSecondsLeft(duration * 60);
  }

  async function handleComplete() {
    if (sessionId) {
      await completeFocusSession(sessionId, distractions, notes || undefined);
    }
    setState("idle");
    setSessionId(null);
    setDistractions(0);
    setNotes("");
    setSecondsLeft(duration * 60);
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const progress = 1 - secondsLeft / (duration * 60);

  return (
    <div className="space-y-6">
      {/* Timer display */}
      <div className="rounded-lg border bg-card p-8 shadow-sm text-center">
        <div className="relative inline-flex items-center justify-center">
          <svg className="h-48 w-48 -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50" cy="50" r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-muted/30"
            />
            <circle
              cx="50" cy="50" r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeDasharray={`${progress * 283} 283`}
              strokeLinecap="round"
              className="text-primary transition-all duration-1000"
            />
          </svg>
          <span className="absolute text-5xl font-bold tabular-nums text-foreground">
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </span>
        </div>

        {/* Duration selector (only when idle) */}
        {state === "idle" && (
          <div className="mt-6">
            <div className="flex gap-2 justify-center mb-4">
              {[10, 25, 45].map((m) => (
                <button
                  key={m}
                  onClick={() => selectDuration(m)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    duration === m
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {m} min
                </button>
              ))}
            </div>

            {tasks.length > 0 && (
              <select
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
                className="mb-4 rounded-md border bg-background px-3 py-2 text-sm w-full max-w-xs"
              >
                <option value="">{t.focus.noTask}</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>{task.title}</option>
                ))}
              </select>
            )}

            <div>
              <button
                onClick={handleStart}
                className="rounded-md bg-primary px-8 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                {t.focus.start}
              </button>
            </div>
          </div>
        )}

        {/* Controls during session */}
        {(state === "running" || state === "paused") && (
          <div className="mt-6 flex gap-3 justify-center">
            <button
              onClick={handlePause}
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              {state === "paused" ? t.focus.resume : t.focus.pause}
            </button>
            <button
              onClick={handleStop}
              className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
            >
              {t.focus.stop}
            </button>
          </div>
        )}

        {/* Distraction counter during session */}
        {(state === "running" || state === "paused") && (
          <div className="mt-4 flex items-center justify-center gap-3">
            <span className="text-xs text-muted-foreground">{t.focus.distractionLabel}</span>
            <button
              onClick={() => setDistractions(Math.max(0, distractions - 1))}
              className="rounded-md border px-2 py-1 text-sm hover:bg-accent"
              aria-label="Trekk fra distraksjon"
            >
              -
            </button>
            <span className="text-lg font-bold tabular-nums w-8 text-center">{distractions}</span>
            <button
              onClick={() => setDistractions(distractions + 1)}
              className="rounded-md border px-2 py-1 text-sm hover:bg-accent"
              aria-label="Legg til distraksjon"
            >
              +
            </button>
          </div>
        )}

        {/* Completed */}
        {state === "done" && (
          <div className="mt-6 space-y-4">
            <p className="text-lg font-medium text-green-600">{t.focus.completed}</p>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t.focus.distractionLabel} {distractions}</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t.focus.notes}
                rows={2}
                className="w-full max-w-sm mx-auto block rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={handleComplete}
              className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t.focus.saveAndClose}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
