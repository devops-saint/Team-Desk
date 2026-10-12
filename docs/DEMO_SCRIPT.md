# Team Desk — Demo Script

**Version:** 3.1 · **Full demo:** about 25 minutes · **Short demo:** 8 minutes (see the end)

How to use this script:

- **DO** = what you click on screen.
- **SAY** = what you speak. Use it as a guide, not word for word. Talk naturally.
- The time against each part is approximate.

---

## Before the demo (10 minutes of preparation)

1. **Use a separate demo data folder, not your real one.**
   - In Team Desk, go to **Settings › Data & backups › Open a different data folder**.
   - Choose an empty folder like `Documents/TeamDesk Demo`. Set a simple password you will remember.
   - Your real data stays untouched. Switch back the same way after the demo.
2. **Create three sample reportees** with dummy names. Never use real names in a demo.
   - *Asha Rao*: Senior Data Engineer, Grade C2. She will show most of the features.
   - *Vikram Singh*: Data Engineer, Grade S1.
   - *Priya Menon*: Associate Engineer, Grade C1.
3. For Asha, log **one older 1:1** dated last month, with a couple of answers filled. Then today's "Last time" hints will show.
4. For Asha, add **one goal** due in about six weeks.
5. Give Vikram **one leave entry** next month, so the team-leave overlap shows.
6. Keep a small text file ready called `asha_peer_feedback.txt`, with these lines:
   ```
   Peer feedback for Asha Rao
   She was a bit rude to the client in Tuesday's call and we missed the deadline for the data model.
   She successfully automated the reconciliation job, saving 6 hours every week.
   She wants to learn more about Snowflake performance tuning.
   ```
7. **Optional, for the AI part:** keep Ollama running with a model pulled, for example `ollama pull llama3.1:8b`. Then turn it on in **Settings › AI assistant** and click **Test** once, so the model is already loaded.
8. Close other tabs. Keep the browser zoom at 100%. Keep the Team Desk terminal window minimised, not closed.

---

## 1. Opening: the problem (1 minute)

**SAY:**
> "Good morning everyone. Thank you for the time.
> So, as managers, all of us have this problem. We have 6, 8, 10 reportees, and each person's details are everywhere: some in Excel, some in OneNote, some in WhatsApp, some only in our head. Then appraisal time comes and we are struggling to remember what happened in April or May.
> And second problem: 1:1s become very routine. 'How are you? All good? Okay, fine.' Important signals get missed. Someone is stressed, someone is getting an outside offer, someone is blocked for three weeks, and we come to know very late.
> So I built a small tool called **Team Desk**. It is one place to manage everything about our reportees, and it also tells us what action we should take. Let me show you."

---

## 2. Privacy first: how it runs (2 minutes)

**DO:** Show the Team Desk folder, then the terminal window that's running.

**SAY:**
> "First thing, because this is HR data, privacy is the most important point.
> This is not a website on the internet. It runs **only on my laptop**. I double-click this launcher, a small local server starts, and it opens in my browser. Same thing works on Mac and Windows. It only needs Node.js, nothing else.
> Nothing goes to any cloud. No login to any external system."

**DO:** Lock the app (sidebar › **Lock Team Desk**), then unlock it with the password.

**SAY:**
> "At first-time setup, it asks me two things: which folder to keep the data in, and a password.
> Everything is **encrypted with my password**. If somebody opens the folder, they will see only encrypted files, nothing readable. And it auto-locks after 15 minutes if I walk away from my desk.
> One more important thing: **each reportee is stored in a separate encrypted file**. Asha's data never mixes with Vikram's data. When I export something for Asha, it contains only Asha. No cross-sharing at all."

---

## 3. Dashboard: my morning view (2 minutes)

**DO:** Click **Dashboard**.

**SAY:**
> "This is the first screen I see every morning. Very simple.
> On top: how many reportees I have, how many 1:1s are done this month, open action items, how many competency assessments are pending, and my own leadership-habits score. I'll explain that later.
> Below, **Needs your attention**. The tool has gone through everybody's records and is telling me: Asha has a blocker, Priya has no 1:1 this month, Vikram has no goals set. Red means act now, amber means soon.
> On the right, the 1:1 status for this month. From here itself I can prepare for or log a 1:1."

