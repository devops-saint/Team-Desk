# Team Desk — Demo Talk Track

**For:** a large audience — senior leadership, HR / People team, line managers and other stakeholders
**Version:** Team Desk 1.0.0
**Full demo:** about 35 minutes + questions · **Short demo:** 12 minutes (see the end)

---

## How to use this document

- **CLICK** = what you do on the screen.
- **SAY** = what you speak. Use it as a guide, not word for word. Speak slowly and naturally.
- Time against each part is approximate. If time is short, skip the parts marked *(optional)*.
- All names in the demo data are fictional. Please say this once at the start.

---

## Before the demo (15 minutes of preparation)

### 1. Accounts you need

| Account | Profile | Used for |
|---|---|---|
| Administrator | Administrator | Part 9 — administration |
| Your main demo user | Line manager **and** People manager | Most of the demo |
| One more manager (optional) | Line manager | Answering a feedback request live in Part 5 |

Sign in with **Microsoft** for every account. If you don't have a second manager account, you can still show sending a request; just skip the live answer.

### 2. Load the demo team

With the Team Desk server running, open Terminal in the Team Desk folder and run:

```
node scripts/seed-central.js --admin-email ADMIN_EMAIL --dataset 1 --email YOUR_DEMO_USER_EMAIL
```

This gives your demo user six fictional reportees with 3–4 months of history:

| Reportee | Grade | What they help you show |
|---|---|---|
| Arjun Mehta | A2 | New joiner, probation, pending mandatory training |
| Priya Menon | C1 | Morale going down, no 1:1 this month |
| Asha Rao | C2 | Outside job offer, repeated blocker, certification, leave clash |
| Rohan Kulkarni | C3 | Improvement plan, self vs manager rating gaps |
| Vikram Singh | S1 | Star performer, ready for promotion, mentoring |
| Neha Iyer | S2 | High performer, thought leadership, conference |

### 3. Prepare the anonymous team feedback (for Part 6)

Go to **My leadership › Team feedback (anonymous)**. Click **Paste text** three times and paste the three sample answers given in the **Appendix** at the end of this document. Results show only after three responses, so do this before the demo.

### 4. Keep the sample feedback files ready (for Part 4, document upload)

Four ready-made files are in `documentation/demo-files/` — one each for Asha (Word), Rohan (PDF), Priya (text) and Vikram (Excel). Their README says what Team Desk will find in each. For the live demo, use **`Asha_Rao_Client_Feedback.docx`**.

### 5. Screen set-up

- Use two browser windows: one signed in as your demo user, one private/incognito window for the administrator.
- Browser zoom 100%. Close other tabs. Turn off notifications.
- Sign in as the demo user and choose the **Line manager** profile.

---

## Part 1 — Opening: why we built this (3 minutes)

**CLICK:** Nothing yet. Keep the Home page open.

**SAY:**
> "Good morning everyone, and thank you for your time.
>
> Let me start with a simple question. Where does a manager keep information about their team today?
> 1:1 notes are in a notebook. Feedback is in some email. Goals are in one Excel. Competency ratings are in another Excel from HR. Leave is in a WhatsApp message.
>
> So when the review time comes, the manager spends hours searching and copy-pasting. And honestly, many good things the person did in April are forgotten by October.
>
> Also, every manager does it differently. One manager does proper 1:1s every month, another does it once a quarter. There is no consistency.
>
> So we built **Team Desk**. One place where a line manager manages everything about their people: 1:1s, feedback, goals, competencies, development, reviews. And for HR and leadership, a clear view across teams.
>
> Today I will show you the full journey, step by step. All the names you will see are dummy data, not real employees."

---

## Part 2 — Signing in and who sees what (3 minutes)

**CLICK:** Sign out, then show the sign-in page with **Sign in with Microsoft**.

**SAY:**
> "First, sign-in. There is no new password to remember. We use our same **Microsoft login**, the one we use for Outlook and Teams. So our company's MFA and security rules apply automatically.
>
> And only people who are given a role by the administrator can enter. Anybody else gets stopped at the door."

**CLICK:** Sign in. When asked, show the **profile choice** screen.

**SAY:**
> "There are three roles:
> - **Line manager** — sees only their own team. Nobody else's.
> - **People manager** — this is for HR and leadership. They can see all teams, but only view. They cannot change anything.
> - **Administrator** — manages access and settings. Very important: the administrator **cannot see** any employee's records.
>
> I am in both Line manager and People manager groups, so it asks me which hat I want to wear today. Let me choose Line manager first."

**CLICK:** Choose **Line manager**.

---

