import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const AUTOCOUNT_API_URL =
  "https://payroll.autocountcloud.com/OpenAPILeave/GetLeaveTransactionList?CompanyId=XX51DTWxYwf2IB1rUIi1U7csyyvQcRb0ccaeGcWbjfnzzNMehxSqwz8z%2BpTfNVew";
const AUTOCOUNT_TOKEN = "2HMQNPB7KFYO+2YFJNLGVZHRPWGDQQZHWGNDRCUUAWW=";

interface AutoCountLeave {
  EmployeeCode: string;
  LeaveTypeCode: string;
  LeaveTransId: string;
  LeaveDate: string;
  ApplyReason: string;
  ApplyStatus: string;
  Days: string;
  Attachment: string;
}

/**
 * POST /api/sync-medical-leave
 *
 * Pulls leave transactions from AutoCount API, filters for SL (Sick Leave),
 * and upserts into the MedicalLeave table.
 *
 * Also backfills from existing LeaveTransaction table if ?seedFromLocal=true
 */
export async function POST(req: Request) {
  const client = await pool.connect();
  const { searchParams } = new URL(req.url);
  const seedFromLocal = searchParams.get("seedFromLocal") === "true";

  try {
    let insertedFromApi = 0;
    let insertedFromLocal = 0;

    // --- 1. Pull from AutoCount API ---
    try {
      const res = await fetch(AUTOCOUNT_API_URL, {
        method: "GET",
        headers: {
          accept: "application/json",
          TokenId: AUTOCOUNT_TOKEN,
        },
      });
      const json = await res.json();

      if (json.Success && Array.isArray(json.Data) && json.Data.length > 0) {
        const slRecords = json.Data.filter(
          (r: AutoCountLeave) => r.LeaveTypeCode === "SL"
        );

        for (const r of slRecords) {
          const leaveDate = new Date(r.LeaveDate);
          await client.query(
            `INSERT INTO "MedicalLeave" ("employeeCode", "leaveDate", "reason", "status", "days", "leaveTransId", "attachment")
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT ("leaveTransId") DO UPDATE SET
               "reason" = EXCLUDED."reason",
               "status" = EXCLUDED."status",
               "days" = EXCLUDED."days",
               "attachment" = EXCLUDED."attachment"`,
            [
              r.EmployeeCode,
              leaveDate.toISOString().split("T")[0],
              (r.ApplyReason || "").replace(/\r\n|\r|\n/g, " ").trim(),
              r.ApplyStatus,
              r.Days,
              r.LeaveTransId,
              r.Attachment || null,
            ]
          );
          insertedFromApi++;
        }
      }
    } catch (apiErr: any) {
      console.error("AutoCount API fetch error:", apiErr.message);
    }

    // --- 2. Backfill from existing LeaveTransaction table ---
    if (seedFromLocal) {
      const localRes = await client.query(
        `SELECT "EmployeeCode", "LeaveDate", "ApplyReason", "ApplyStatus", "Days", "LeaveTransId", "Attachment"
         FROM "LeaveTransaction"
         WHERE "LeaveTypeCode" = 'SL'
         ORDER BY "LeaveDate" DESC`
      );

      for (const r of localRes.rows) {
        const leaveDate = r.LeaveDate
          ? new Date(r.LeaveDate).toISOString().split("T")[0]
          : null;
        const transId = r.LeaveTransId || `local-${r.EmployeeCode}-${leaveDate}`;

        await client.query(
          `INSERT INTO "MedicalLeave" ("employeeCode", "leaveDate", "reason", "status", "days", "leaveTransId", "attachment")
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT ("leaveTransId") DO NOTHING`,
          [
            r.EmployeeCode,
            leaveDate,
            (r.ApplyReason || "").replace(/\r\n|\r|\n/g, " ").trim(),
            r.ApplyStatus,
            r.Days,
            transId,
            r.Attachment || null,
          ]
        );
        insertedFromLocal++;
      }
    }

    return NextResponse.json({
      success: true,
      insertedFromApi,
      insertedFromLocal,
    });
  } catch (err: any) {
    console.error("Sync medical leave error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}
