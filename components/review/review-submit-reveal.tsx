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
}: {
  venueName: string;
  bucket: ReviewBucket;
  finalRank: number;
  bucketSize: number;
  listChanged?: boolean;
  backHref: string;
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
        style={{ textAlign: "center", maxWidth: 440 }}
      >
        <div style={{ ...MONO, color: "oklch(0.75 0.11 44)", marginBottom: 14 }}>
          Logged
        </div>
        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(28px,4vw,40px)",
            fontWeight: 400,
            color: "hsl(60 9.1% 97.8%)",
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
            marginBottom: 18,
          }}
        >
          {venueName} lands at{" "}
          <motion.span
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.25, duration: 0.4, ease: "easeOut" }}
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
              marginBottom: 20,
            }}
          >
            Your list changed during ranking — placement may need adjustment.
          </p>
        ) : null}

        <Link
          href={backHref}
          style={{
            ...MONO,
            display: "inline-block",
            height: 40,
            padding: "12px 24px",
            background: "transparent",
            color: "hsl(60 9.1% 97.8%)",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 2,
            textDecoration: "none",
          }}
        >
          Done
        </Link>
      </motion.div>
    </div>
  );
}
