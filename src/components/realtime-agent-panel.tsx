"use client";

import { useEffect, useRef, useState } from "react";
import { RealtimeSession, type RealtimeAgent } from "@openai/agents/realtime";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";

type AgentStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "speaking"
  | "working";

interface RealtimeAgentPanelProps {
  createAgent: (voice: string) => RealtimeAgent;
  draftToolName: string;
}

interface SessionTokenResponse {
  value?: string;
  model?: string;
  voice?: string;
  maxSessionSeconds?: number;
  error?: string;
}

export function RealtimeAgentPanel({
  createAgent,
  draftToolName,
}: RealtimeAgentPanelProps) {
  const { t } = useI18n();
  const [status, setStatus] = useState<AgentStatus>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const sessionRef = useRef<RealtimeSession | null>(null);
  const sessionTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (sessionTimeoutRef.current !== null) {
        window.clearTimeout(sessionTimeoutRef.current);
      }
      sessionRef.current?.close();
      sessionRef.current = null;
    };
  }, []);

  function disconnect() {
    if (sessionTimeoutRef.current !== null) {
      window.clearTimeout(sessionTimeoutRef.current);
      sessionTimeoutRef.current = null;
    }
    sessionRef.current?.close();
    sessionRef.current = null;
    setIsMuted(false);
    setStatus("idle");
  }

  async function connect() {
    setError("");
    setNotice("");
    setDraftReady(false);

    if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
      setError(t.realtimeAgent.microphoneUnavailable);
      return;
    }

    setStatus("connecting");

    try {
      const tokenResponse = await fetch("/api/realtime/session", {
        method: "POST",
      });
      const token = (await tokenResponse.json()) as SessionTokenResponse;

      if (
        !tokenResponse.ok ||
        !token.value ||
        !token.model ||
        !token.voice ||
        typeof token.maxSessionSeconds !== "number"
      ) {
        throw new Error(token.error || t.realtimeAgent.genericError);
      }

      const agent = createAgent(token.voice);
      const realtimeSession = new RealtimeSession(agent, {
        model: token.model,
        config: {
          audio: {
            input: {
              noiseReduction: { type: "near_field" },
              turnDetection: {
                type: "semantic_vad",
                eagerness: "medium",
                createResponse: true,
                interruptResponse: true,
              },
            },
            output: { voice: token.voice },
          },
        },
        workflowName: "Neste steg taleagent",
      });

      realtimeSession.on("audio_start", () => setStatus("speaking"));
      realtimeSession.on("audio_stopped", () => setStatus("listening"));
      realtimeSession.on("agent_tool_start", () => setStatus("working"));
      realtimeSession.on("agent_tool_end", (_context, _agent, tool) => {
        setStatus("listening");
        if (tool.name === draftToolName) setDraftReady(true);
      });
      realtimeSession.on("error", (event) => {
        console.error("Realtime-agenten feilet:", event);
        setError(t.realtimeAgent.genericError);
        disconnect();
      });

      sessionRef.current = realtimeSession;
      await realtimeSession.connect({ apiKey: token.value });
      setStatus("listening");
      sessionTimeoutRef.current = window.setTimeout(() => {
        disconnect();
        setNotice(t.realtimeAgent.sessionEnded);
      }, token.maxSessionSeconds * 1000);
    } catch (caught) {
      disconnect();
      const denied =
        caught instanceof DOMException && caught.name === "NotAllowedError";
      setError(
        denied
          ? t.realtimeAgent.microphoneDenied
          : caught instanceof Error
            ? caught.message
            : t.realtimeAgent.genericError
      );
    }
  }

  function toggleMute() {
    const session = sessionRef.current;
    if (!session) return;

    const shouldMute = !isMuted;
    session.mute(shouldMute);
    setIsMuted(shouldMute);
  }

  const statusText = {
    idle: "",
    connecting: t.realtimeAgent.connecting,
    listening: t.realtimeAgent.listening,
    speaking: t.realtimeAgent.speaking,
    working: t.realtimeAgent.working,
  }[status];

  const connected = !["idle", "connecting"].includes(status);

  return (
    <div className="space-y-3 border-b pb-4">
      <p className="text-sm font-medium text-foreground">
        {t.realtimeAgent.title}
      </p>

      <div className="flex min-h-10 flex-wrap items-center gap-2">
        {connected ? (
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              setNotice("");
              disconnect();
            }}
          >
            {t.realtimeAgent.stop}
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => void connect()}
            disabled={status === "connecting"}
          >
            {t.realtimeAgent.start}
          </Button>
        )}

        {connected && (
          <Button
            type="button"
            variant="outline"
            onClick={toggleMute}
            title={
              isMuted
                ? t.realtimeAgent.unmute
                : t.realtimeAgent.mute
            }
            aria-label={
              isMuted
                ? t.realtimeAgent.unmute
                : t.realtimeAgent.mute
            }
          >
            {isMuted ? t.realtimeAgent.unmute : t.realtimeAgent.mute}
          </Button>
        )}

        {statusText && (
          <span
            className="inline-flex min-w-28 items-center text-sm text-muted-foreground"
            aria-live="polite"
          >
            {isMuted ? t.realtimeAgent.muted : statusText}
          </span>
        )}
      </div>

      {draftReady && (
        <p className="text-sm text-emerald-700" aria-live="polite">
          {t.realtimeAgent.draftReady}
        </p>
      )}

      {notice && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {notice}
        </p>
      )}

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
