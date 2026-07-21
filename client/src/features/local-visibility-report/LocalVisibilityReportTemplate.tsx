import { forwardRef } from "react";
import {
  FiBarChart2,
  FiCrosshair,
  FiHome,
  FiImage,
  FiInfo,
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
};

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
  { data, mapZoom = 100 },
  ref,
) {
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
        </section>

        <figure className="lvr-heatmap-card">
          {data.heatmapImageUrl ? (
            <img
              src={data.heatmapImageUrl}
              alt="Uploaded Local Falcon ranking heatmap"
              data-crop-mode="cover-center"
              style={{ transform: `scale(${Math.max(100, Math.min(160, mapZoom)) / 100})` }}
            />
          ) : (
            <div className="lvr-heatmap-empty">
              <FiImage aria-hidden="true" />
              <strong>Heatmap preview</strong>
              <span>Upload a Local Falcon image</span>
            </div>
          )}
        </figure>

        <section className="lvr-metric-card" aria-label="Average Google Maps Position">
          <span className="lvr-metric-icon" aria-hidden="true"><FiBarChart2 /></span>
          <div>
            <span className="lvr-label">Average Google Maps Position</span>
            <strong>{data.averagePosition || "—"}</strong>
          </div>
        </section>

        <section className="lvr-explanation" aria-label="How to read the scan">
          <FiInfo aria-hidden="true" />
          <div>
            <p>Each number shows your Google Maps position when searching from that location.</p>
            <p>20+ means your business did not appear in the top 20.</p>
            <p>The center dot is your business location. The surrounding dots show how you rank in nearby areas.</p>
          </div>
        </section>

        <section className="lvr-settings" aria-label="Scan settings">
          <FiCrosshair aria-hidden="true" />
          <span>{formatScanSettings(data)}</span>
        </section>
      </div>

      <footer className="lvr-footer">
        <img
          src="/img/logo-footer-mark-20260721.svg?v=20260721"
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
