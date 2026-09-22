# Leave Request API — Changes and Improvements

## Overview

The `api/leave-request.js` file was updated to make the leave request API safer and more robust.

The following improvements were implemented:

1. Date validation
2. Request body validation
3. Unexpected error handling
4. Status-based filtering for GET requests
5. HTTP 405 handling for unsupported methods
6. Safer response flow

---

# 1. Date Validation

## Problem

The original endpoint accepted any value for `startDate` and `endDate`.

For example, invalid dates such as:

```text
2026-02-30
```

could be accepted.

It also did not check whether the end date occurred before the start date.

---

## Solution

A helper function named `parseDateOnly()` was added:

```javascript
function parseDateOnly(value) {
  if (typeof value !== "string") {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}
```

This validates both the format and the actual calendar date.

### Valid example

```text
2026-09-25
```

### Invalid examples

```text
2026-02-30
25-09-2026
2026/09/25
hello
```

---

# 2. Required `startDate`

The endpoint now checks whether `startDate` was provided.

```javascript
if (!startDate) {
  return res.status(400).json({
    error: "startDate is required.",
  });
}
```

If it is missing, the API returns HTTP `400`.

Example response:

```json
{
  "error": "startDate is required."
}
```

---

# 3. Required `endDate`

The same validation is applied to `endDate`.

```javascript
if (!endDate) {
  return res.status(400).json({
    error: "endDate is required.",
  });
}
```

Example response:

```json
{
  "error": "endDate is required."
}
```

---

# 4. Validate Date Order

The API now ensures that the end date is not earlier than the start date.

```javascript
if (parsedEndDate < parsedStartDate) {
  return res.status(400).json({
    error: "endDate cannot be before startDate.",
  });
}
```

For example:

```text
startDate = 2026-09-28
endDate   = 2026-09-25
```

will be rejected.

Response:

```json
{
  "error": "endDate cannot be before startDate."
}
```

HTTP status:

```text
400 Bad Request
```

---

# 5. Request Body Validation

The original implementation assumed that `req.body` would always exist.

The updated implementation checks it first:

```javascript
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
```

This prevents the handler from trying to destructure an invalid body.

For example, a missing or invalid body now results in:

```json
{
  "error": "Request body must be a valid JSON object."
}
```

with HTTP `400`.

---

# 6. Unexpected Error Handling

The entire request handler is wrapped in a `try/catch` block:

```javascript
try {
  // API logic
} catch (error) {
  console.error("Leave request handler error:", error);

  return res.status(500).json({
    error: "Internal server error.",
  });
}
```

This provides a clean JSON response if an unexpected server-side error occurs.

The client receives:

```json
{
  "error": "Internal server error."
}
```

with HTTP status:

```text
500 Internal Server Error
```

The actual error is logged on the server for debugging:

```javascript
console.error("Leave request handler error:", error);
```

---

# 7. Status Filtering

The GET endpoint was extended to support a `status` query parameter.

## Before

```http
GET /api/leave-request
```

returned all leave requests.

## After

The API still supports:

```http
GET /api/leave-request
```

which returns all requests.

It now also supports:

```http
GET /api/leave-request?status=pending
```

which returns only pending requests.

The implementation is:

```javascript
const status = req.query?.status;

if (status === undefined) {
  return res.status(200).json(leaveRequests);
}

const filteredRequests = leaveRequests.filter(
  (request) => request.status === status
);

return res.status(200).json(filteredRequests);
```

Other statuses can also be queried:

```http
GET /api/leave-request?status=approved
```

```http
GET /api/leave-request?status=rejected
```

The filtering is case-sensitive.

For example:

```text
pending
```

and:

```text
Pending
```

are treated as different values.

---

# 8. HTTP 405 Method Handling

The API supports two methods:

```text
GET
POST
```

Other HTTP methods are rejected.

The implementation is:

```javascript
res.setHeader("Allow", ["GET", "POST"]);

return res.status(405).json({
  error: `Method ${req.method} Not Allowed`,
});
```

For example:

```http
DELETE /api/leave-request
```

returns:

```json
{
  "error": "Method DELETE Not Allowed"
}
```

with HTTP status:

```text
405 Method Not Allowed
```

The response also contains:

```http
Allow: GET, POST
```

This tells the client which methods are supported.

---

# 9. Added `return` to Responses

The updated code consistently uses:

```javascript
return res.status(...).json(...);
```

instead of only:

```javascript
res.status(...).json(...);
```

This makes sure that once a response is sent, the handler stops executing that branch.

For example:

```javascript
if (req.method === "POST") {
  // ...

  return res.status(201).json(request);
}
```

This makes the control flow clearer and reduces the possibility of accidentally sending multiple responses.

---

# 10. API Behavior Summary

| Request                                   | Result                      |
| ----------------------------------------- | --------------------------- |
| `POST /api/leave-request` with valid data | `201 Created`               |
| Missing `startDate`                       | `400 Bad Request`           |
| Invalid `startDate`                       | `400 Bad Request`           |
| Missing `endDate`                         | `400 Bad Request`           |
| Invalid `endDate`                         | `400 Bad Request`           |
| `endDate < startDate`                     | `400 Bad Request`           |
| Invalid request body                      | `400 Bad Request`           |
| Unexpected server error                   | `500 Internal Server Error` |
| `GET /api/leave-request`                  | All requests                |
| `GET /api/leave-request?status=pending`   | Pending requests            |
| `GET /api/leave-request?status=approved`  | Approved requests           |
| Unsupported HTTP method                   | `405 Method Not Allowed`    |

---

# 11. Example POST Request

```http
POST /api/leave-request
Content-Type: application/json
```

Request body:

```json
{
  "employeeId": "EMP001",
  "startDate": "2026-09-25",
  "endDate": "2026-09-28",
  "reason": "Personal leave"
}
```

Successful response:

```json
{
  "id": 1,
  "employeeId": "EMP001",
  "startDate": "2026-09-25",
  "endDate": "2026-09-28",
  "reason": "Personal leave",
  "status": "pending",
  "createdAt": "2026-09-22T..."
}
```

HTTP status:

```text
201 Created
```

---

# 12. Example GET Requests

### Get all requests

```http
GET /api/leave-request
```

### Get pending requests

```http
GET /api/leave-request?status=pending
```

### Get approved requests

```http
GET /api/leave-request?status=approved
```

---

# 13. Important Note About Storage

The exercise uses:

```javascript
const leaveRequests = [];
```

This is an in-memory array.

It is acceptable for this exercise, but it is not persistent storage.

In a real Vercel serverless application, this data can disappear between function invocations or deployments.

A production application should store leave requests in a persistent database such as PostgreSQL, MongoDB, or another managed database.

---

# Final Result

The endpoint is now:

* More defensive against malformed input
* Safer when handling unexpected errors
* Strict about date validation
* Capable of filtering requests by status
* Correctly handling unsupported HTTP methods
* More predictable in its response flow

The main API contract remains unchanged for valid POST and unfiltered GET requests.




