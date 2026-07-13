

## Fix: "Doctor not found" and Missing Appointment History

### Root Cause

The `doctors`, `hospitals`, and `appointments` tables have **no table-level SELECT privileges** granted to the `anon` or `authenticated` database roles. 

- RLS policies exist and are correct, but they are meaningless without the underlying table grants.
- The search works because `search_doctors()` is a `SECURITY DEFINER` function (runs as the table owner, bypassing grants).
- Direct queries like `.from("doctors").select(...).eq("id", id)` return empty results because the roles lack SELECT permission on the table.

### Fix

Run a single database migration to:

1. **Grant SELECT on `doctors`** to both `anon` and `authenticated` -- but **revoke SELECT on the `email` column** to keep doctor emails private.
2. **Grant SELECT on `hospitals`** to both `anon` and `authenticated` -- hospitals are public data.
3. **Grant SELECT on `appointments`** to `authenticated` only -- appointment data is personal; RLS policies already restrict it to the owning patient or assigned doctor.

### Technical Details

```text
Migration SQL:

-- 1. Doctors: allow public reads, hide email
GRANT SELECT ON public.doctors TO anon, authenticated;
REVOKE SELECT (email) ON public.doctors FROM anon, authenticated;

-- 2. Hospitals: allow public reads
GRANT SELECT ON public.hospitals TO anon, authenticated;

-- 3. Appointments: allow authenticated reads (RLS handles row filtering)
GRANT SELECT ON public.appointments TO authenticated;
```

No frontend code changes are needed. The existing `useDoctorById` hook, `DoctorDetail` page, and `useAppointments` hook will start working immediately once the grants are in place.

### What This Fixes

- **Doctor detail page**: Will load doctor data correctly for all users (logged in or not).
- **Appointment history**: Upcoming, Past, and Cancelled tabs will display the logged-in user's appointments.
- **Hospital detail page**: Will also work correctly if it had the same issue.

