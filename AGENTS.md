# Project: Shale (Tripoli Gas Station Availability App)

## Core Objective
Deliver the most reliable real-time estimation of gas station availability.
Trust > features.

## System Model
This is NOT a reporting app.
This is a prediction system.

Inputs:
- Station base data
- User reports
- Time patterns
- Location density
- Historical behavior

Output:
- Fuel status
- Crowd level
- Confidence score

## Tech Stack
- Frontend: Vanilla JS modular .mjs
- Backend: Supabase PostgreSQL + PostGIS
- DB Tables: stations, reports

## Data & Logic Rules
- Never trust raw reports blindly.
- Weight reports by recency, distance, frequency, and user reliability.
- Always aggregate reports before showing station status.
- Use confidence_score for every station.
- Low confidence means status should be unknown.

## Tripoli Pattern Rules
- Early morning is usually low crowd.
- Sunday is usually peak demand.
- Thursday is usually high demand.
- Friday morning is usually the best window.
- Emergency shortages override normal patterns.

## Performance Rules
- Heavy logic must run in Postgres.
- Avoid large client-side loops.
- Use SQL aggregation and indexes.
- Optimize for mobile networks.

## UI/UX Rules
- Mobile-first only.
- Arabic RTL required.
- Clean minimal UI.

Status labels:
- available = متوفر
- crowded = مزدحم
- no fuel = غير متوفر
- unknown = غير معروف

Sorting priority:
1. available
2. short queue
3. high confidence
4. proximity

## Engineering Rules
- Do not rewrite full files unless necessary.
- Preserve structure and naming.
- Make minimal safe changes.
- Explain why the change is needed.
- Highlight risks.

## Feature Rule
Only add features that improve accuracy, trust, or speed.

## Avoid
- Over-engineering
- Unnecessary libraries
- Trusting user input blindly
- Heavy frontend computation
- Ignoring confidence scoring