**DO:** Click **Upcoming & actions**, then the **Team leave** tab.

**SAY:**
> "Here I see what's coming in the next 30 days: goal due dates, planned 1:1s, action items, leave.
> And **Team leave**. See, Asha and Vikram are both on leave the same week. As a manager I can plan cover in advance, instead of a surprise at the last minute."

---

## 4. Adding a reportee and the calendar (1 minute)

**DO:** Click **Add reportee**. Show the tabs. Click **Date of joining** to open the calendar.

**SAY:**
> "Adding a reportee is simple. Only the name is mandatory, the rest I can fill later.
> Employment details, grade, role, contact, and background and aspirations.
> All dates have a proper calendar, no typing of dates. Shortcuts like 'Today', 'one week ago' are there.
> The **grade** is important, because our company's competency matrix is built in, and everything is compared against what is expected at that grade."

**DO:** Click Cancel.

---

## 5. The reportee workspace (1 minute)

**DO:** Open **Asha Rao**. Point to the left-side menu.

**SAY:**
> "This is Asha's workspace. On the left, everything is organised into groups:
> - **Summary**: the overview and suggested actions.
> - **Connect**: 1:1s, action items and leave.
> - **Assess**: competencies, technical skills and KPIs.
> - **Talent**: 9-box and retention.
> - **Develop**: goals, development plan, feedback and improvement plan.
> - **Records**: profile and documents.
> - **Review**: half-yearly review.
>
> One topic per page. Not everything dumped on one screen."

**DO:** Show **Overview**.

**SAY:**
> "The Overview tells me, for Asha specifically, where I should focus: low morale, goal at risk, no recognition in 60 days, like that. Each item has an 'Open' button that takes me straight to the right page."

---

## 6. Prepare for the 1:1 (1.5 minutes)

**DO:** Click **Prepare next 1:1**.

**SAY:**
> "Before I meet Asha, I click **Prepare next 1:1**. The tool builds the agenda for me:
> - What I promised last time, and what she promised.
> - What concern or blocker she raised last time.
> - Signals I should explore.
> - Which quarterly topics are due, like career and certifications.
> - Upcoming leave and deadlines.
> - And **suggested questions**, like 'Has the blocker you raised last time been resolved?'
>
> So I walk into the meeting fully prepared, in two minutes."

**DO (if AI is on):** Click **Suggest questions with AI**.

**SAY:**
> "And if I want, a local AI model running on my laptop gives me more personalised questions. Again, nothing goes outside the laptop."

**DO:** Click **Start 1:1**.

---

## 7. The guided 1:1: question bank (4 minutes)

**DO:** Show the **Guided questions** tab, with the topic list on the left.

**SAY:**
> "This is the heart of the tool: the **guided 1:1**. Instead of 'how are you, all good', I have a proper question bank covering everything:
> - wellbeing and workload, project status, technical, goals;
> - self-learning, org-level trainings and presentations, wins and recognition;
> - planned leave, admin things like timesheets and mandatory trainings;
> - and, very important, feedback for me as a manager.
>
> These come **every month**. Some topics, like certifications, org contributions, career and team culture, come **every quarter**. When they are due, the tool marks them 'due', so I don't forget career discussions for six months."

**DO:** In Wellbeing, click **2** for the score and choose **Too heavy** for workload. Point to the "Last time" hint.

**SAY:**
> "See this small text: 'Last time: ...'. It shows what she said last month. So I can say, 'Last month you said workload was heavy, how is it now?' She feels that I actually remember, and that builds trust."

**DO:** Fill a few topics quickly:
- **Project & work status:** status *Some risks*. Blockers: *"Waiting on client for VPN access since last week"*.
- **Certifications:** *"SnowPro Core, exam booked on 20 Nov"*.
- **Trainings & presentations:** planned: *"Demo on dbt to the data guild on 5 Dec"*.
- **Leave & availability:** *"On leave 24–28 Nov for my sister's wedding"*.
- **Feedback for me:** *"More visibility on upcoming priorities would help"*.

