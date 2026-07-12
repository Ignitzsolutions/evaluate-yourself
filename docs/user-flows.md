# User Flows

## Primary User

A candidate practicing interviews and communication before applying to jobs.

## Primary Outcome

Start a Sonia interview, answer at least one turn, finish safely, and receive a useful report.

## Shortest Successful Candidate Flow

1. Land on `/`.
2. Sign in or register.
3. Complete onboarding if required.
4. Open `/interviews`.
5. Select an interview type.
6. Configure role, difficulty, consent, and skills when required.
7. Start Sonia.
8. Complete the interview.
9. Save and view the report.

## Public Flow

1. `/` explains the product.
2. `/pricing` compares plans.
3. `/checkout/:planKey` redirects to payment.
4. Auth routes handle login, registration, password reset, and set-password.

## Recovery Flow

- Missing setup: return to `/interview-config` with a visible reason.
- Backend unavailable: show retry and safe navigation.
- Mic/camera denied: show retry and return-to-setup.
- Report not found: send signed-in users to dashboard/interviews.

## Navigation Priority

1. Dashboard
2. Interviews
3. Reports/analytics
4. Account/admin surfaces

