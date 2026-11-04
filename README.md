# Inkday — reTerminal E1001 daily dashboard

Hebrew-first 800×480 dashboard for Todoist Inbox and the Google Calendar named **לוז יומי**. The private data service runs on the server; Google Apps Script is not used.

## Runtime

- `server.cjs` serves the dashboard and authenticated `/api/dashboard` endpoint on loopback.
- Todoist is read directly with a server-only token.
- Google Calendar is read with the server's `gog` OAuth token. The service only requests calendar data and does not modify it.
- A 60-second cache limits upstream calls. Failed sources retain the last successful same-day data.
- Responses use `no-store`; every SenseCraft reload fetches a newly generated payload.
- The display key stays in the URL fragment and is sent only to the same-origin API in an Authorization header.

## Server files

Production configuration is `/etc/inkday/inkday.env` with mode `0600`; it is never committed. Required values are documented in `.env.example`. The included `inkday.service` runs as `ubuntu`, starts after boot, binds only to `127.0.0.1`, and is published through Cloudflare Tunnel.

## Authorization

Authorize only Google Calendar on the server:

```bash
gog auth add daniel.hochboim@gmail.com --services calendar
```

Store the Todoist token only in `/etc/inkday/inkday.env`, then run `sudo systemctl restart inkday.service`. Never put credentials, the display key, events, or tasks in Git or GitHub Pages.

## Checks

Run `node verify.cjs` and `curl http://127.0.0.1:9180/healthz`. Use `?display=1&demo=1` for an 800×480 demo. The production SenseCraft URL is the HTTPS origin with `?display=1#key=<DISPLAY_KEY>`; keep that bearer URL private.
