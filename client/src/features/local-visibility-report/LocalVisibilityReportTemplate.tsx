import { forwardRef, useRef, useState, type PointerEvent } from "react";
import {
  FiBarChart2,
  FiCrosshair,
  FiHome,
  FiImage,
  FiMapPin,
  FiSearch,
} from "react-icons/fi";
import { FaRegStar, FaStar } from "react-icons/fa";
import type { LocalVisibilityReportData } from "./types";
import {
  formatScanSettings,
  LOCAL_VISIBILITY_REPORT_HEIGHT,
  LOCAL_VISIBILITY_REPORT_WIDTH,
} from "./types";
import "./local-visibility-report.css";

type Props = {
  data: LocalVisibilityReportData;
  mapZoom?: number;
  mapPosition?: MapPosition;
  onMapPositionChange?: (position: MapPosition) => void;
};

export type MapPosition = { x: number; y: number };

const HEATMAP_WIDTH = 1000;
const HEATMAP_HEIGHT = 960;
const MAX_MAP_OFFSET_X = HEATMAP_WIDTH / 2;
const MAX_MAP_OFFSET_Y = HEATMAP_HEIGHT / 2;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatReviews(value: string): string {
  if (!value.trim()) return "";
  const count = Number(value);
  if (!Number.isFinite(count)) return value.trim();
  return `${count.toLocaleString()} ${count === 1 ? "review" : "reviews"}`;
}

function Rating({ rating, reviewCount }: Pick<LocalVisibilityReportData, "rating" | "reviewCount">) {
  if (!rating.trim()) return null;

  const numericRating = Math.min(5, Math.max(0, Number(rating) || 0));
  const filledStars = Math.round(numericRating);
  const reviews = formatReviews(reviewCount);

  return (
    <div className="lvr-rating" aria-label={`${rating} out of 5${reviews ? ` from ${reviews}` : ""}`}>
      <strong>{rating}</strong>
      <span className="lvr-stars" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((index) =>
          index < filledStars ? <FaStar key={index} /> : <FaRegStar key={index} />,
        )}
      </span>
      {reviews && <span className="lvr-review-count">({reviews})</span>}
    </div>
  );
}