## Part 3 — Home: my morning view (4 minutes)

**CLICK:** You land on **Home › Dashboard**. Point to the left menu.

**SAY:**
> "This is the home page. See the left side, very clean: Home, People, Feedback, Insights, My leadership, Configuration. When I click any of these, it opens that area with its options. Nothing is crowded.
>
> Now the dashboard. Only four numbers on top:
> - How many 1:1s are done this month.
> - How many open action items, and how many are overdue.
> - How many things need my attention.
> - How many competency assessments are done this cycle."

**CLICK:** Point to **Top priorities**.

**SAY:**
> "Below, **Top priorities**. The tool has gone through every person's records and tells me the most important things. Red means act now, amber means soon.
> For example, Asha has suggested actions waiting, her goal is at risk. I click, and it takes me straight to the right page."

**CLICK:** Point to **This week**.

**SAY:**
> "On the right, **This week**: which 1:1s are still pending, planned 1:1s, action due dates, birthdays, leave. Small things, but people feel good when the manager remembers."

**CLICK:** Click **Needs attention** in the bar at the top.

**SAY:**
> "If I want the full list, **Needs attention** shows everything, grouped person by person. I can filter: only 'act now', or everything. And on the right, whose 1:1 is still pending this month, with a 'Prepare' button."

**CLICK:** Click **Upcoming & actions**, then the **Team leave** tab.

**SAY:**
> "**Upcoming & actions**: next 30 days, all action items, and team leave. See here — two people are on leave the same week. As a manager I can plan the cover in advance, not at the last minute."

**CLICK:** Click **Quick note** in the top bar. Pick Asha, type *"Handled the client escalation very calmly today"*, save.

**SAY:**
> "And this **Quick note** button is my favourite. Something good happens in a meeting — ten seconds, it goes into her feedback log. No waiting for the 1:1."

---

## Part 4 — People: one reportee, the full journey (10 minutes)

### 4.1 The reportee list and adding a person

**CLICK:** Click **People**. Then **Add reportee**, show the form and the calendar on a date field, then **Cancel**.

**SAY:**
> "Here is my team. Adding a new person is simple: only the name is mandatory, rest I can fill later — grade, role, date of joining, career aspirations.
> The **grade** is important, because our company's **competency matrix** is built in, and everything is compared with what is expected at that grade."

### 4.2 The reportee workspace

**CLICK:** Open **Asha Rao**. Point to the left side menu inside her page.

**SAY:**
> "This is Asha's workspace. Everything about Asha is here, nicely grouped:
> Summary, Connect — that is 1:1s, actions and leave — then Assess, Talent, Develop, Records and Review.
> One topic per page. Not everything dumped on one screen.
>
> The **Overview** tells me, for Asha specifically, where to focus."

### 4.3 Prepare for the 1:1

**CLICK:** Click **Prepare next 1:1**.

**SAY:**
> "Before I meet Asha, I click **Prepare next 1:1**. The tool makes my agenda:
> what I promised last time, what she promised, the blocker she raised, topics due this quarter like career and certifications, her upcoming leave, and suggested questions.
> So in two minutes I am fully prepared."

### 4.4 The guided 1:1

**CLICK:** Click **Start 1:1**. Show the **Guided questions** tab and the topic list.

**SAY:**
> "Now the most important part — the **guided 1:1**. Instead of 'how are you, all good?', there is a proper question bank: wellbeing, workload, project status, learning, career, leave, and also feedback for me as a manager.
> Some topics come every month, some every quarter. The tool marks when they are due, so career talks don't get missed for six months."

**CLICK:** In Wellbeing, choose score **2** and workload **Too heavy**. Point to the "Last time" hint.

**SAY:**
> "See this small text — 'Last time'. It shows what she said last month. So I can say, 'Last month you told me workload is heavy, how is it now?' She feels I actually remember. That builds trust."

**CLICK:** Fill a few quickly:
- **Project & work status:** status *Some risks*, blocker: *"Waiting on client for VPN access since last week"*
- **Certifications:** *"SnowPro Core exam booked on 20 Nov"*
- **Leave & availability:** *"On leave 24–28 Nov for my sister's wedding"*
- **Notes** tab: *"I got an offer from another company but I'd prefer to stay if growth is possible."*

**CLICK:** Click **Save 1:1**.

### 4.5 Suggested actions — the intelligence

**CLICK:** The suggestions window opens. Scroll slowly.

