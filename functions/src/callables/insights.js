"use strict";

const logger = require("firebase-functions/logger");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { requireAdmin } = require("../callables/users");

// ── Callable: App Insights — Brevo email delivery stats ───────────────────────
exports.getEmailStats = onCall(
  { secrets: ["BREVO_API_KEY"] },
  async (request) => {
    await requireAdmin(request.auth?.uid);

    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
      throw new HttpsError("failed-precondition", "Brevo API key is not configured.");
    }

    const { days = 30 } = request.data || {};
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 86400000);
    const fmt = (d) => d.toISOString().slice(0, 10);

    try {
      const res = await fetch(
        `https://api.brevo.com/v3/smtp/statistics/aggregatedReport?startDate=${fmt(startDate)}&endDate=${fmt(endDate)}`,
        { headers: { "api-key": apiKey } },
      );
      if (!res.ok) {
        const body = await res.text();
        throw new HttpsError("internal", `Brevo API error ${res.status}: ${body}`);
      }
      const data = await res.json();
      return {
        requests: data.requests || 0,
        delivered: data.delivered || 0,
        hardBounces: data.hardBounces || 0,
        softBounces: data.softBounces || 0,
        blocked: data.blocked || 0,
        opens: data.opens || 0,
        uniqueOpens: data.uniqueOpens || 0,
        clicks: data.clicks || 0,
        spamReports: data.spamReports || 0,
        rangeDays: days,
      };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      throw new HttpsError("internal", err.message);
    }
  },
);

// ── Callable: App Insights — Storage usage by folder ──────────────────────────
const STORAGE_FOLDERS = [
  "payment-proofs",
  "registration-form-uploads",
  "medical-cert-uploads",
  "registration-form-templates",
  "medical-cert-samples",
  "gcash-qr",
  "trail-images",
];

exports.getStorageUsage = onCall(async (request) => {
  await requireAdmin(request.auth?.uid);

  try {
    const { getStorage } = require("firebase-admin/storage");
    const bucket = getStorage().bucket();
    const results = await Promise.all(
      STORAGE_FOLDERS.map(async (prefix) => {
        const [files] = await bucket.getFiles({ prefix: `${prefix}/` });
        const bytes = files.reduce(
          (sum, f) => sum + Number(f.metadata.size || 0),
          0,
        );
        return { folder: prefix, fileCount: files.length, bytes };
      }),
    );
    const totalBytes = results.reduce((s, r) => s + r.bytes, 0);
    const totalFiles = results.reduce((s, r) => s + r.fileCount, 0);
    return { folders: results, totalBytes, totalFiles };
  } catch (err) {
    throw new HttpsError("internal", err.message);
  }
});

// ── Callable: App Insights — Cloud Functions health (best-effort) ─────────────
// Requires the runtime service account to have the "Monitoring Viewer"
// (roles/monitoring.viewer) IAM role. Without it, this returns a clear
// "not configured" result instead of failing the whole insights page.
exports.getFunctionHealth = onCall(async (request) => {
  await requireAdmin(request.auth?.uid);

  try {
    const { MetricServiceClient } = require("@google-cloud/monitoring");
    const client = new MetricServiceClient();
    const projectId = await client.getProjectId();
    const projectPath = client.projectPath(projectId);

    const now = Math.floor(Date.now() / 1000);
    const dayAgo = now - 24 * 3600;

    async function sumMetric(metricType) {
      const [timeSeries] = await client.listTimeSeries({
        name: projectPath,
        filter: `metric.type = "${metricType}"`,
        interval: {
          startTime: { seconds: dayAgo },
          endTime: { seconds: now },
        },
        view: "FULL",
      });
      let total = 0;
      for (const series of timeSeries) {
        for (const point of series.points || []) {
          total += Number(point.value?.int64Value || point.value?.doubleValue || 0);
        }
      }
      return total;
    }

    const [executionCount, errorCount] = await Promise.all([
      sumMetric("cloudfunctions.googleapis.com/function/execution_count"),
      sumMetric("cloudfunctions.googleapis.com/function/user_memory_bytes").catch(() => 0),
    ]);

    return {
      configured: true,
      windowHours: 24,
      executionCount,
      errorCount,
    };
  } catch (err) {
    logger.warn("[getFunctionHealth] Not available", { err: err.message });
    return {
      configured: false,
      reason:
        "Cloud Monitoring is not accessible from this function yet. Grant the runtime service account the \"Monitoring Viewer\" role in IAM, then retry.",
    };
  }
});

// ── Callable: App Insights — real GCP billing cost (best-effort) ──────────────
// There is no general "get my current spend" REST API — Google's supported
// mechanism is exporting detailed billing data to a BigQuery dataset, which
// this then queries. Requires one-time setup that only a project/billing
// admin can do (this function cannot enable APIs or grant IAM roles itself):
//   1. Enable BigQuery export in the Cloud Billing Console (Billing >
//      Billing export > Detailed usage cost) into a dataset in this project.
//   2. Set the BILLING_EXPORT_TABLE env var (functions/.env) to the fully
//      qualified table, e.g.
//      "project.dataset.gcp_billing_export_v1_XXXXXX_XXXXXX_XXXXXX".
//   3. Grant the Cloud Functions runtime service account the
//      "BigQuery Data Viewer" and "BigQuery Job User" roles.
// Without that, this returns a clear "not configured" result instead of
// failing the whole insights page.
exports.getBillingCost = onCall(async (request) => {
  await requireAdmin(request.auth?.uid);

  const table = process.env.BILLING_EXPORT_TABLE;
  if (!table) {
    return {
      configured: false,
      reason:
        "No billing export table configured. Set BILLING_EXPORT_TABLE (functions/.env) to your BigQuery billing export table after enabling detailed usage cost export in the Cloud Billing Console.",
    };
  }

  try {
    const { BigQuery } = require("@google-cloud/bigquery");
    const bigquery = new BigQuery();
    const [rows] = await bigquery.query({
      query: `
        SELECT
          service.description AS service,
          SUM(cost) + SUM(IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) c), 0)) AS cost
        FROM \`${table}\`
        WHERE invoice.month = FORMAT_DATE('%Y%m', CURRENT_DATE())
        GROUP BY service
        HAVING cost > 0
        ORDER BY cost DESC
      `,
    });

    const byService = rows.map((r) => ({
      service: r.service,
      cost: Number(r.cost || 0),
    }));
    const totalCost = byService.reduce((sum, r) => sum + r.cost, 0);

    return {
      configured: true,
      currency: "USD",
      month: new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long" }),
      totalCost,
      byService,
    };
  } catch (err) {
    logger.warn("[getBillingCost] Not available", { err: err.message });
    return {
      configured: false,
      reason:
        "Could not query the billing export table. Confirm BILLING_EXPORT_TABLE is correct and the runtime service account has BigQuery Data Viewer + Job User roles.",
    };
  }
});
