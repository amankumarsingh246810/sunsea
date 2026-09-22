
// api/leave-request.js
// Vercel Serverless Function - Node.js

const leaveRequests = [];

/**
 * Validate a date in YYYY-MM-DD format.
 *
 * Returns a Date object if valid, otherwise null.
 */
function parseDateOnly(value) {
  if (typeof value !== "string") {
    return null;
  }

  // Only allow YYYY-MM-DD
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  // Basic validation
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  // Create date using UTC to avoid timezone issues.
  const date = new Date(Date.UTC(year, month - 1, day));

  // JavaScript normalizes invalid dates.
  // Example: 2026-02-30 becomes a date in March.
  // Compare all components to make sure the original date was valid.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

export default function handler(req, res) {
  try {
    // =========================================================
    // POST /api/leave-request
    // =========================================================
    if (req.method === "POST") {
      // Make sure the request body exists and is an object.
      if (
        req.body === undefined ||
        req.body === null ||
        typeof req.body !== "object" ||
        Array.isArray(req.body)
      ) {
        return res.status(400).json({
          error: "Request body must be a valid JSON object.",
        });
      }

      const {
        employeeId,
        startDate,
        endDate,
        reason,
      } = req.body;

      // -------------------------------------------------------
      // Validate startDate
      // -------------------------------------------------------
      if (!startDate) {
        return res.status(400).json({
          error: "startDate is required.",
        });
      }

      const parsedStartDate = parseDateOnly(startDate);

      if (!parsedStartDate) {
        return res.status(400).json({
          error: "startDate must be a valid date in YYYY-MM-DD format.",
        });
      }

      // -------------------------------------------------------
      // Validate endDate
      // -------------------------------------------------------
      if (!endDate) {
        return res.status(400).json({
          error: "endDate is required.",
        });
      }

      const parsedEndDate = parseDateOnly(endDate);

      if (!parsedEndDate) {
        return res.status(400).json({
          error: "endDate must be a valid date in YYYY-MM-DD format.",
        });
      }

      // -------------------------------------------------------
      // Make sure endDate is not before startDate
      // -------------------------------------------------------
      if (parsedEndDate < parsedStartDate) {
        return res.status(400).json({
          error: "endDate cannot be before startDate.",
        });
      }

      // -------------------------------------------------------
      // Create leave request
      // -------------------------------------------------------
      const request = {
        id: leaveRequests.length + 1,
        employeeId,
        startDate,
        endDate,
        reason,
        status: "pending",
        createdAt: new Date().toISOString(),
      };

      leaveRequests.push(request);

      return res.status(201).json(request);
    }

    // =========================================================
    // GET /api/leave-request
    // GET /api/leave-request?status=pending
    // =========================================================
    if (req.method === "GET") {
      const status = req.query?.status;

      // No status filter -> return all requests
      if (status === undefined) {
        return res.status(200).json(leaveRequests);
      }

      // Status filter -> return only matching requests
      const filteredRequests = leaveRequests.filter(
        (request) => request.status === status
      );

      return res.status(200).json(filteredRequests);
    }

    // =========================================================
    // Unsupported HTTP methods
    // =========================================================
    res.setHeader("Allow", ["GET", "POST"]);

    return res.status(405).json({
      error: `Method ${req.method} Not Allowed`,
    });
  } catch (error) {
    // =========================================================
    // Unexpected server error
    // =========================================================
    console.error("Leave request handler error:", error);

    return res.status(500).json({
      error: "Internal server error.",
    });
  }
}