**SAY:**
> "Now see this. The moment I save, the tool reads everything and tells me **what I should do as a manager**:
> - Wellbeing 2 out of 5 — check in on her wellbeing.
> - Workload too heavy — rebalance the work.
> - VPN blocker — help remove it.
> - Exam on 20th November — add it to her development plan.
> - Leave 24 to 28 November — it picked the dates by itself.
> - And the big one — she mentioned an outside offer, so it flags **flight risk** and asks me to have a **stay conversation**.
>
> Each suggestion shows *why*, with her own words.
>
> But one important thing — **the tool does not do anything on its own**. I am the manager, I decide. I can change, accept or dismiss each one."

**CLICK:** Click **Accept selected**. Quickly show **Action items** and **Talent & retention**.

**SAY:**
> "Done. Actions created, leave recorded, flight risk updated, certification added. All in 30 seconds.
> And it also catches patterns. If next month she says the same blocker again, it will say 'same blocker two times — escalate'."

### 4.6 Document upload

**CLICK:** In Asha's menu open **Records › Documents**, click **Upload files**, choose `Asha_Rao_Client_Feedback.docx`. Show the placing window, then **Place selected**. Then show the suggested actions.

**SAY:**
> "Many times we get documents — client feedback, peer feedback, self-assessment. Here is a feedback mail from Asha's client, saved as a Word file. I just upload it under Asha.
> See — it reads the document and splits it into points: the Snowflake migration and the time saving are **achievements**, her technical knowledge is a **strength**, delayed updates and stakeholder communication are **improvement areas**, and SnowPro is **learning**. I choose where each point goes.
> Then it tells me what to do as a manager: **recognise** her achievement, **address the concern** the client raised about the steering meeting, **review the delivery risk**, and **support her certification**.
> PDF, Word, Excel, text — all work. And the file is stored only under Asha, encrypted."

### 4.7 Competencies, skills and KPIs *(optional — 2 minutes)*

**CLICK:** Open **Competencies**, then **Technical skills**, then **KPIs**.

**SAY:**
> "Our competency matrix is built in. For each competency it shows what is expected at **her grade**. Her self-rating and my rating side by side, on a 1 to 5 scale.
> And one click downloads it **in the same Excel format HR gives us**. No copy-paste at appraisal time.
> Technical skills are rated against role targets, and KPIs give a weighted score."

### 4.8 Talent, goals, development and improvement plan *(optional — 2 minutes)*

**CLICK:** **Talent & retention** (9-box, flight risk, stay conversations), then **Goals**, **Development plan**, **Improvement plan**.

**SAY:**
> "The 9-box — performance versus potential — with a suggested action for each box. Flight risk with the reason. And **stay conversations** — good questions to ask before somebody resigns, not after.
> Goals are weighted and flow into the review. The development plan is linked to competency gaps.
> And if someone is really struggling, there is a fair, documented improvement plan with check-ins."

### 4.9 Half-yearly review and the report

**CLICK:** Open **Half-yearly review**. Then click **Report** at the top of Asha's page. Show PDF / Word / Excel, the period and the sections. Download the PDF and open it.

**SAY:**
> "At review time, everything comes together automatically — goals, competencies, KPIs, 1:1s, feedback, development. I just write the rating and comments.
>
> And many times HR asks, 'Please send everything about Asha before the promotion discussion.' Earlier, one hour of copy-paste. Now — **Report**. PDF, Word or Excel. I choose the period and sections.
> See this box — 'Include private notes'. By default it is **off**, so private notes never go out by mistake. And the report has only Asha's data, nobody else's."

---

## Part 5 — Feedback from other managers (5 minutes)

### 5.1 Request feedback

**CLICK:** Open **Asha Rao › Feedback log**. Click **Request feedback**. In **Ask**, type part of the other manager's name and pick them. Show the editable questions. Click **Send request**.

**SAY:**
> "Many times our people work with other teams — on a project, a release, a client. Their view is very valuable for the review.
> So from Asha's feedback log I click **Request feedback**, search the manager by name — the same names as in our Microsoft directory — and send three simple questions. I can change the questions if I want.
> The other manager only sees Asha's name and my questions. They **cannot** see her record."

### 5.2 The other manager answers *(only if you have a second account)*

**CLICK:** In the other window, sign in as the second manager. Show the **bell** with the red count. Click it, open the request, type 2–3 lines (one positive, one suggestion), **Send feedback**.

**SAY:**
> "The other manager gets a notification here, on the bell. They write their feedback inside the portal and send. No emails going around."

### 5.3 How it lands in the log

**CLICK:** Back as the demo user, reload. Open **Asha › Feedback log**. Then **Feedback › Received for your team**.

**SAY:**
> "See — the answer is already in Asha's feedback log, and automatically sorted into **Appreciation**, **Improvement** and **Other**. With the giver's name and date.
> So at review time I have real examples from people who worked with her."

