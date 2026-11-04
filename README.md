# Yerevan Business School — website

Static site (`public/`) with a free admin panel at `/admin.html`.
Content edits and applications are stored in Google Drive / Google Sheets
through Google Apps Script — no extra hosting or database costs.

| Path | What it is |
|---|---|
| `public/` | Site source: `index.html`, `script.js`, `styles.css`, `content.js` (default content + Apps Script URL), `admin.html` |
| `dist/client/` | Ready-to-upload build (drag into Netlify → Deploys) |
| `google-apps-script.gs` | Backend: applications, admin login, content, images, history |
| `ADMIN-SETUP-HY.md` | Setup guide (Armenian) |

## Run locally
```
cd dist/client
python -m http.server 8080
```
Open http://localhost:8080 and http://localhost:8080/admin.html

## Build
```
npm install
npm run build
```
