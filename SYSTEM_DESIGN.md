# System Design Write-Up: Healthcare Appointment & Follow-up Manager

## 1. Double-Booking Prevention Mechanism

Preventing double-booking in a concurrent environment requires multi-layered defensive strategies at both the application and database tiers.

### Database Unique Constraint
The primary enforcement boundary is a database-level unique composite index on `(doctorId, slotStartTime)` in the `Appointment` table:
```prisma
@@unique([doctorId, slotStartTime])
```
If two simultaneous HTTP requests attempt to write an appointment record for the same doctor at the exact same start time, database engine engine isolation guarantees that only one transaction succeeds. The secondary transaction immediately fails with a unique constraint violation error (`P2002` in Prisma).

### Atomic Transactional Row Checking
Before executing the insert, the application runs a transactional check (`prisma.$transaction`) verifying that no existing appointment exists with status `BOOKED`, `HELD`, or `COMPLETED`. In PostgreSQL production deployments, explicit row-level locking (`SELECT ... FOR UPDATE`) is applied to doctor availability blocks during transaction execution.

### Loser Graceful Handling
When a concurrent booking request loses the race condition:
1. The transaction rolls back cleanly without dirty reads.
2. The loser receives an HTTP 409 Conflict status with the explicit payload: `"Slot no longer available — another request completed first."`
3. The frontend automatically re-queries `/api/patient/slots` to display refreshed availability.

---

## 2. Doctor Leave Conflict Handling

When an admin or doctor declares leave for specific date ranges, existing patient appointments falling on those dates must be resolved cleanly without data corruption or missed notifications.

### Workflow & Isolation Steps:
1. **Leave Persistence**: A new `DoctorLeave` record is created for `(doctorId, startDate, endDate)`.
2. **Conflict Identification**: The system executes a query for all `BOOKED` appointments where `slotStartTime` falls within the leave date range (`startDate 00:00:00` to `endDate 23:59:59`).
3. **Status Transition**: Affected appointments are transitioned from `BOOKED` to `NEEDS_RESCHEDULE`.
4. **Google Calendar Cleanup**: For each affected appointment with a linked `gcalEventId`, an asynchronous deletion call is dispatched to the Google Calendar API.
5. **Alternative Slot Recommendation**: The slot engine automatically calculates the next three available slots for the same doctor or specialisation.
6. **Patient Notification Dispatch**: An automated cancellation email is queued for each affected patient, containing:
   - Reason for leave
   - Notice of cancellation
   - Clickable links to suggested alternate slots

---

## 3. Slot Hold Mechanism (TTL & Release Triggers)

To prevent race conditions where a patient fills out a multi-field symptom form only to find the slot grabbed mid-checkout, the platform implements short-lived temporary slot holds.

### Hold Lifecycle & TTL
1. **Acquisition**: When a patient clicks an available time slot, a `SlotHold` record is inserted into the database with a 3-minute Time-to-Live (`expiresAt = now() + 3 minutes`).
2. **Exclusivity**: Subsequent queries to `/api/patient/slots` filter out active holds (`expiresAt > now()`), displaying the slot as unavailable to all other users while keeping it active for the holding patient (`heldByMe = true`).
3. **Release Triggers**:
   - **Successful Booking**: Upon appointment confirmation, the `SlotHold` is immediately deleted within the same database transaction.
   - **Explicit Cancellation**: If the patient closes the symptom modal or navigates away, the hold is removed.
   - **TTL Expiration**: If the 3-minute timer expires, background cleanup queries and slot availability calculations filter out the expired record, automatically returning the slot to the public pool.

---

## 4. Notification Failure Handling (Retries & Admin Audit Logs)

Reliable delivery of appointment confirmations and dose reminders is guaranteed via asynchronous job processing with exponential backoff retries.

### Background Queue Architecture
1. **Dispatch**: Email requests are registered in the `NotificationLog` table with initial status `PENDING`.
2. **Exponential Backoff Retries**: If the SMTP provider experiences connection drops or rate limits, the job retries up to 3 times with exponential delays ($500\text{ms} \times 2^{\text{attempt}-1}$):
   - Attempt 1: Immediate retry after $500\text{ms}$
   - Attempt 2: Retry after $1000\text{ms}$
   - Attempt 3: Retry after $2000\text{ms}$
3. **Dead-Letter Audit Trail**: If all 3 attempts fail, the notification status is updated to `FAILED`, the exact error stack is recorded in `errorLog`, and the entry is flagged in the Admin Dashboard (`/api/admin/logs`). Admins can inspect failed notifications and trigger manual re-delivery without affecting core application transactions.
