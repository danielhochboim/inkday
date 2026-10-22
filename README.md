# Inkday — reTerminal E1001 daily dashboard

A monochrome, Hebrew-first, 800 × 480 dashboard for Todoist Inbox and today's events from **לוז יומי**. Runs on GitHub Pages. No build step, subscription, Home Assistant, or always-on computer is required. A small Google Apps Script bridge reads the two services when the display requests an update.

## What is included

- Large Israel-time clock; current event, remaining minutes, and next event.
- Today's agenda, including all-day events and a 24-hour timeline with a current-time marker.
- Every open Inbox task, with priority and due-today/overdue indicators. Four tasks per page, rotating every five minutes when there are more.
- Explicit demo mode, errors, and stale-data indicators. Old calendar events are never shown as today's events after midnight.
- Read-only service access. There are no controls that complete tasks or modify calendar events.
- The page itself updates the clock every 15 seconds and fetches data every five minutes. The physical e-paper panel only changes when Seeedash captures/refreshes the page; it is not a continuously ticking display.

## 1. Publish on GitHub Pages

1. Create a public repository called `inkday` at <https://github.com/new>. The repository contains code only, never credentials or personal events/tasks.
2. Upload the files from this package, preserving the `docs`, `google-apps-script`, and `.github/workflows` directories. GitHub's web uploader may omit hidden directories: using the branch method below avoids requiring the workflow.
3. Open **Settings → Pages → Build and deployment → Source: Deploy from a branch**, select **main**, folder **/docs**, and **Save**. The site should become available at `https://danielhochboim.github.io/inkday/` after deployment succeeds. This is an expected URL, not evidence of an existing deployment.
4. Alternatively select **GitHub Actions** as the source if `.github/workflows/pages.yml` was uploaded. Do not run both publishing methods simultaneously.
5. `?demo=1` opens the layout with clearly marked sample data. Demo mode does not connect to your accounts.

## 2. Create the data bridge (one-time setup)

1. Open <https://script.google.com/home/start> with the Google account that owns **לוז יומי**, and create a new project named **Inkday**.
2. Replace `Code.gs` with `google-apps-script/Code.gs` from this package.
3. In **Project Settings**, enable **Show appsscript.json manifest file in editor**. Replace that file with the included `google-apps-script/appsscript.json`. This explicitly requests calendar **read-only** access and permission to call Todoist over HTTPS.

| Property | Value |
| --- | --- |
| `TODOIST_TOKEN` | Your existing token from Todoist → Settings → Integrations → Developer. Do not put this token in the GitHub repository or the dashboard URL. |
| `INBOX_PROJECT_ID` | `YOUR_INBOX_PROJECT_ID` (your Inbox). Optional: omit it to discover Inbox automatically. |
| `CALENDAR_ID` | Required. Set this privately to the selected **לוז יומי** calendar in `Code.gs`. |

5. Select **createDisplayKey** from the function menu and click **Run**. This generates a random `DISPLAY_KEY` in Script properties. It is a read-only display access key, distinct from your Todoist token. Do not publish it.
6. Run **checkConnection** and approve Google's requested access yourself. Successful execution logs only the date, event/task counts, and `errors: []`, never event or task titles. If `calendar` appears in errors, verify that you used the correct Google account. The bridge uses the built-in Calendar service; no advanced API needs enabling. If `todoist` appears, check the token and Inbox ID.
7. Choose **Deploy → New deployment → Web app → Execute as: Me → Who has access: Anyone → Deploy**. The script checks `DISPLAY_KEY` before fetching anything. The script needs to run without a Google login prompt because Seeedash's screenshot service has no Google browser session.
8. Copy the deployed URL ending in `/exec`.

If you edit the script later, **Deploy → Manage deployments → Edit → New version → Deploy** is required. Saving the source alone does not update the public `/exec` deployment.

## 3. Connect the dashboard and Seeedash

1. Open the published site in a normal browser. Choose **חיבור חשבונות**.
2. Paste the Apps Script deployment URL and the `DISPLAY_KEY` from Script properties. Click the connect button. These settings are not committed, uploaded to GitHub, or saved in localStorage.
3. Copy the generated **display URL**. Connection settings are in the URL fragment (`#`), allowing a separate screenshot browser to use them without relying on your local browser session.
4. In **SenseCraft Seeedash → Web Content**, paste the entire generated URL, including its fragment. Set the capture/display dimensions to **800 × 480**, preview, then deploy to the E1001.
5. Set the device/page refresh interval to **5 minutes** initially. The clock will show the time of the last screenshot. Refreshing more frequently costs battery and may be limited by your Seeedash plan. A one-minute clock requires the panel to refresh at least once per minute; JavaScript running in the page cannot update a sleeping e-paper panel.
6. Confirm that the preview shows live content, not the unconnected layout or demo. Allow time for the data request to complete before capture. If Seeedash captures too early, increase its capture delay where available. The screenshot service's JavaScript timing and URL-fragment handling must be verified on the device; they have not been tested by this package's author.

## Privacy model

GitHub serves only public HTML/CSS/JS. There is no public `data.json`, no private content in Git history, and no account token in the page source. The Google script runs in your own account and requests only today's selected calendar events and your open Inbox tasks. The frontend uses JSONP with a fixed callback because Apps Script does not provide configurable CORS headers for ordinary static-site fetches.

The display URL is a **bearer link**: anyone with the full link can read the limited dashboard data. Keep it private. Seeedash must receive it to render your screen, and Google's service receives the display key when the page requests data. The fragment is not sent to GitHub by HTTP. The page sets `Referrer-Policy: no-referrer`, has no analytics, embeds no third-party fonts, and never stores the Todoist token.

To revoke display access, change `DISPLAY_KEY` in Script properties and generate a new display URL. To revoke Todoist access, remove/revoke its token. No cloud service can refresh live data solely from the ChatGPT account connections in this conversation: the script setup is required.

## Local preview

Run `node serve.cjs` from this directory. Open <http://127.0.0.1:8765/?demo=1>. Use `?display=1&demo=1` for a clean 800 × 480 screenshot. Run `node verify.cjs` for boundary and backend contract checks. No dependencies are needed.

## Verification status

The frontend and backend are supplied as source. Syntax and deterministic boundary checks can run locally. Live Google authorization, Todoist requests, GitHub Pages deployment, and Seeedash capture require the associated accounts and an actual deployed bridge; do not treat a successful demo as proof of live integration.

