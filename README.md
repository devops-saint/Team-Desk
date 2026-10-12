# Team Desk 3.0

A private, encrypted workspace for managing your reportees: 1:1s, your organisation's competency matrix, technical skills, KPIs, goals, development plans, talent and retention, improvement plans, half-yearly reviews and calibration, plus tools for assessing your own leadership.

It runs **only on your computer** (Mac or Windows). You open it in your browser at `http://localhost:4317`. It stores everything **encrypted** in a folder you choose.

---

## 1. Requirements

- **Node.js 18 or newer.**
  - Mac: you already have Node. To check, run `node -v` in Terminal.
  - Windows: install the LTS version from <https://nodejs.org> (no admin rights needed for the "user" installer).
- A modern browser (Chrome, Edge, Safari or Firefox).

There is nothing else to install. Team Desk has no third-party code on the server side.

## 2. Start Team Desk

| Mac | Windows |
| --- | --- |
| Double-click **`Start Team Desk.command`**. The first time, macOS may block it. If so, right-click it, choose **Open**, then **Open** again. | Double-click **`Start Team Desk.bat`**. |

A small terminal window opens and your browser goes to `http://localhost:4317`. **Keep that window open while you work.** To stop Team Desk, close the window, or use **Settings › About & toolkit › Stop Team Desk**.

Prefer the terminal? From this folder, run `npm start` (or `node server/server.js`). Useful options:

- `--port 5000` uses a different port.
- `--no-open` stops the browser opening automatically.

## 3. First launch: set-up wizard

1. **Choose your data folder.** For example, `Documents/TeamDesk Data`. If the folder you pick isn't empty, Team Desk creates a `TeamDesk Data` folder inside it.
2. **Create a password.** It encrypts everything. **There is no reset.** Keep the password in your password manager.
3. Enter your name and the month your review year starts. You can also import data from the earlier browser-only version (see section 7).

On later launches you only enter your password. Team Desk locks itself after 15 minutes of inactivity. You can change this in **Settings › Security**.

## 4. Your data folder

```
TeamDesk Data/
  vault.json      password check & encryption settings (contains no data)
  org.tde         settings, competency framework, roles, guidelines, your leadership notes
  reportees/      one encrypted file per reportee
  files/          uploaded documents, encrypted and stored per reportee
  backups/        automatic daily snapshots (last 30 days)
```

- **Encryption:** AES-256-GCM. The key is derived from your password with scrypt and is held in memory only while Team Desk is unlocked.
- **Keeping reportees separate:** each reportee's record and documents live in their own encrypted files. Pages about one reportee show only that reportee, and exports for a reportee contain only them. Team-wide pages (dashboard, maps, calibration) are labelled as manager-only.
- **Moving the data:** use **Settings › Data & backups › Move to another folder**. You can keep the folder in a synced location such as OneDrive or iCloud, because it stays encrypted.
- **Backups:** a snapshot is taken automatically each day. You can also click **Back up now** and restore from the same screen. Snapshots don't include uploaded documents.

## 5. Optional: read files offline

Reading PDF, Word and Excel uploads uses three open-source libraries. By default your browser downloads them the first time you need them. **Your files are never uploaded anywhere.** To work fully offline, run this once in this folder:

```
npm install
```

## 6. What's inside

- **Dashboard and Upcoming:** what needs attention across the team, 1:1 coverage this month, and all action items.
- **Reportee workspace**, one focused page per section:
  - Overview: where to focus with this person.
  - 1:1 meetings: GROW coaching, morale, and action items that carry forward.
  - Action items.
  - Competencies: your organisation's matrix, self vs manager ratings, and Excel import/export in the org layout.
  - Technical skills and KPIs.
  - Talent and retention: 9-box placement, flight risk, career readiness and stay conversations.
  - Goals.
  - Development plan.
  - Strengths and development areas.
  - Feedback log: uses Situation, Behaviour, Impact (SBI).
  - Improvement plan.
  - Profile and documents: uploads are analysed and you choose where each point goes.
  - Half-yearly review, printable as PDF.
- **Insights:** competency map, skills map, talent and succession, engagement trends, and calibration.
- **My leadership:**
  - Habits scorecard, calculated from your records.
  - Self-assessment on 12 manager competencies.
  - Anonymous upward feedback: download a questionnaire, share it with your team, then import their response files. Results show only after at least 3 responses.
- **Configuration:** competency framework (your matrix is built in), roles and KPI uploads, technical skills list, and organisation guidelines with search.
- **Dates:** every date field opens a calendar picker.

## 7. Coming from the browser-only version (v1/v2)

In the old `TeamDesk.html`, go to **Settings › Export backup**. Then in Team Desk 3, use the import option during set-up, or **Settings › Data & backups › Import backup file**.

## 8. Updating Team Desk

Replace this program folder with the new version. Your data folder is separate and is never touched by an update. Team Desk remembers which data folder to use in `~/.teamdesk/config.json`.

## 9. Keeping the code in git

The repository should contain **only the program**, never your data. Two files take care of this:

- **`.gitignore`** keeps these out of git:
  - the data folder and anything encrypted (`TeamDesk Data/`, `*.tde`, `vault.json`, `backups/`);
  - exports and downloads (competency matrices, feedback questionnaires and responses, old-version backups);
  - office documents (`.xlsx`, `.docx`, `.pdf`, `.csv`) dropped into the folder by mistake;
  - `node_modules/`, zip builds, logs, `.env` files, and editor or operating-system clutter.
- **`.gitattributes`** fixes line endings: `Start Team Desk.bat` keeps Windows (CRLF) line endings and `Start Team Desk.command` keeps Mac (LF) line endings, so both launchers still work after a clone.

Keep your data folder **outside** this program folder, for example in `Documents/TeamDesk Data`. Then it can't end up in a commit even by accident.

To check what will be committed before pushing:

```
git status --short
git status --ignored --short   # lines starting with !! are ignored
```

`app/js/framework-default.js` contains your organisation's competency matrix, built in as the default. If the repository will be shared outside your organisation, remove that file or make the repository private. Team Desk works without it: you then upload the matrix under **Configuration › Competency framework**.

## 10. Troubleshooting

- **"Team Desk server isn't running"**: start it with the launcher, then reload the page.
- **Port already in use**: Team Desk automatically tries the next ports (4318, 4319, …). The terminal window shows the address it's using.
- **Mac asks for access to Documents or Desktop**: allow it. Without it, Team Desk can't save to a data folder there.
- **Forgot your password**: the data can't be decrypted. Start again with a new data folder.