### 5.4 Give feedback without being asked

**CLICK:** Click **Feedback** in the left menu. Show the option cards. Click **Give feedback**.

**SAY:**
> "And it works the other way also. If someone from another team did something great for my team, I don't need to wait for a request. **Give feedback**, search the person, write, send. Their line manager is notified immediately.
> Good work should be noticed, even across teams."

---

## Part 6 — My leadership: assessing myself (4 minutes)

**CLICK:** Click **My leadership**. Show the four option cards. Open **Habits scorecard**.

**SAY:**
> "Now, this part is about **me as a manager**. Not only my team.
> The **Habits scorecard** is calculated from my own records: am I doing 1:1s regularly, am I closing my actions, am I recognising people, does everybody have goals and a development plan. No hiding here."

**CLICK:** Open **Self-assessment**, then **Upward feedback** briefly.

**SAY:**
> "I rate myself on 12 manager competencies. And upward feedback — my team rates me anonymously, and it shows my **blind spots**, where the team sees me differently from how I see myself."

**CLICK:** Open **Team feedback (anonymous)**. Show **Edit questions**, the **Word form** and **Excel form** buttons, then the results.

**SAY:**
> "And this is a simple one. I can ask my team open questions — about me, and about our process: planning, stand-ups, hand-offs.
> I download a **Word or Excel form** — it has no name field — and share it with the team. They fill it and put it back in a shared folder.
> I upload the forms here. The tool reads only the answers — not the file name, not who saved the file — and the files are not kept.
> Every sentence is sorted into **Appreciation**, **Improvement** and **Other**. And it shows nothing until at least three people reply, all mixed up, so nobody can be identified.
> Honestly, this is how a manager grows."

---

## Part 7 — Insights: patterns across the team (3 minutes)

**CLICK:** Click **Insights**. Show the six option cards.

**SAY:**
> "Insights shows patterns across my whole team. Six views — let me show two or three."

**CLICK:** Open **Competency map**, then use the top bar to open **Talent & succession**, then **Calibration**.

**SAY:**
> "**Competency map** — the whole team's ratings in one grid. Gaps jump out immediately, so I know where to plan training for the team.
> **Talent & succession** — the 9-box for the whole team, and who is ready for the next role.
> **Calibration** — review ratings side by side, so ratings are fair and consistent before we finalise.
> And **Team report** gives a one-page monthly summary I can share with my own manager."

---

## Part 8 — The People manager view: for HR and leadership (3 minutes)

**CLICK:** In the left menu click **Switch profile**, choose **People manager**.

**SAY:**
> "Now let me wear the second hat — **People manager**. This is the view for HR and leadership."

**CLICK:** Show **Home › Organisation**. Then **People › Line managers**. Click one manager's row, then open one reportee.

**SAY:**
> "This is the organisation view. Number of line managers, how many 1:1s are on schedule across the company, urgent items, flight risk, and a talent snapshot.
> Under **Line managers**, every team at a glance — 1:1s, goals, assessments, overdue actions, morale, risks. Click any team and see their people.
> I can open any record and download a report — but see the top: **View only**. People managers cannot change anything.
> And by default, the line manager's **private notes are hidden** from this view. And every time I open someone's record or download a report, it is recorded in the audit log."

---

## Part 9 — Administration: access and safety (3 minutes)

**CLICK:** In the private window, sign in as the **administrator**. Show the **Administration** option cards.

**SAY:**
> "Last part — administration. The administrator manages access, not people's data."

**CLICK:** Open **Microsoft directory**. Search a name. Show **Give access** and the role choices. Then **Cancel**.

**SAY:**
> "To give someone access, I search their name from our Microsoft directory, choose the role — line manager or people manager — done. When someone leaves the company and is removed from the Microsoft group, they are blocked automatically."

**CLICK:** Open **Reportee ownership**, then **Audit log**.

**SAY:**
> "When someone changes team, the admin moves the reportee to the new manager here. The **full history moves with the person**, and the old manager loses access immediately.
> And the **Audit log**: who signed in, who viewed whose record, who downloaded which report, every access change. So if anyone asks, 'who looked at my data?', we have the answer."

**SAY (security in simple words):**
> "Since this is about people's data, security was the first priority:
> - It runs on **our own server**. No outside cloud, and no data goes outside the company.
> - All data is **encrypted**, and the encryption key is kept separately from the data.
> - Sign-in is only through **Microsoft**, with our MFA.
> - Each manager sees only their own team — this is checked by the server itself, not just hidden on the screen.
> - The optional AI also runs on our own server. Nothing goes to any outside AI service.
> - The detailed security document has been shared with our IT and security team for review."

