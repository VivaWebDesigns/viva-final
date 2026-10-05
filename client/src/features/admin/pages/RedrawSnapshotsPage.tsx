import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import LocalVisibilityReportTemplate, { type MapPosition } from "@/features/local-visibility-report/LocalVisibilityReportTemplate";
import { renderLocalVisibilityReportBlob } from "@/features/local-visibility-report/exportReport";
import type { LocalVisibilityReportData } from "@/features/local-visibility-report/types";

interface RedrawQueueItem {
  reportId: string;
  businessName: string;
  snapshotGeneratedAt: string | null;
}

interface ReportSnapshotData {
  data: LocalVisibilityReportData;
  mapPresentation: { mapZoom: number; mapPosition: MapPosition };
}

const QUEUE_KEY = ["/api/instantly/enrollment/redraw-queue"];

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

/** Redraws the finished snapshot for every lead staged for Instantly, one report at a time. */
export default function RedrawSnapshotsPage() {
  const queryClient = useQueryClient();
  const reportRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef<(() => void) | null>(null);
  const stopRef = useRef(false);
  const [current, setCurrent] = useState<ReportSnapshotData | null>(null);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [failures, setFailures] = useState<Array<{ businessName: string; message: string }>>([]);

  const { data: queue = [], isLoading, error } = useQuery<RedrawQueueItem[]>({ queryKey: QUEUE_KEY });
  // Pictures drawn today already carry the new numbers, so a stopped run resumes where it left off.
  const pending = queue.filter(item => !item.snapshotGeneratedAt || new Date(item.snapshotGeneratedAt) < startOfToday());

  useEffect(() => {
    if (!current || !renderedRef.current) return;
    const resolve = renderedRef.current;
    renderedRef.current = null;
    resolve();
  }, [current]);

  const showReport = (snapshot: ReportSnapshotData) => new Promise<void>(resolve => {
    renderedRef.current = resolve;
    setCurrent(snapshot);
  });

  const redrawOne = async (item: RedrawQueueItem) => {
    const response = await fetch(`/api/local-visibility/reports/${encodeURIComponent(item.reportId)}`, { credentials: "include" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message ?? "Could not load the report");
    await showReport(body as ReportSnapshotData);
    const blob = await renderLocalVisibilityReportBlob(reportRef.current);
    const form = new FormData();
    form.append("snapshot", blob, `${item.reportId}-local-visibility-snapshot.png`);
    form.append("reportMetric", "ATRP");
    const upload = await fetch(`/api/local-visibility/reports/${encodeURIComponent(item.reportId)}/snapshot`, {
      method: "POST",
      credentials: "include",
      body: form,
    });
    const uploadBody = await upload.json();
    if (!upload.ok) throw new Error(uploadBody.message ?? "Could not save the snapshot");
  };

  const start = async () => {
    const items = pending;
    stopRef.current = false;
    setRunning(true);
    setDone(0);
    setTotal(items.length);
    setFailures([]);
    for (const item of items) {
      if (stopRef.current) break;
      try {
        await redrawOne(item);
      } catch (redrawError) {
        const message = redrawError instanceof Error ? redrawError.message : "Unknown error";
        setFailures(previous => [...previous, { businessName: item.businessName, message }]);
      }
      setDone(previous => previous + 1);
    }
    setCurrent(null);
    setRunning(false);
    await queryClient.invalidateQueries({ queryKey: QUEUE_KEY });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Redraw report pictures</h1>
        <p className="mt-1 text-sm text-gray-600">
          Redraws the finished snapshot for each lead staged for Instantly, using the current review count and rating.
          The scan map does not change. Keep this tab open while it runs.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {isLoading ? "Loading reports…" : `${pending.length} of ${queue.length} pictures still need redrawing`}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <p className="text-sm text-red-600">{(error as Error).message}</p>}
          {running || total > 0 ? (
            <div className="space-y-2">
              <Progress value={total ? (done / total) * 100 : 0} />
              <p className="text-sm text-gray-600" data-testid="text-redraw-progress">
                {done} of {total} done{failures.length ? ` · ${failures.length} failed` : ""}
              </p>
            </div>
          ) : null}
          <div className="flex gap-2">
            <Button onClick={start} disabled={running || isLoading || pending.length === 0} data-testid="button-redraw-start">
              {running ? "Redrawing…" : "Start"}
            </Button>
            {running && (
              <Button variant="outline" onClick={() => { stopRef.current = true; }} data-testid="button-redraw-stop">
                Stop after this one
              </Button>
            )}
          </div>
          {failures.length > 0 && (
            <ul className="space-y-1 text-sm text-red-700">
              {failures.map(failure => <li key={failure.businessName}>{failure.businessName}: {failure.message}</li>)}
            </ul>
          )}
        </CardContent>
      </Card>

      {current && (
        <div className="fixed left-[-10000px] top-0 w-[1080px]" aria-hidden="true">
          <LocalVisibilityReportTemplate
            ref={reportRef}
            data={current.data}
            mapZoom={current.mapPresentation.mapZoom}
            mapPosition={current.mapPresentation.mapPosition}
          />
        </div>
      )}
    </div>
  );
}