**DO:** Open the **Notes** tab and type:
*"I got an offer from another company but I'd prefer to stay if growth is possible."*

**SAY:**
> "Apart from the questions, I have free notes too: concerns, support needed, career discussion, and private notes only I can see."

**DO:** Open the **Coaching (GROW)** tab.

**SAY:**
> "For coaching conversations we follow the **GROW** model: Goal, Reality, Options, Way forward. One click converts the 'way forward' into an action item."

**DO:** Open the **Leave** tab, then **Actions & wrap-up**.

**SAY:**
> "Leave can be entered here directly. Action items from last time are **carried forward automatically**, so nothing gets lost. Morale and the next 1:1 date are here too. Now I save."

**DO:** Click **Save 1:1**.

---

## 8. Suggested actions: the "intelligence" (4 minutes)

**DO:** The review window opens. Scroll slowly through it.

**SAY:**
> "Now see the magic. The moment I save, the tool has read everything Asha said and is telling me **what action I should take as a manager**:
> - Wellbeing 2 out of 5: **check in on her wellbeing**, with guidance on how to have that conversation.
> - Workload too heavy: **rebalance the workload**.
> - Waiting for VPN access: **help her remove the blocker**.
> - SnowPro exam on 20 November: it caught the date and suggests a **development plan item for the certification**.
> - Demo on 5th December: **support her session**.
> - Leave 24 to 28 November: it read the dates itself and suggests recording the leave.
> - And the important one. She mentioned an outside offer, so it is flagging a **possible flight risk** and asking me to have a **stay conversation**.
>
> Each suggestion shows *why*, with her exact words as evidence."

**DO (if AI is on):** Point to the AI summary box at the top.

**SAY:**
> "This box is from the local AI. It gives a short summary, like 'stretched, has an external offer, growth is the main driver', plus extra suggestions the rules may not catch."

**DO:** Change one suggestion's "Place as" dropdown, set a due date, and dismiss one.

**SAY:**
> "Important: **the tool does not do anything by itself**. I am the manager, I decide. I can edit the text, change where it goes (my action, her action, development plan, goal, feedback, leave, flight risk), set a due date, or dismiss it. Whatever I don't decide now stays in her **Suggested actions** list for later."

**DO:** Click **Accept selected**. Then show **Action items**, **Leave & availability** and **Talent & retention** quickly.

**SAY:**
> "See: action items created, leave recorded, flight risk updated to Medium, certification added to her development plan. All in about 30 seconds."

**SAY (pattern detection):**
> "And it also notices patterns across months. If next month she says she is still blocked on the same thing, it will say **'Same blocker two meetings running, escalate'**. If morale drops from 4 to 2, it tells me immediately."

---

## 9. Document upload and analysis (2 minutes)

**DO:** Go to **Documents**, click **Upload files** and choose `asha_peer_feedback.txt`.

**SAY:**
> "Sometimes we receive documents: self-assessments, peer feedback, client feedback. I just upload them here, under that reportee only. PDF, Word, Excel or text all work."

**DO:** The **Place insights** window opens. Show it, then click **Place selected**.

**SAY:**
> "First, it splits the document into points (strengths, improvement areas, achievements, learning) and asks me where to file each one."

**DO:** The suggested-actions window opens.

**SAY:**
> "Then it tells me what action to take: the rude-to-client comment means **address a relationship concern**; the missed deadline means **review delivery risk**; the automation achievement means **recognise it**; and Snowflake tuning means **add a learning plan**.
> If a document mentions another reportee's name, it warns me before filing anything, so nothing goes into the wrong person's record."

**SAY (competency matrix files):**
> "And if a reportee sends back our company's competency matrix Excel, already filled with their self-ratings, I upload it and it directly imports their self-assessment."

---

## 10. Assessment: competencies, skills and KPIs (3 minutes)

**DO:** Open **Competencies**.