---

## Part 10 — Closing (2 minutes)

**CLICK:** Go back to **Home**.

**SAY:**
> "So, to sum up.
> For **line managers** — one place for everything about their people. Better 1:1s, less time on paperwork, and a review that writes itself from real examples.
> For **employees** — more regular, more meaningful conversations, and fair reviews based on facts, not memory.
> For **HR and leadership** — a clear and consistent view across teams, and reports in one click.
> And all of this is safe, inside our own environment.
>
> Next step, we would like to start with a small pilot group of managers, take their feedback, and then roll it out.
>
> Thank you. Happy to take questions."

---

## Likely questions and simple answers

| Question | Simple answer |
|---|---|
| Can my manager or HR read my private notes? | No. Private notes are hidden from people managers by default. Only the administrator can change this setting, and only if HR policy needs it. |
| Can one line manager see another team? | No. The server checks it on every request. Even if someone tries a direct link, it is refused. |
| Can the administrator see employee records? | No. Administrators manage access and settings only. They have no team and cannot open records. |
| Where is the data stored? | On our own company server, encrypted. Nothing goes to any outside cloud. |
| Does the AI send our data outside? | No. AI is optional, off by default, and runs only on our own server. |
| What happens when an employee moves to another team? | The admin moves them. The full history goes to the new manager, and the old manager loses access the same moment. |
| What happens when a manager leaves the company? | Their Microsoft account is removed from the group, so they can't sign in. The admin moves their team to the new manager. |
| Is the team feedback really anonymous? | The form has no name, the tool reads only the answers, files are not kept, and nothing shows until at least three people reply. We only ask people to return forms through a shared folder, not by direct email. |
| Can we use our own HR competency template? | Yes. The matrix is built in, and the download comes in the same Excel format HR uses. |
| How long does it take a manager to learn? | About 15 minutes. If you can use Outlook, you can use Team Desk. |
| Is there a mobile view? | Yes. It works in the phone's browser too. |

---

## Short demo (12 minutes)

Use this when you have only a short slot.

1. **Opening** — Part 1, first two paragraphs only. *(1 min)*
2. **Sign-in and roles** — Part 2, roles explanation only. *(1 min)*
3. **Home dashboard** — Part 3, the four numbers and Top priorities. *(1.5 min)*
4. **Guided 1:1 and suggested actions** — Parts 4.4 and 4.5. *(4 min)*
5. **Report in one click** — Part 4.9, the report only. *(1 min)*
6. **Feedback from other managers** — Part 5.1 and 5.3. *(1.5 min)*
7. **People manager view** — Part 8. *(1 min)*
8. **Security in simple words and closing** — end of Part 9 and Part 10. *(1 min)*

---

## Tips for a smooth demo

- Do one full practice run the day before, on the same laptop and network.
- Speak to the audience, not to the screen. Pause after each "magic moment" (suggested actions, report download, feedback sorting) and let people see it.
- If something doesn't load, just say "let me refresh" and press Cmd+R — your work is saved automatically.
- Keep the demo user's 1:1 for Asha unsaved until the demo, so the suggested actions appear fresh.
- After the demo, remove the demo team: `node scripts/seed-central.js --admin-email ADMIN_EMAIL --remove --dataset 1`

---

## Appendix — sample answers for the anonymous team feedback

Use **My leadership › Team feedback (anonymous) › Paste text**. Paste each block separately (three responses).

**Response 1**
```
Q1. What do I do as your manager that helps you most?
You always make time for 1:1s and you back us in client escalations.

Q2. What should I start doing, or do differently?
Could share roadmap changes earlier, ideally before sprint planning.

Q3. Is there anything I should stop doing?
Stop rescheduling 1:1s at the last minute.

Q5. How well do our team processes work for you?
Stand-ups run too long and hand-offs to QA are unclear.
```

**Response 2**
```
Q1. What do I do as your manager that helps you most?
Great support during the audit. Thank you for the honest feedback on my design doc.

Q2. What should I start doing, or do differently?
More visibility on how promotion decisions are made would help.

Q5. How well do our team processes work for you?
Planning works well. Retros feel repetitive.

Q7. Is there anything else you would like me to know?
Workload has been heavy this quarter.
```

**Response 3**
```
Q1. What do I do as your manager that helps you most?
You are approachable and calm under pressure.

Q2. What should I start doing, or do differently?
Please delegate more design decisions to the team.

Q6. What is working well in how our team works together?
Collaborative and supportive.
```
