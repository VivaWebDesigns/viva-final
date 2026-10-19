import { useEffect } from "react";
import { useLocation } from "wouter";

/** Mount inside the route Suspense boundary so retries finish after its module loads. */
export function RecoveryReady() {
  const [location] = useLocation();
  useEffect(() => { window.dispatchEvent(new Event("viva:page-ready")); }, [location]);
  return null;
}
