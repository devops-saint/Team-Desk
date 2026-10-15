# Team Desk 4.2

An encrypted workspace for managing your reportees: 1:1s, your organisation's competency matrix, technical skills, KPIs, goals, development plans, talent and retention, improvement plans, half-yearly reviews and calibration, plus tools for assessing your own leadership.

Team Desk comes in two editions. Both are in this folder and share the same app:

| | **Personal** | **Central** |
| --- | --- | --- |
| For | One manager | All the managers in a team or organisation |
| Runs on | Your own computer (Mac or Windows) | A company server, as plain Node.js or Docker |
| Sign-in | One password that unlocks your data | **Sign in with Microsoft** (Entra ID / Azure AD), or a Team Desk email and password |
| Access | Only you | **Line managers** see only their own reportees. **People managers** see every reportee, view only. **Administrators** approve accounts. |
| Encryption | With your password, in a folder you choose | With a server key, kept separate from the data |
| Start it with | `Start Team Desk.command` / `.bat`, or `npm start` | `Start Team Desk Server.command` / `.bat`, `npm run server`, or `docker compose up -d` |

Sections 1–8 cover the personal edition. **[Section 9](#9-central-server-for-all-managers) covers the central server.** Everything about using Team Desk day to day (sections 6–8) applies to both.

---

> **Presenting Team Desk?** A ready-to-use demo script with what to click and what to say is in [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md).

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
3. Enter your name and the month your review year starts. You can also import data from the earlier browser-only version (see section 10).

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

Reading PDF, Word and Excel uploads uses three open-source libraries: pdf.js 5, mammoth 1.11 and SheetJS 0.20.3. By default your browser downloads them the first time you need them, from `cdn.jsdelivr.net` and `cdn.sheetjs.com`. **Your files are never uploaded anywhere.** To work fully offline, run this once in this folder:

```
npm install
```

These versions have no known vulnerabilities, and `npm audit` should report 0. SheetJS no longer publishes fixed versions to the npm registry, so `npm install` fetches it from SheetJS's own server (`cdn.sheetjs.com`). If your network blocks that site, the install skips SheetJS and the browser downloads it when needed.

If you installed an older Team Desk, refresh the libraries once: delete `node_modules` and `package-lock.json`, then run `npm install` again.

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
- **Feedback** (menu item under My leadership):
  - **From your team (anonymous)** — both editions. Choose the questions about you and how the team works (a suggested set is included), download an editable **Word** or **Excel** form with no name field, share it, then **upload** the filled forms (or paste answers). Only the answer text is read — never the file name or document properties such as *Author* — and the files are not kept. Every sentence is sorted into **Appreciation**, **Improvement** or **Other**. Nothing is shown until the minimum number of responses (Settings, default 3), and answers are shown shuffled, never as one person's form.
  - **Between managers** — central edition only, see [section 9](#feedback-between-managers).
- **Configuration:** competency framework (your matrix is built in), roles and KPI uploads, technical skills list, and organisation guidelines with search.
- **Dates:** every date field opens a calendar picker.
- **Reports for HR and leadership:** the **Report** button on a reportee downloads their complete record as **PDF**, **Word** or **Excel**. You choose the period (last 12 months, all time or one review cycle) and the sections: profile, reviews, competencies, skills, KPIs, goals, development, feedback, talent and retention, improvement plans, 1:1s, actions, leave and documents. Private notes are left out unless you tick them in. The report contains only that one reportee. It is generated in the browser, so it works offline.
- **Rating scale:** competencies are rated **1–5** (3 = meets the grade's expectation, 5 = role model), plus **X** for "not applicable". Data from older versions on the 1–3 scale is converted automatically the first time you unlock (1→2, 2→3, 3→4). If HR's template uses 1–3, Team Desk converts it on import, and on export you can choose to keep 1–5 or convert back to 1–3. The 9-box stays a 3×3 grid by design.
- **Quick note:** the **Quick note** button in the top bar, or on any reportee, records an observation in 10 seconds. It goes into that person's feedback log, with an optional follow-up action.
- **Search inside notes:** the top search finds people and also words inside 1:1 notes, feedback and documents. Click a result to open the exact meeting.
- **1:1 frequency:** set a weekly, fortnightly or monthly cadence per reportee in their profile. "Overdue for a 1:1" alerts follow it.
- **Milestones:** birthdays, work anniversaries and probation end dates show on the dashboard and in Upcoming. Probation reviews that are due raise an alert.
- **Team report:** Insights › Team report gives a monthly summary for your own manager: 1:1 coverage, goals, people processes, highlights, org contributions and next month's leave. Names can be hidden. It can be printed.
- **One-page summary:** on a reportee's profile, prints a single page about them. Private notes, flight risk and improvement plan details are left out.
- **Intelligence:** suggested actions from 1:1s and documents, optional local AI, a guided 1:1 question bank, a prepare-next-1:1 agenda, and leave tracking (see section 7).

## 7. Intelligence: suggested actions, guided 1:1s and leave

### Suggested actions

Every time you save a 1:1 or upload a document for a reportee, Team Desk reads it and suggests what you, as their manager, might do next.

- **What it looks for:**
  - wellbeing and stress, workload and under-use, retention signals (offers, pay, promotion), blockers, delivery risk, working-relationship concerns and requests for your support;
  - learning plans, certifications (with exam dates), presentations and knowledge sharing, recruitment help, achievements and career aspirations;
  - planned leave (it reads dates like "24–28 Nov");
  - admin items and performance concerns.
- **Patterns across meetings:** it also notices when morale drops sharply, when the same blocker comes up twice, and when concerns are raised two meetings running.
- **You decide:** a review window lets you edit each suggestion, choose where it goes (action for you or for them, development plan, goal, feedback log, leave, flight risk with a stay conversation, career notes, your leadership notes), and accept or dismiss it. Anything you don't decide on stays in the reportee's **Suggested actions** list.
- **Re-run anytime:** to analyse something again, open a 1:1 or document and click **Suggest actions**.

### Optional local AI (Ollama)

For deeper, more nuanced suggestions and personalised 1:1 questions, Team Desk can use an AI model that runs **on your own computer**:

1. Install Ollama from <https://ollama.com>. Then in Terminal, run `ollama pull llama3.1:8b`. (`qwen2.5:7b` also works well; 8 GB+ RAM recommended.)
2. In Team Desk, go to **Settings › AI assistant**. Choose the model, tick **Use local AI**, then click **Test**.

Team Desk's server talks to Ollama on `localhost` only. Addresses on other computers are refused, so nothing leaves your machine. The built-in analysis works with or without AI.

### Guided 1:1 questions

The 1:1 form opens on **Guided questions**, a bank of 15 topics:

- **Every month:** wellbeing & workload, project status, technical, goals & performance, self-development & learning, org-level trainings & presentations, wins & recognition, leave & availability, admin & compliance (timesheets, mandatory trainings), and feedback for you.
- **Every quarter:** certifications, org contributions (initiatives, knowledge sharing, recruitment, mentoring), collaboration & non-technical skills, career & growth, and team, culture & retention.

Monthly topics always appear. Quarterly topics are flagged **due** when they haven't been covered for about three months. Each question shows the answer from the last meeting. To change how often a topic comes up, hide questions or add your own, go to **Configuration › 1:1 question bank**.

### Prepare next 1:1

Click **Prepare next 1:1** on a reportee's Overview or 1:1 page, or from the dashboard. It builds an agenda for you:

- open actions and last time's concerns and blockers;
- signals worth exploring;
- quarterly topics that are due;
- upcoming leave and deadlines;
- suggested follow-up questions.

With local AI turned on, it can also suggest personalised questions. You can print the agenda.

### Leave & availability

Record leave per reportee from their **Leave & availability** page, or from the **Leave** tab of a 1:1. Leave mentioned in answers is also suggested automatically.

- **Team leave:** Upcoming › Team leave shows everyone's leave for the next 90 days and who overlaps.
- **Clash warnings:** Team Desk warns when leave clashes with a goal's due date.

## 8. Demo data (for presentations)

To demo every feature without typing data in, load six fictional reportees (grades A2, C1, C2, C3, S1 and S2) with months of history:

1. Start Team Desk and **switch to an empty demo data folder**: Settings › Data & backups › Open a different data folder.
2. While Team Desk is running, double-click **`Load Demo Data.command`** (Mac) or **`Load Demo Data.bat`** (Windows), or run `npm run demo`.
3. The open browser tab refreshes by itself within about 10 seconds.

To remove it again, run `npm run demo:remove` (or `node scripts/seed-demo.js --remove`).

How it behaves:

- It talks only to the Team Desk running on this computer.
- If Team Desk is locked, it asks for your password in the terminal.
- It takes a backup snapshot before writing anything.
- It refuses to run on a folder that already has real reportees, unless you pass `--force`.
- Running it again resets the demo reportees to their original state.

The full walkthrough is in [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md).

## 9. Central server for all managers

The central edition runs one Team Desk for everyone. Each person registers once and then signs in with their email and password. What they can see depends on their group.

### Groups and profiles

| Group | Sees | Can change |
| --- | --- | --- |
| **Line manager** | Only their own reportees | Everything about their own reportees |
| **People manager** | Every reportee of every line manager | Nothing (view only); can download reports |
| **Administrator** | Accounts, groups, settings and the audit log. Reportee names only on the ownership page. **Has no reportees.** | Approves accounts, sets groups, moves reportees between line managers, edits the organisation configuration |

- **Line managers** work exactly as in the personal edition, but only with their own team.
- **People managers** get an **Organisation** dashboard: every team at a glance, urgent items across the organisation, a talent snapshot, all reportees with a line-manager filter, and every Insights page across all teams. A reportee's full record opens read-only, with a **Download report** button.
- **An administrator never has reportees**, so they can't be in the Line manager group, and no reportee can be moved to them. That way people managers never see an "administrator's team". An administrator can also be a people manager (they then see the Administration menu inside the People manager profile); otherwise they sign in to an Administration-only view. Someone who both administers Team Desk and manages a team uses two accounts.
- **Upgrading from 4.0.0:** if an administrator was also a line manager, the server removes their Line manager group when it starts. Any reportees they owned are hidden from people managers and show as **Needs a new line manager** under **Reportee ownership** until you move them.
- **Someone in both Line manager and People manager** chooses a profile after signing in, and can switch any time with **Switch profile** in the sidebar.

### Privacy rules (enforced by the server, not just hidden in the browser)

- A line manager can't open, download or change another manager's reportees.
- People managers can't change any record. The server rejects their changes, and the browser shows every screen read-only.
- **Private notes stay private by default.** These are the "Private notes" box in a 1:1 and "Personal context" on a profile; the server removes them (and the line manager's suggested-actions inbox, which can quote them) before sending a record to a people manager. An administrator can allow people managers to see them under **Administration › Server settings**. Line managers then see the label change to "you and people managers".
- Feedback from other managers is visible to the reportee's line manager (and people managers); the person who gave it sees only their own words, never the reportee's record.
- Organisation configuration (competency framework, roles and KPIs, technical skills, guidelines, review-year start) is shared by everyone, and only administrators can change it. Each manager keeps their own 1:1 question bank, leadership self-assessment, upward feedback, theme and AI preference.
- **Audit log.** Every sign-in (including failed ones), approval, group change, password reset and ownership move is recorded. So is every people-manager view of a reportee and every report or document download. The log is encrypted. See **Administration › Audit log**.

### Feedback between managers

Under **Feedback** in the menu (with a bell in the top bar for notifications):

- **Request feedback.** On a reportee's **Feedback log**, a line manager clicks **Request feedback**, searches for anyone with Team Desk access by name (accounts created from Microsoft Entra ID are listed by their directory name), edits the questions and sends. The person asked sees a notification and answers inside Team Desk. They see only the reportee's name and designation and the questions — never the record.
- **Give feedback without being asked.** Anyone with Team Desk access can give feedback on a reportee in another team (**Feedback › Give feedback**, or **Give feedback** on a reportee's page for people managers). The reportee's line manager is notified.
- **Analysis.** Every answer is split into sentences and sorted into **Appreciation**, **Improvement** or **Other**. They appear in the reportee's feedback log as *Kudos*, *Constructive* and *Observation* entries with source *Peer* and the giver's name.
- **Who sees what.** The reportee's line manager (and people managers, as part of the record) see the feedback with the giver's name. The giver sees only their own words. If the reportee moves to another line manager, the answers move with the record; the manager who asked keeps only the status.
- Every request, answer, decline and unsolicited feedback is in the audit log.

### Start the server

Choose one of these:

- **Node.js** (18 or newer): from this folder, run `npm run server` (or `node server/central.js`). On a Mac or Windows machine you can also double-click **`Start Team Desk Server`**.
- **Docker:** run `docker compose up -d`, then `docker compose logs -f` to see the address.

The server listens on port **8080** by default. Open `http://<server>:8080` and **register: the first account becomes the administrator**, with no reportees. After that, line managers and people managers register themselves. You'll see a badge on **Users & access**: approve each person and choose their group. A person who registered can't sign in until they are approved.

### Use HTTPS

Passwords and records travel over the network, so put Team Desk behind HTTPS before real use. Choose one of these:

- **Your existing reverse proxy** (nginx, Apache, IIS, a load balancer) terminating HTTPS and forwarding to port 8080. Start Team Desk with `--trust-proxy` (Docker: `TEAMDESK_TRUST_PROXY=1`, already set in `docker-compose.yml`). Sign-in cookies are then marked secure.
- **Team Desk itself:** `node server/central.js --tls-cert cert.pem --tls-key key.pem`.

Minimal nginx example:

```
server {
  listen 443 ssl;  server_name teamdesk.company.com;
  ssl_certificate /etc/ssl/teamdesk.crt;  ssl_certificate_key /etc/ssl/teamdesk.key;
  client_max_body_size 64m;
  location / { proxy_pass http://127.0.0.1:8080; proxy_set_header Host $host;
               proxy_set_header X-Forwarded-For $remote_addr; proxy_set_header X-Forwarded-Proto https; }
}
```

### Microsoft sign-in (Entra ID / Azure AD)

People can sign in with their work Microsoft account instead of a Team Desk password. The administrator decides who gets in and with which role, picking people from one Entra ID security group.

**1. In Azure** (needs an Entra ID administrator, about 5 minutes):

1. **Microsoft Entra admin center › App registrations › New registration.** Name it "Team Desk", choose *Accounts in this organizational directory only*, and add a redirect URI: platform **Web**, `https://<your Team Desk address>/auth/azure/callback`. Team Desk shows the exact value to copy under **Administration › Server settings**. Azure accepts plain `http://` only for `localhost`, so for a quick test on your laptop open Team Desk as `http://localhost:8080`.
2. **Certificates & secrets › New client secret.** Copy the secret's **Value**.
3. **API permissions › Add a permission › Microsoft Graph › Application permissions › `GroupMember.Read.All`**, then **Grant admin consent**. Team Desk uses this only to list the group's members and to check membership when someone signs in.
4. **Groups.** Create or choose a security group for Team Desk users (for example "Team Desk Users") and copy its **Object ID**. Nested groups count too.

**2. In Team Desk** (as administrator):

1. Go to **Administration › Server settings › Microsoft sign-in** and fill in the directory (tenant) ID, application (client) ID, client secret and group Object ID. Click **Save**, then **Test connection**. It should show the group's name and how many members it has.
2. Tick **Use Microsoft sign-in** and click **Save**.
3. Open **Administration › Microsoft directory**. Everyone in the group is listed, and you can search by name, email, job title or department. Click **Give access**, then tick **Line manager**, **People manager** and/or **Administrator**. That person can now click **Sign in with Microsoft**.
   - Someone who already has a Team Desk account with the same email shows as **Not linked**. **Link & set role** connects the two, and they keep their reportees and history.
   - To take access away, disable the account under **Users & access**. Removing someone from the Entra ID group also blocks them at their next sign-in.

**How it behaves:**

- **Who can sign in:** only people who have a Team Desk role **and** are still in the group. Anyone else signed in to Microsoft is told they don't have access yet. Every refusal is in the audit log.
- **Passwords:** by default, Team Desk passwords keep working alongside Microsoft sign-in. Untick **Also allow Team Desk passwords for everyone** to make Microsoft the only way in. Administrators can still sign in with a password as a fallback, so you can't lock yourself out. Registration through the sign-in page also switches off.
- **Under the hood:** OpenID Connect with PKCE. The server checks Microsoft's token signature, tenant, application, expiry and nonce, and stores the client secret encrypted in `system.tde`. No extra software is needed.
- **Settings in environment variables:** instead of the settings page, you can set `TEAMDESK_AAD_TENANT_ID`, `TEAMDESK_AAD_CLIENT_ID`, `TEAMDESK_AAD_CLIENT_SECRET`, `TEAMDESK_AAD_GROUP_ID` and `TEAMDESK_PUBLIC_URL`. These are useful with Docker secrets, and the page then shows those fields as set by the server.
- **Government and China clouds:** set `TEAMDESK_AAD_AUTHORITY` (for example `https://login.microsoftonline.us`) and `TEAMDESK_GRAPH_URL`.
- **Signing out** of Team Desk does not sign you out of Microsoft.

### Data, server key and backups

```
<data folder>/            default ~/teamdesk-central-data   (Docker volume: /data)
  central.json            key check (contains no data)
  system.tde              accounts (passwords are salted scrypt hashes) and server settings
  org.tde                 organisation configuration
  managers/               each manager's personal settings and leadership notes
  reportees/              one encrypted file per reportee, tagged with its line manager
  exchange/               one encrypted file per feedback request or feedback between managers
  files/                  uploaded documents, per reportee
  audit/                  encrypted audit log, one file per month
  backups/                daily snapshots (last 30 days)

<server key>              default ~/.teamdesk/central.key   (Docker volume: /secrets)
```

- **The server key decrypts everything.** It is created on first start. **Back it up separately from the data.** Without it the data can't be read. With it, anyone holding a copy of the data can. You can supply it as `TEAMDESK_MASTER_KEY` (64 hex characters) from your secrets manager instead of a file.
- **Daily snapshots** of all records are taken automatically. An administrator can take one or restore one in **Administration › Server settings**. Restoring rolls back records and configuration for everyone, but not user accounts. Also include the data folder (and, separately, the key) in your normal server backups.

### Settings

| Option | Environment variable | Default |
| --- | --- | --- |
| `--port 8080` | `TEAMDESK_PORT` | 8080 |
| `--host 0.0.0.0` | `TEAMDESK_HOST` | all network interfaces |
| `--data <folder>` | `TEAMDESK_DATA_DIR` | `~/teamdesk-central-data` |
| `--key-file <file>` | `TEAMDESK_KEY_FILE` (or `TEAMDESK_MASTER_KEY`) | `~/.teamdesk/central.key` |
| `--tls-cert`, `--tls-key` | `TEAMDESK_TLS_CERT`, `TEAMDESK_TLS_KEY` | off |
| `--trust-proxy` | `TEAMDESK_TRUST_PROXY=1` | off |
| `--allowed-hosts teamdesk.company.com` | `TEAMDESK_ALLOWED_HOSTS` | any |
| — | `TEAMDESK_AAD_TENANT_ID`, `TEAMDESK_AAD_CLIENT_ID`, `TEAMDESK_AAD_CLIENT_SECRET`, `TEAMDESK_AAD_GROUP_ID`, `TEAMDESK_PUBLIC_URL` | Microsoft sign-in (otherwise set in Server settings) |
| — | `TEAMDESK_AI_URL` (an Ollama server elsewhere) | Ollama on the same machine |
| — | `TEAMDESK_NO_CDN=1` (never load the PDF/Word/Excel readers from public CDNs) | on automatically after `npm install` |

In the app, **Administration › Server settings** controls these:

- whether registration is open;
- which email domains may register (for example `company.com`);
- how long before idle people are signed out (30 minutes by default; sessions also end after 12 hours);
- whether people managers can read private notes;
- backups;
- the AI assistant.

### Everyday administration

- **Give access to people from Microsoft Entra ID** in **Administration › Microsoft directory**: search the group and set each person's role (see "Microsoft sign-in" above).
- **Approve or reject** registrations in **Administration › Users & access**.
- **Change groups.** Use **Edit** on an account. A line manager who still owns reportees can't lose the Line manager group until their reportees are moved.
- **Reset a password.** The person gets a temporary password (shown once) and must choose a new one when they sign in.
- **Disable an account** when someone leaves. They are signed out at once.
- **Move reportees** when someone changes manager or a manager leaves: **Administration › Reportee ownership**, select them, choose the new line manager, then **Move**. The full history moves with them, and the previous manager loses access. A "Reporting history" entry appears on their profile.
- **Forgot the administrator password?** On the server, run `node server/central.js --reset-password you@company.com --make-admin`. In Docker, run `docker compose exec teamdesk node server/central.js --reset-password you@company.com --make-admin`. It prints a temporary password.

### Moving from the personal edition

1. In the personal Team Desk, go to **Settings › Data & backups › Export all data**. The file is not encrypted, so keep it safe.
2. Sign in to the central server as a line manager and go to **Settings › My data › Import export file**. Your reportees, their documents and your leadership notes are added to your account.
3. An administrator can also choose to replace the organisation configuration with the one in the file.
4. Delete the export file afterwards.

### Demo data for the central server

Start the central server, then run one of the three demo setups from a second Terminal window. The password for every demo account is `TeamDesk@Demo1`.

| Setup | Command (or double-click) | Accounts |
| --- | --- | --- |
| **Case 1**: administrator + one user who is **both** line manager and people manager | `npm run demo:central:case1` (`Load Central Demo - Case 1`) | An administrator, and `kavya.menon@demo.example`. Kavya owns all six reportees and chooses a profile after signing in: Line manager (edit her team) or People manager (Organisation view, view only). |
| **Case 2**: administrator + one user who is **only** a line manager | `npm run demo:central:case2` (`Load Central Demo - Case 2`) | An administrator, and `kavya.menon@demo.example`. Kavya goes straight to her six reportees, with no profile choice and no Administration menu. |
| **Full**: every group, two teams | `npm run demo:central` (`Load Central Demo Data`) | `sanjay.kapoor@` (administrator), `anita.desai@` (line + people manager), `kavya.menon@` (line manager), `meera.pillai@` (people manager), `rahul.verma@` (waiting for approval). The six reportees are split between Anita and Kavya. |

**Accounts already exist** (your own administrator, line managers and people manager): no demo accounts are needed. There are **two separate demo teams**, with the same situations but different fictional people:

| Demo team | Reportees |
| --- | --- |
| **1** | Asha Rao (C2), Rohan Kulkarni (C3), Neha Iyer (S2), Priya Menon (C1), Vikram Singh (S1), Arjun Mehta (A2) |
| **2** | Divya Sharma (C2), Karthik Reddy (C3), Sneha Patil (S2), Ananya Ghosh (C1), Farhan Qureshi (S1), Nikhil Joshi (A2) |

Give each team to an existing line manager with `--email`:

```
node scripts/seed-central.js --admin-email admin@company.com --dataset 1 --email manager1@company.com
node scripts/seed-central.js --admin-email admin@company.com --dataset 2 --email manager2@company.com
```

- **Which line manager gets what:** you can give both teams to the same line manager, use only one team, or list several emails (`--email a@company.com,b@company.com`) to split one team.
- **People managers** see every team automatically in the Organisation view, view only.
- **Passwords and accounts:** only the administrator's password is asked for, and your accounts are not changed. A temporary "Demo Loader" account adds the reportees and is removed straight after. That's why their Reporting history shows "moved from Demo Loader".
- **Running it again** for a team refreshes it, and moves it if you give a different email.
- **Double-click version:** **`Load Central Demo - Existing Accounts`** asks for the administrator, the team and the line manager.
- **To remove one team,** add `--remove --dataset 2`. To remove all demo data, use `--remove` alone. Add `--admin-email` to either.
- **If registration is closed or limited to certain email domains,** open it for a minute in **Administration › Server settings**, or add `--domain company.com`.

**The administrator account:**

- **On a new server with no accounts,** the demo creates the administrator for you: `sanjay.kapoor@demo.example`, an administrator with no reportees.
- **If you already registered yourself,** your account is the administrator, and no demo administrator is created. Add your email to the command and it will ask for your password, for example:

  ```
  node scripts/seed-central.js --scenario both --admin-email you@company.com
  ```

**Switching and options:**

- **To switch setups,** just run another one. The demo reportees move to the right manager, and demo accounts the new setup doesn't use are removed.
- **If the server isn't on port 8080,** add `--url http://localhost:<port>`.
- **If the server already has real reportees,** the loader refuses to run. Use a separate demo server instead.
- **To remove everything demo,** run `node scripts/seed-central.js --remove`, adding `--admin-email you@company.com` if you used your own account.

## 10. Coming from the browser-only version (v1/v2)

In the old `TeamDesk.html`, go to **Settings › Export backup**. Then in Team Desk 3, use the import option during set-up, or **Settings › Data & backups › Import backup file**.

## 11. Updating Team Desk

Replace this program folder with the new version. Your data folder is separate and is never touched by an update. Team Desk remembers which data folder to use in `~/.teamdesk/config.json`.

## 12. Keeping the code in git

The repository should contain **only the program**, never your data. Two files take care of this:

- **`.gitignore`** keeps these out of git:
  - the data folder and anything encrypted (`TeamDesk Data/`, `*.tde`, `vault.json`, `backups/`);
  - exports and downloads (competency matrices, feedback questionnaires and responses, old-version backups);
  - office documents (`.xlsx`, `.docx`, `.pdf`, `.csv`) dropped into the folder by mistake;
  - `node_modules/`, zip builds, logs, `.env` files, and editor or operating-system clutter.
- **`.gitattributes`** fixes line endings: `Start Team Desk.bat` keeps Windows (CRLF) line endings and `Start Team Desk.command` keeps Mac (LF) line endings, so both launchers still work after a clone.

Keep your data folder **outside** this program folder, for example in `Documents/TeamDesk Data`. Then it can't end up in a commit even by accident. The same goes for the central server's data folder and its key. `.gitignore` also excludes `teamdesk-central-data/`, `*.key`, TLS certificates and unencrypted `TeamDesk_export_*.json` files.

To check what will be committed before pushing:

```
git status --short
git status --ignored --short   # lines starting with !! are ignored
```

`app/js/framework-default.js` contains your organisation's competency matrix, built in as the default. If the repository will be shared outside your organisation, remove that file or make the repository private. Team Desk works without it: you then upload the matrix under **Configuration › Competency framework**.

## 13. Troubleshooting

- **"Team Desk server isn't running"**: start it with the launcher, then reload the page.
- **Port already in use**: Team Desk automatically tries the next ports (4318, 4319, …). The terminal window shows the address it's using.
- **Mac asks for access to Documents or Desktop**: allow it. Without it, Team Desk can't save to a data folder there.
- **Forgot your password**:
  - Personal edition: the data can't be decrypted. Start again with a new data folder.
  - Central server: an administrator resets it under **Users & access**.
- **Central server says the key doesn't match the data**: start it with the key that was created together with that data folder (`--key-file` or `TEAMDESK_KEY_FILE`).
- **Everyone was signed out at once**: the central server was restarted. Sign in again; nothing saved is lost.
- **"Microsoft sign-in didn't complete"**: open **Administration › Server settings › Test connection**. Check that the redirect URI in the app registration exactly matches the one Team Desk shows, and that the client secret hasn't expired. Microsoft's own error text appears in the audit log as "Microsoft sign-in failed".
- **People can't register**: an administrator may have closed registration, or limited it to certain email domains, in **Administration › Server settings**.
