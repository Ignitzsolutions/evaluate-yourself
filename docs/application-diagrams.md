# Evaluate Yourself - Use Case and Functional Diagrams

## Use Case Diagram

```mermaid
flowchart LR
  C["Candidate"]
  A["Admin"]
  CL["Clerk Auth"]
  RT["Azure OpenAI Realtime"]
  DB["Azure PostgreSQL"]
  BE["FastAPI Backend"]
  CA["Candidate App"]
  AD["Admin Dashboard"]

  C -->|Email/Phone OTP Login| CA
  CA -->|Authenticate| CL
  C -->|Fill Pre-Interview Form| CA
  C -->|Redeem Trial Code| CA
  C -->|Start Interview| CA
  C -->|View + Download Report| CA

  A -->|Admin Login| AD
  A -->|Manage Candidates| AD
  A -->|Create/Revoke Trial Codes| AD
  A -->|View Evaluation Quality| AD

  CA --> BE
  AD --> BE
  BE -->|JWT Verify| CL
  BE -->|Session/Transcript| RT
  BE -->|Users/Sessions/Reports/Trials| DB
```

## Functional Architecture Diagram

```mermaid
flowchart TB
  subgraph Frontend["Frontend"]
    CandidateUI["Candidate App\n(Login, Pre-Interview, Interview Room, Report)"]
    AdminUI["Admin App\n(Admin Login, Dashboard)"]
  end

  subgraph Backend["FastAPI Backend"]
    Auth["Auth + Admin Guard\n(Clerk JWT, allowlist)"]
    Trial["Trial & Entitlement Service"]
    RTC["Realtime Session API\n(/api/realtime/webrtc)"]
    Ingest["Transcript Ingestion\n(/api/interview/{session_id}/transcript)"]
    Eval["Deterministic Rubric Evaluator"]
    Contract["Evaluation Contract Validator"]
    Report["Report Generator + PDF"]
    AdminAPI["Admin APIs\n(summary, candidates, trial-codes, quality)"]
  end

  subgraph Data["Data/Infra"]
    Clerk["Clerk"]
    Realtime["Azure OpenAI Realtime"]
    PG["Azure PostgreSQL\nusers, profiles, sessions, reports,\ntrial_codes, user_entitlements, gaze_events"]
    Redis["Redis (optional cache/events)"]
  end

  CandidateUI --> Auth
  AdminUI --> Auth
  Auth --> Clerk

  CandidateUI --> Trial
  Trial --> PG

  CandidateUI --> RTC
  RTC --> Realtime
  RTC --> PG
  RTC --> Redis

  Realtime --> Ingest
  Ingest --> Eval
  Eval --> Contract
  Contract --> Report
  Report --> PG

  AdminUI --> AdminAPI
  AdminAPI --> PG
  AdminAPI --> Report
```

## PaperBanana Inputs

- Use case input text: `/Users/srujanreddy/Projects/evaluate-yourself/docs/diagrams/use-case-input.txt`
- Functional input text: `/Users/srujanreddy/Projects/evaluate-yourself/docs/diagrams/functional-diagram-input.txt`

## Rendered Diagram Files

- Use case SVG: `/Users/srujanreddy/Projects/evaluate-yourself/docs/diagrams/use-case.svg`
- Functional architecture SVG: `/Users/srujanreddy/Projects/evaluate-yourself/docs/diagrams/functional-architecture.svg`