const LocalVisibilityReportTemplate = forwardRef<HTMLDivElement, Props>(function LocalVisibilityReportTemplate(
  { data, mapZoom = 100, mapPosition = { x: 0, y: 0 }, onMapPositionChange },
  ref,
) {
  const dragStartRef = useRef<{ clientX: number; clientY: number; position: MapPosition } | null>(null);
  const [isDraggingMap, setIsDraggingMap] = useState(false);

  const handleMapPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!data.heatmapImageUrl || !onMapPositionChange) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragStartRef.current = { clientX: event.clientX, clientY: event.clientY, position: mapPosition };
    setIsDraggingMap(true);
  };

  const handleMapPointerMove = (event: PointerEvent<HTMLElement>) => {
    const start = dragStartRef.current;
    if (!start || !onMapPositionChange) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const scaleX = HEATMAP_WIDTH / (bounds.width || HEATMAP_WIDTH);
    const scaleY = HEATMAP_HEIGHT / (bounds.height || HEATMAP_HEIGHT);
    onMapPositionChange({
      x: clamp(start.position.x + (event.clientX - start.clientX) * scaleX, -MAX_MAP_OFFSET_X, MAX_MAP_OFFSET_X),
      y: clamp(start.position.y + (event.clientY - start.clientY) * scaleY, -MAX_MAP_OFFSET_Y, MAX_MAP_OFFSET_Y),
    });
  };

  const stopMapDrag = (event: PointerEvent<HTMLElement>) => {
    if (!dragStartRef.current) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    dragStartRef.current = null;
    setIsDraggingMap(false);
  };

  return (
    <div
      ref={ref}
      className="lvr-report"
      data-testid="local-visibility-report-template"
      data-export-width={LOCAL_VISIBILITY_REPORT_WIDTH}
      data-export-height={LOCAL_VISIBILITY_REPORT_HEIGHT}
    >
      <div className="lvr-report-body">
        <header className="lvr-header">
          <img
            className="lvr-header-logo"
            src="/img/logo-header-lockup-20260713-v2.svg"
            alt="Viva Web Design and Local SEO"
            width="1213"
            height="395"
          />
          <span className="lvr-header-divider" aria-hidden="true" />
          <div className="lvr-title-wrap">
            <h2>Local Visibility Snapshot</h2>
            <span aria-hidden="true" />
          </div>
        </header>

        <section className="lvr-summary-grid" aria-label="Search and market">
          <div className="lvr-info-card">
            <span className="lvr-icon-circle" aria-hidden="true"><FiSearch /></span>
            <div>
              <span className="lvr-label">Search</span>
              <strong>{data.searchPhrase || "Search phrase"}</strong>
            </div>
          </div>
          <div className="lvr-info-card">
            <span className="lvr-icon-circle" aria-hidden="true"><FiMapPin /></span>
            <div>
              <span className="lvr-label">Market</span>
              <strong>{data.market || "Market"}</strong>
            </div>
          </div>
        </section>

        <section className="lvr-business-card" aria-label="Business summary">
          <span className="lvr-business-icon" aria-hidden="true"><FiHome /></span>
          <div className="lvr-business-copy">
            <h3>{data.businessName || "Business name"}</h3>
            {data.address && <p>{data.address}</p>}
            <Rating rating={data.rating} reviewCount={data.reviewCount} />
          </div>
          <div className="lvr-business-arp" aria-label="Average Google Maps Position">
            <span>Average Google Maps Position</span>
            <strong>{data.averagePosition || "—"}</strong>
          </div>
        </section>

        <figure
          className={`lvr-heatmap-card${data.heatmapImageUrl && onMapPositionChange ? " lvr-heatmap-draggable" : ""}${isDraggingMap ? " is-dragging" : ""}`}
          aria-label={data.heatmapImageUrl ? "Ranking heatmap. Drag to reposition the map." : "Ranking heatmap"}
          onPointerDown={handleMapPointerDown}
          onPointerMove={handleMapPointerMove}
          onPointerUp={stopMapDrag}
          onPointerCancel={stopMapDrag}
          data-testid="report-heatmap"
        >
          {data.heatmapImageUrl ? (
            <img
              src={data.heatmapImageUrl}
              alt="Uploaded Local Falcon ranking heatmap"
              data-crop-mode="cover-center"
              draggable={false}
              style={{
                transform: `translate(${mapPosition.x}px, ${mapPosition.y}px) scale(${Math.max(70, Math.min(160, mapZoom)) / 100})`,
              }}
            />
          ) : (
            <div className="lvr-heatmap-empty">
              <FiImage aria-hidden="true" />
              <strong>Heatmap preview</strong>
              <span>Upload a Local Falcon image</span>
            </div>
          )}
        </figure>

        <section className="lvr-explanation" aria-label="How to read the scan">
          <div className="lvr-explanation-row">
            <span className="lvr-explanation-icon" aria-hidden="true"><FiCrosshair /></span>
            <p>
              <strong>The center dot marks your business.</strong>
              <span>The surrounding dots show how you rank in nearby areas.</span>
            </p>
          </div>
          <div className="lvr-explanation-row">
            <span className="lvr-explanation-icon" aria-hidden="true"><FiBarChart2 /></span>
            <p>
              <strong>Each number is your Google Maps position from that location.</strong>
              <span><b>20+</b> means you did not appear in the top 20.</span>
            </p>
          </div>
        </section>

        <section className="lvr-settings" aria-label="Scan settings">
          <FiCrosshair aria-hidden="true" />
          <span>{formatScanSettings(data)}</span>
        </section>
      </div>

      <footer className="lvr-footer">
        <img
          src="/img/logo-report-footer-mark-20260721-v2.svg?v=20260721-v2"
          alt="Viva Web Designs"
          width="1213"
          height="303"
        />
        <span aria-hidden="true" />
        <p>
          Prepared by <strong>Viva Web Designs</strong>
          <b aria-hidden="true">·</b>
          <strong>vivawebdesigns.com</strong>
        </p>
      </footer>
    </div>
  );
});

export default LocalVisibilityReportTemplate;
