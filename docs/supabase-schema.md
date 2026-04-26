# Supabase Schema Plan

This file prepares the backend shape for the prototype.

Current status:
- The app still uses `localStorage` only.
- No Supabase client, dependency, or runtime connection is added yet.
- This schema is for the next integration step.

## Goals

The schema should support:
- Station master data
- Time-based fuel reports
- User accounts later
- User location attached to reports
- Confidence scoring later
- Recomputing station state from recent reports

## Suggested Extensions

```sql
create extension if not exists pgcrypto;
create extension if not exists postgis;
```

Notes:
- `pgcrypto` is for UUID generation.
- `postgis` is optional, but useful later if you want proximity queries directly in SQL.

## Table: stations

Purpose:
- Store known fuel stations in Tripoli and later other cities.

```sql
create table public.stations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  latitude double precision not null,
  longitude double precision not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Suggested indexes:

```sql
create index stations_is_active_idx on public.stations (is_active);
create index stations_name_idx on public.stations (name);
```

Future optional fields:
- `city`
- `district`
- `source`
- `geom geography(point, 4326)` if PostGIS is enabled

## Table: reports

Purpose:
- Store submitted station reports.
- This is the main event table used to rebuild current station status from the last 60 minutes.

```sql
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references public.stations(id) on delete cascade,
  user_id uuid null,
  fuel_status text not null check (fuel_status in ('available', 'no_fuel')),
  queue_level text not null check (queue_level in ('short', 'medium', 'long')),
  reported_at timestamptz not null default now(),
  station_latitude double precision not null,
  station_longitude double precision not null,
  user_latitude double precision null,
  user_longitude double precision null,
  distance_to_station_meters integer null,
  confidence_score numeric(4,3) null,
  source text not null default 'mobile',
  created_at timestamptz not null default now()
);
```

Why these fields exist:
- `station_id`: links the report to a known station.
- `fuel_status`: fuel availability signal.
- `queue_level`: queue/crowding signal.
- `reported_at`: the timestamp used for the 60-minute window.
- `station_latitude` / `station_longitude`: keeps the station location snapshot at reporting time.
- `user_latitude` / `user_longitude`: stores the reporting user location.
- `distance_to_station_meters`: supports the current 200m validation rule and later audit tools.
- `confidence_score`: reserved for future quality scoring.

Suggested indexes:

```sql
create index reports_station_id_idx on public.reports (station_id);
create index reports_reported_at_idx on public.reports (reported_at desc);
create index reports_station_time_idx on public.reports (station_id, reported_at desc);
create index reports_user_id_idx on public.reports (user_id);
```

Cleanup note:
- The app currently ignores reports older than 60 minutes.
- In Supabase later, you can either:
  - keep historical rows and filter by `reported_at >= now() - interval '60 minutes'`, or
  - archive/prune old rows in a scheduled job.
- For analytics, keeping history is usually better.

## Table: users

Purpose:
- Reserved for later auth, moderation, reputation, and confidence features.

```sql
create table public.users (
  id uuid primary key,
  display_name text null,
  is_moderator boolean not null default false,
  reputation_score numeric(6,2) null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Notes:
- This table can later mirror `auth.users`.
- `reports.user_id` should reference `public.users(id)` once auth is added.

## Table: station_presence

Purpose:
- Store anonymous device heartbeats near stations.
- This is a passive activity signal and does not identify the person.
- It helps estimate whether a station is currently active even when users do not submit manual reports.

```sql
create table public.station_presence (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references public.stations(id) on delete cascade,
  device_id text not null,
  latitude double precision not null,
  longitude double precision not null,
  distance_to_station_meters integer not null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (station_id, device_id)
);
```

Why these fields exist:
- `station_id`: links the heartbeat to one station.
- `device_id`: anonymous local device token stored in browser storage.
- `latitude` / `longitude`: location snapshot at heartbeat time.
- `distance_to_station_meters`: supports the 200m presence rule.
- `last_seen_at`: used to count active nearby devices in the last 5 minutes.

Suggested indexes:

```sql
create index station_presence_station_seen_idx on public.station_presence (station_id, last_seen_at desc);
create index station_presence_seen_idx on public.station_presence (last_seen_at desc);
create unique index station_presence_station_device_idx on public.station_presence (station_id, device_id);
```

Cleanup note:
- Activity is only meaningful for the last few minutes.
- You can keep rows and update `last_seen_at`, or periodically delete rows older than a day.
- The client should count only rows where `last_seen_at >= now() - interval '5 minutes'`.

## Optional View: station_current_status

This should come later, after the base tables are live.

Purpose:
- Precompute or expose the latest station summary for clients.
- Keep the mobile app simple by returning station cards already aggregated.

Possible output fields:
- `station_id`
- `name`
- `latitude`
- `longitude`
- `status`
- `queue_level`
- `recent_reports_count`
- `last_reported_at`

For the prototype phase, aggregation in app code is still fine.

## Row Level Security Notes

Do not enable RLS until the auth model is decided.

Later plan:
- `stations`
  - `select`: public read
  - `insert/update/delete`: admin only
- `reports`
  - `select`: public read or authenticated read
  - `insert`: authenticated users only, or public anonymous insert with strict validation
  - `update/delete`: blocked by default
- `users`
  - `select/update`: owner only
  - moderator/admin access by policy later
- `station_presence`
  - `select`: public read or authenticated read
  - `insert/update`: allow anonymous upsert with strict validation
  - `delete`: blocked by default

Suggested future policy direction:
- Only allow report insert if:
  - station exists
  - `reported_at` is near current time
  - required location fields are present
  - distance to station is within allowed threshold

## Integration Order Later

1. Create `stations` table and seed known Tripoli stations.
2. Create `reports` table.
3. Keep current front-end aggregation logic, but fetch reports from Supabase.
4. Add `station_presence` for passive station activity.
5. Add `users` only after auth is chosen.
6. Add RLS after deciding whether reports require login.

## Prototype Compatibility

Nothing in the current prototype changes yet:
- `localStorage` remains the source of truth for now.
- Demo updates remain local.
- No dependency or environment variable is added in this step.
