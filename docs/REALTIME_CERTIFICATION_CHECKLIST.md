# Realtime Certification Checklist

Use `npm run test:e2e:hosted` as the Playwright-assisted manual harness for deployed validation.

Required environment for the hosted harness:
- `PW_CERT_BASE_URL`
- `PW_CERT_SESSION_URL`
- `PW_CERT_STORAGE_STATE`

Record failures as structured findings with:
- `title`
- `body`
- `environment`
- `session_url`

Use this checklist before production release or after any change touching realtime audio, transcription, gaze, session save, or report generation.

## Test Environment
- Browser: primary supported browser profile with no stale cache or disabled permissions
- Frontend URL: confirm the intended environment URL
- Backend URL: confirm `/health` returns `200`
- Auth: sign in with a candidate-capable account and an admin-capable account
- Devices:
  - working microphone selected
  - working speaker or headphones selected
  - working camera selected

## Pre-Run Checks
- Grant browser microphone permission
- Grant browser camera permission
- Confirm system output volume is audible
- Confirm input device level moves when speaking
- Open devtools console and verify there are no blocking runtime errors before starting

## Candidate Interview Certification

### 1. Interview Setup
- Open `/interviews`
- Start each interview type once:
  - `technical`
  - `behavioral`
  - `360 Interview`
- Confirm the UI label shows `360 Interview` while backend payload remains `mixed`
- Confirm stream/skill selection loads correctly

### 2. Sonia Audio
- Start session
- Confirm Sonia speaks the opening prompt audibly
- Confirm no silent-start behavior
- Confirm no repeated audio-blocked banner after permission is granted
- Confirm filler audio masks any delayed next-turn planning instead of leaving dead air

Pass criteria:
- Sonia audio is heard within the first prompt
- No broken playback loop
- No silent assistant responses

### 3. Live Transcription
- Speak a 10 to 15 second answer
- Confirm candidate transcript appears during or immediately after speaking
- Confirm a second answer also appears
- Interrupt Sonia once mid-speech and confirm barge-in stops assistant audio quickly
- If realtime transcription fails, confirm browser fallback captures usable text and user-facing messaging is clear

Pass criteria:
- At least two user turns are captured in transcript
- No session ends with empty transcript when speech was clearly present
- Barge-in works without duplicate transcript rows or broken turn progression

### 4. Gaze
- Keep eyes on camera for one answer
- Look down deliberately for several seconds during one answer
- Look away deliberately for several seconds during another answer
- Turn camera off, then back on if the flow supports it
- Move fully out of frame once
- Confirm calibration/status messaging updates correctly

Pass criteria:
- Gaze bootstrap succeeds
- Gaze state changes are reflected in UI
- `Calibrating`, `Looking Down`, `Looking Away`, `Face Not Detected`, and `Camera Off` can all be observed when triggered
- Final report shows gaze summary without crashing

### 5. Save + Report
- End interview normally
- Confirm transcript save succeeds
- Confirm report generation succeeds
- Open report page

Pass criteria:
- No 5xx during save/report flow
- Report page loads
- Overall score, validity panel, strengths, risks, and action plan render
- PDF download renders cleanly and does not look like a raw metrics dump

### 5A. Invalid Session Guardrail
- Start a session and let Sonia ask the opening question
- Do not answer
- End the interview
- Open the generated report and download the PDF

Pass criteria:
- Report is clearly marked invalid for paid evaluation
- No normal hiring recommendation is shown
- No misleading strengths section is shown
- PDF remains clean and intentional, not broken or empty-looking

## Admin Certification

### 6. Question Bank
- Open admin panel
- Navigate to `Question Bank`
- Add a custom technical skill
- Add a custom question under that skill
- Edit one builtin question text/status
- Disable one builtin question

Pass criteria:
- All mutations succeed without console/runtime errors
- Changes appear after refresh

### 7. Downstream Reflection
- Return to interview setup
- Confirm new skill appears in candidate skill catalog
- Start an interview using that skill
- Confirm a custom/admin-managed question can surface in the session

Pass criteria:
- Admin changes affect candidate flow without manual DB intervention

### 8. Trial Codes
- Create a trial code with a display name
- Confirm the generated redeemable token is shown separately from the display name
- Redeem the code with a candidate account if needed for validation
- Delete the code
- Confirm it disappears from the default admin list
- Enable deleted filtering and confirm it can still be audited

Pass criteria:
- Named code creation works
- Delete removes the row from the default view immediately
- Deleted codes remain retrievable only through the explicit deleted filter

## Failure-State Checks
- Stop backend while frontend remains open
- Confirm the app shows a backend-unavailable state, not a misleading auth failure
- Restore backend and confirm retry works

## Final Sign-Off
- Record:
  - date/time
  - browser/version
  - OS/device
  - environment URL
  - interviewer account used
  - Sonia audible: yes/no
  - live transcript visible: yes/no
  - gaze state transitions verified: yes/no
  - invalid-session handling verified: yes/no
  - premium PDF quality verified: yes/no
  - result for save/report
  - result for admin question bank
  - result for trial codes

Release is blocked if any of these fail:
- Sonia not audible
- transcript not captured reliably
- barge-in or filler masking broken
- gaze flow broken
- invalid session rendered like a normal paid report
- premium PDF quality unacceptable
- save/report flow errors
- admin question bank changes do not affect downstream interviews