**SAY:**
> "This is our company's **competency matrix**, built in: 15 competencies across 4 groups, grades A2 to P2.
> For each competency it shows exactly **what is expected at Asha's grade**, C2, and I can peep at the next grade too. Her self-rating and my rating sit side by side, on the 1, 2, 3, X scale, with comments as evidence."

**DO:** Click the **Summary** tab, then **Download (org format)**.

**SAY:**
> "One click downloads it **in the same Excel format HR gives us**, with my ratings, her self-assessment and a summary sheet. So no copy-pasting at appraisal time."

**DO:** Quickly show **Technical skills**, then **KPIs**.

**SAY:**
> "Technical skills like Snowflake, Matillion and SQL are rated 1 to 5 against role targets, and gaps are highlighted. KPIs per role: I upload the KPI sheet once, then rate actuals every half-year and get a weighted score."

---

## 11. Talent, development and feedback (3 minutes)

**DO:** **Talent & retention**: show the 9-box, flight risk and the **Stay conversations** tab.

**SAY:**
> "The 9-box is performance versus potential, with a recommended action for each box. Flight risk with the reason. And **stay conversations**: five proven questions, like 'what might tempt you to leave?'. Better to ask before they resign, na?"

**DO:** **Goals**, then **Development plan**.

**SAY:**
> "Goals are weighted per cycle and flow directly into the review. The development plan is linked to competency gaps, and if there is a gap with no action, it reminds me."

**DO:** **Feedback log**, then **Add entry**.

**SAY:**
> "For feedback we use the **SBI** method: Situation, Behaviour, Impact. So feedback is specific, not generic like 'good job'. During appraisal I have proper examples with dates."

**DO:** **Improvement plan**.

**SAY:**
> "If somebody is really struggling, there is a fair, documented improvement plan: clear expectations, the support I'm giving, check-ins every two weeks, and the outcome. Hopefully we use it rarely."

---

## 12. Half-yearly review and calibration (2 minutes)

**DO:** **Half-yearly review**: show the Summary, Evidence and Write-up tabs.

**SAY:**
> "At cycle end, everything comes together automatically: goal completion, competency average, KPI score, 1:1 count and morale, feedback log, and development completed. I write the rating and comments, and print it or save it as PDF."

**DO:** Go to **Insights › Calibration**.

**SAY:**
> "Before submitting ratings, **calibration**. It checks whether my rating matches the evidence. For example: 'Rating higher than evidence', or 'the 9-box says high performer but you've given a low rating'. And it shows our distribution against the company guideline. So my ratings are fair and defensible."

---

## 13. Team insights (1.5 minutes)

**DO:** Click through **Competency map**, **Skills map**, **Talent & succession** and **Engagement**.

**SAY:**
> "These are team-level views, only for me as manager:
> - **Competency map**: a heatmap of the whole team. Plus *Gaps & coaching*: if three people are weak in presentation, plan a workshop; if Asha is strong where Priya is weak, Asha can coach her.
> - **Skills map**: the same for technical skills, with internal mentors.
> - **Talent & succession**: who is ready now for the next level, who is ready in one or two cycles, and who are our key people to retain.
> - **Engagement**: the morale trend for six months, per person and for the team."

---

## 14. My leadership: assessing myself (2 minutes)

**DO:** **Leadership › Habits scorecard**.

**SAY:**
> "Now, this is about **me as a manager**. The tool calculates my habits from my own records: am I doing 1:1s every month, am I closing my actions on time, am I recognising people, does everyone have a development plan and goals.
> No hiding here. If I'm not doing 1:1s, it shows 33% in red."

**DO:** **Self-assessment**, then **Upward feedback**.

**SAY:**
> "I rate myself on 12 manager competencies.
> And **upward feedback**: I download a small anonymous questionnaire and share it with the team. They fill it and send back a file, with no names. Results only show when at least three people respond, so nobody can be identified. And it shows my **blind spots**, where the team rates me lower than I rate myself.
> Even what reportees say under 'Feedback for me' in 1:1s goes into my leadership notes."

