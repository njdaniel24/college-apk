# Hostel Meals — Android App (Google Sheets edition)

The original Firebase backend has been **replaced with your Google Sheet**:
https://docs.google.com/spreadsheets/d/1U-r-XE6oFChErhaz2ijnO-WyXR5AYJpKf87uvdiH2Jc/

A tiny **Google Apps Script** (included as `Code.gs`) acts as the API layer inside
your sheet — the app calls it over HTTP, and it reads/writes the tabs
`Users`, `Meals` and `Admins` (created automatically). No Firebase, no API keys,
no `google-services.json`.

---

## ⚙️ One-time setup (about 3 minutes)

1. Open your Google Sheet → **Extensions → Apps Script**.
2. Delete the default code, **paste all of `Code.gs`** (from this zip), press **Save**.
3. **Deploy → New deployment** → type **Web app** →
   - Execute as: **Me**
   - Who has access: **Anyone**
   → **Deploy** → **copy the `/exec` URL**.
4. Open `app/src/main/assets/index.html` and replace
   `PASTE_YOUR_WEB_APP_URL_HERE` with that URL (it's the first line of the script,
   marked with big arrows ⬇️⬇️).
5. Make wardens: in the sheet's **Admins** tab, put the warden's login email in cell A2
   (one email per row). Without it, everyone gets the student view.

> Sheets quota: free consumer accounts allow ~20,000 write calls/day — far more
> than a hostel needs. Each login/meal submission is 1 call.

---

## 📲 Build the APK

1. Open this folder in **Android Studio** (free), let Gradle sync.
2. **Build → Build App Bundle(s)/APK(s) → Build APK(s)** → locate the file
   `app/build/outputs/apk/debug/app-debug.apk` → copy to phones and install.

Or skip the build entirely: host the `web/` folder on any static host
(e.g. Firebase Hosting, GitHub Pages, Netlify) and open it in Chrome on Android →
**Add to Home screen**. It's a full PWA.

---

## 🗃️ How the data is stored

| Tab | Columns | Written when |
|---|---|---|
| `Users` | email, password, name, dept, year, created | student signs up |
| `Meals` | date, email, name, dept, year, b, l, d, at | student submits/updates a day |
| `Admins` | email | manually, to grant warden access |

- A student can re-submit the same date — the script **updates** the existing row.
- Rows older than 30 days are **auto-deleted** on each submit/warden view.
- Passwords are stored as plain text (same as before with Firebase it would be hashed —
  if you want, switch the two `String(u.password) !== String(password)` checks to
  hashed comparisons later).

## 🏗️ Request flow

```
Android app / browser  --HTTPS-->  Apps Script Web App  -->  your Google Sheet
   (index.html)            POST {date,email,b,l,d...}        (append/update row)
```

## Project layout

```
HostelMealsAndroid/
├── Code.gs                         ← paste into Apps Script & deploy
├── README.md
└── app/src/main/
    ├── AndroidManifest.xml
    ├── assets/index.html           ← ⬇️ paste the /exec URL here
    └── java/com/hostelmeals/app/MainActivity.kt   (WebView shell — unchanged)
```
