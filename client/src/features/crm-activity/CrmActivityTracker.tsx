import { useCallback, useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";

type Surface = "crm" | "pipeline" | "tasks" | "clients";
type EntityType = "lead" | "opportunity" | "contact" | "company" | "task" | "client";

interface ActivityContext {
  surface: Surface;
  entityType?: EntityType;
  entityId?: string;
}

function getActivityContext(path: string): ActivityContext | null {
  const parts = path.split("?")[0].split("/").filter(Boolean);
  if (parts[0] !== "admin") return null;

  if (parts[1] === "crm") {
    if (parts[2] === "leads" && parts[3]) return { surface: "crm", entityType: "lead", entityId: parts[3] };
    if (parts[2] === "contacts" && parts[3]) return { surface: "crm", entityType: "contact", entityId: parts[3] };
    if (parts[2] === "companies" && parts[3]) return { surface: "crm", entityType: "company", entityId: parts[3] };
    return { surface: "crm" };
  }

  if (parts[1] === "pipeline") {
    if (parts[2] === "opportunities" && parts[3]) {
      return { surface: "pipeline", entityType: "opportunity", entityId: parts[3] };
    }
    return { surface: "pipeline" };
  }

  if (parts[1] === "tasks") return { surface: "tasks" };
  if (parts[1] === "clients") {
    if (parts[2]) return { surface: "clients", entityType: "client", entityId: parts[2] };
    return { surface: "clients" };
  }

  return null;
}

function postActivity(payload: Record<string, unknown>) {
  return fetch("/api/crm-activity/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "include",
    keepalive: true,
  }).catch(() => undefined);
}

export default function CrmActivityTracker() {
  const [location] = useLocation();
  const context = useMemo(() => getActivityContext(location), [location]);
  const lastInputAt = useRef(Date.now());
  const lastTickAt = useRef(Date.now());
  const pendingActiveMs = useRef(0);
  const currentPayload = useRef<{ path: string; context: ActivityContext } | null>(null);

  const flushActiveTime = useCallback(() => {
    const payload = currentPayload.current;
    const activeMs = pendingActiveMs.current;
    if (!payload || activeMs < 5000) return;

    pendingActiveMs.current = 0;
    void postActivity({
      eventType: "active_time",
      surface: payload.context.surface,
      entityType: payload.context.entityType ?? null,
      entityId: payload.context.entityId ?? null,
      path: payload.path,
      activeMs: Math.round(activeMs),
    });
  }, []);

  useEffect(() => {
    const markInput = () => {
      lastInputAt.current = Date.now();
    };

    window.addEventListener("pointerdown", markInput, { passive: true });
    window.addEventListener("keydown", markInput);
    window.addEventListener("scroll", markInput, { passive: true });

    return () => {
      window.removeEventListener("pointerdown", markInput);
      window.removeEventListener("keydown", markInput);
      window.removeEventListener("scroll", markInput);
    };
  }, []);

  useEffect(() => {
    flushActiveTime();

    if (!context) {
      currentPayload.current = null;
      return;
    }

    currentPayload.current = { path: location, context };
    lastTickAt.current = Date.now();
    lastInputAt.current = Date.now();

    void postActivity({
      eventType: "view",
      surface: context.surface,
      entityType: context.entityType ?? null,
      entityId: context.entityId ?? null,
      path: location,
    });
  }, [context, flushActiveTime, location]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastTickAt.current;
      lastTickAt.current = now;

      if (
        currentPayload.current &&
        document.visibilityState === "visible" &&
        document.hasFocus() &&
        now - lastInputAt.current <= 2 * 60 * 1000
      ) {
        pendingActiveMs.current += elapsed;
      }

      flushActiveTime();
    }, 15000);

    window.addEventListener("beforeunload", flushActiveTime);
    document.addEventListener("visibilitychange", flushActiveTime);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("beforeunload", flushActiveTime);
      document.removeEventListener("visibilitychange", flushActiveTime);
      flushActiveTime();
    };
  }, [flushActiveTime]);

  return null;
}
