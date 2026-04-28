"use client";

import { motion } from "framer-motion";
import Link from "next/link";

import type { ReviewBucket } from "@/lib/types";

const MONO: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
};

const BUCKET_LABEL: Record<ReviewBucket, string> = {
  pilgrimage: "PILGRIMAGES",
  detour: "DETOURS",
  convenience: "CONVENIENCE STOPS",
};

export function ReviewSubmitReveal({
  venueName,
  bucket,
  finalRank,
  bucketSize,
  listChanged,
  backHref,
  handle,
}: {
  venueName: string;
  bucket: ReviewBucket;
  finalRank: number;
  bucketSize: number;
  listChanged?: boolean;
  backHref: string;
  handle?: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        gap: 24,
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        // Composition is intentionally OG-card-friendly: aspect ratio close
        // to 1.91:1, the headline reads cleanly cropped to ~1200×630, and
        // the Coffeesnob brand mark sits at the bottom. The
        // share-card-image generation lands in a separate PR; this layout
        // is the source for that downstream work.
        style={{
          maxWidth: 640,
          width: "100%",
          padding: "32px 36px",
          borderRadius: 4,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.02)",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div
          style={{
            ...MONO,
            color: "oklch(0.75 0.11 44)",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>Logged</span>
          {handle ? <span>@{handle}</span> : null}
        </div>

        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(30px,5vw,46px)",
            fontWeight: 400,
            color: "hsl(60 9.1% 97.8%)",
            letterSpacing: "-0.02em",
            lineHeight: 1.05,
          }}
        >
          {venueName} lands at{" "}
          <motion.span
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              delay: 0.2,
              type: "spring",
              stiffness: 220,
              damping: 18,
            }}
            style={{ color: "oklch(0.75 0.11 44)", display: "inline-block" }}
          >
            #{finalRank}
          </motion.span>{" "}
          of {bucketSize} {BUCKET_LABEL[bucket].toLowerCase()}
        </h2>

        {listChanged ? (
          <p
            style={{
              fontSize: 13,
              color: "hsl(40 50% 70%)",
              lineHeight: 1.6,
            }}
          >
            Your list changed during ranking — placement may need adjustment.
          </p>
        ) : null}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 8,
            paddingTop: 18,
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <span
            style={{
              ...MONO,
              fontSize: 9,
              color: "hsl(24 5.4% 50%)",
            }}
          >
            COFFEESNOB
          </span>
          <Link
            href={backHref}
            style={{
              ...MONO,
              display: "inline-block",
              padding: "10px 22px",
              background: "transparent",
              color: "hsl(60 9.1% 97.8%)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 2,
              textDecoration: "none",
            }}
          >
            Done
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