---

## 15. Configuration and settings (1.5 minutes)

**DO:** **Configuration › 1:1 question bank**.

**SAY:**
> "Everything is configurable. In the question bank I can change monthly to quarterly, hide questions, or add my own."

**DO:** Quickly show **Competency framework**, **Roles & KPIs** and **Org guidelines**.

**SAY:**
> "When HR updates the competency matrix, upload the new version and old ratings are kept. Roles with KPI uploads. And org guidelines: upload HR policy PDFs, search inside them, and it pulls out the key rules, like rating timelines."

**DO:** **Settings**: show the **AI assistant**, **Security** and **Data & backups** tabs.

**SAY:**
> "In Settings: the local AI is optional, and the built-in analysis works even without it. Password change and auto-lock. Automatic daily backups for 30 days, with one-click restore. I can move the data folder any time, for example into a synced work folder, because it stays encrypted."

---

## 16. Closing (1 minute)

**SAY:**
> "So, to summarise:
> 1. **One place** for everything about each reportee: 1:1s, competencies, goals, development, leave, documents and reviews.
> 2. **Guided 1:1s**, so no topic is missed, from wellbeing to certifications to career.
> 3. **Suggested actions** from 1:1 notes and documents, so I catch signals early: stress, blockers, flight risk.
> 4. **Appraisal-ready** at any time, in our company's own Excel format, with calibration.
> 5. **Private and encrypted** on my own laptop, one file per reportee, no cross-sharing.
> 6. And it keeps **me** honest as a manager too.
>
> That's it from my side. Happy to take questions. Thank you!"

---

## Likely questions and simple answers

| Question | Answer |
|---|---|
| Where is the data stored? Is it on the cloud? | Only on my laptop, in a folder I chose, encrypted with my password. No cloud and no external server. |
| If the laptop is stolen? | The files are encrypted (AES-256). Without the password nobody can read them. It also auto-locks. |
| Is it using ChatGPT or some online AI? | No. The built-in analysis is rule-based and runs inside the tool. The optional AI is Ollama, a model running on the same laptop. It works fully offline, and the tool refuses any AI address that is not local. |
| Will the AI take decisions automatically? | Never. Every suggestion needs my review and acceptance. |
| Can reportees see this? | No. It is a manager-only tool. Each person's data is in a separate file, and exports contain only that person. |
| What if I forget the password? | There is no reset, which is by design for security. Keep it in a password manager. |
| Can other managers use it? | Yes. Each manager runs their own copy with their own data folder. Code and data are separate; the code is in git and the data is never committed. |
| Does it work on Windows? | Yes. Same folder; double-click `Start Team Desk.bat`. Needs Node.js 18 or newer. |
| What if the competency matrix changes? | Upload the new Excel; existing ratings are kept, matched by competency code. |
| Can I take a backup? | Automatic daily snapshots for 30 days, plus "Back up now". The whole data folder can also be copied, since it stays encrypted. |
| How much time does it take per 1:1? | About 5 minutes to fill during or after the meeting, and 2 minutes to review suggested actions. |

---

## Short 8-minute version

If time is less, cover only these:

1. **Problem + privacy** (1 min): sections 1 and 2, the short version.
2. **Dashboard** (1 min): "Needs your attention" and team leave.
3. **Prepare next 1:1 + guided 1:1** (2 min): fill wellbeing, a blocker, leave dates and the outside offer.
4. **Suggested actions** (2 min): the review window, then accept.
5. **Competencies + org-format Excel download** (1 min).
6. **Closing summary** (1 min).

---

## Tips for a smooth demo

- **Always use the demo data folder.** Never show real reportee data on a shared screen.
- If the AI is slow on the first call, it is loading the model. Run **Test** in Settings five minutes before the demo.
- Keep the Team Desk terminal window minimised. Closing it stops the app.
- If something doesn't load, refresh the browser. Data is saved automatically every few seconds; see "Saved" at the top right.
- After the demo, switch back to your real data folder: **Settings › Data & backups › Open a different data folder**.
