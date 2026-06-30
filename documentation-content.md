# MatkaBook Pro — Documentation Content
*Generated from source code and live screenshots · Version 2.2*

---

## Table of Contents

### Login
- [Login Page](#login-page)

### Boss Panel (13 pages)
- [Dashboard](#dashboard)
- [Submit Entry For Broker](#submit-entry-for-broker)
- [Entries](#entries)
- [Results](#results)
- [Settlements](#settlements)
- [Brokers](#brokers)
- [Employees](#employees)
- [Markets](#markets)
- [Payout Rates](#payout-rates)
- [Reports](#reports)
- [Search](#search)
- [Audit Logs](#audit-logs)

### Broker Panel (5 pages)
- [Broker Home / Dashboard](#broker-home--dashboard)
- [Submit Entry](#submit-entry)
- [My Entries](#my-entries)
- [My Tokens](#my-tokens)
- [My Settlement](#my-settlement)

---

---

## Login Page

**Who uses this:** Boss · Employee · Broker  
**Screenshot (Desktop):** `screenshots/desktop/login.png`  
**Screenshot (Mobile):** `screenshots/mobile/login.png`

**Purpose:**  
The single entry point for all user roles. Users enter their username and password; the system detects the role and redirects them to the correct panel automatically — Boss and Employee users go to the Boss Panel, Brokers go to the Broker Panel.

**How to use:**
1. Open the app in your browser (http://localhost:5173)
2. Enter your assigned username (e.g. `boss`, `BRK001`, `EMP001`)
3. Enter your password
4. Click **Login** — you will be redirected automatically based on your role

**Key features on this page:**
- Role-aware redirect: Boss/Employee → `/boss/dashboard`, Broker → `/broker/home`
- Shows error message on wrong credentials without page reload
- Login button disables while request is in-flight (prevents duplicate submissions)
- Dark gold theme consistent across the app

---

## Dashboard

**Who uses this:** Boss · Employee  
**Screenshot (Desktop):** `screenshots/desktop/dashboard.png`  
**Screenshot (Mobile):** `screenshots/mobile/dashboard.png`

**Purpose:**  
The command centre for the current day's betting activity. Shows a live summary of all entries grouped by bet type (Single Ank, Jodi, Open Pana, Close Pana). Clicking any number opens a broker breakdown modal. Updates in real-time via Socket.IO when any broker submits new entries.

**How to use:**
1. Select a market from the dropdown to filter the view (default: all markets)
2. View the four summary tables — each row shows a number and total amount wagered on it
3. Click any row to open the **Broker Breakdown** modal showing which brokers bet on that number and how much
4. Close the modal by clicking ✕ or the Close button
5. The "Total Collection" badge in the header updates live

**Key features on this page:**
- Single Ank displayed as 1 digit (e.g. `5`), Jodi as 2 digits (e.g. `47`), Pana as 3 digits (e.g. `123`)
- Real-time updates — no manual refresh needed when new entries arrive
- **📤 Submit Entry For Broker** quick-action button at the top for boss/employee use
- Broker breakdown modal shows FAM badge when entry was part of a family bet
- Market filter persists within the session

---

## Submit Entry For Broker

**Who uses this:** Boss · Employee  
**Screenshot (Desktop):** `screenshots/desktop/submit-for-broker.png`  
**Screenshot (Mobile):** `screenshots/mobile/submit-for-broker.png`

**Purpose:**  
Allows the boss or an employee to submit betting entries on behalf of any broker — useful when a broker calls in their bets by phone. The submission is tracked with a `submitted_by` record showing who entered it and on whose behalf.

**How to use:**
1. Type a broker's name or code in the search box (minimum 1 character triggers search)
2. Select the broker from the dropdown results
3. A gold banner confirms the selected broker; click **Change Broker** to switch
4. **Step 1:** Choose a market from the dropdown
5. **Step 2:** Choose Open or Close session
6. **Step 3:** Select bet type (Single Ank / Jodi / Single Pana), enter the number and amount, then click **+ Add**
   - For Pana bets: optionally switch to **SP Family** or **DP Family** tabs to select entire pana families at once
7. Review the entry list, then click **Submit Entries**
8. On success, a confirmation screen shows the token number, "Submitted for: [Broker]" and "Submitted by: [Your name]"

**Key features on this page:**
- Broker search with 300ms debounce — no results until at least 1 character typed
- Full Pana family support: auto-fetches all family members, toggle chips individually or Select All
- SP (Single Pana) and DP (Double Pana) family modes with ank selector (0-9)
- Entries fully tracked in audit log with `entry_submitted_by_employee` action
- Switching broker clears all previous step 2/3 selections

---

## Entries

**Who uses this:** Boss · Employee  
**Screenshot (Desktop):** `screenshots/desktop/entries.png`  
**Screenshot (Mobile):** `screenshots/mobile/entries.png`

**Purpose:**  
Full searchable, filterable ledger of every entry submitted across all brokers. Shows entry details including who submitted it (broker self, employee, or boss). Supports inline editing of amounts and batch cancellation.

**How to use:**
1. Use the filter bar to narrow by Market, Date, Broker, and Bet Type
2. Browse the paginated table (50 rows per page)
3. Click **Edit** on any active row to change the amount
4. Click **Cancel** on any active row to cancel the entire batch (with confirmation dialog)
5. Use pagination controls at the bottom to navigate large datasets

**Key features on this page:**
- **Submitted By** column: blue text for broker self-submitted, gold for boss/employee submitted
- Real-time updates via Socket.IO — new entries appear without refresh
- Accurate submission time shown (uses `created_at`, not midnight entry date)
- Numbers correctly formatted: Single Ank (1 digit), Jodi (2 digits), Pana (3 digits)
- Cancelled entries shown with strikethrough token and 50% opacity

---

## Results

**Who uses this:** Boss  
**Screenshot (Desktop):** `screenshots/desktop/results.png`  
**Screenshot (Mobile):** `screenshots/mobile/results.png`

**Purpose:**  
Declare the open and close result panas for a market on any date. The system automatically calculates the open ank, close ank, and jodi, then triggers settlement calculations for all brokers the moment the close is declared.

**How to use:**
1. Select the market and date using the dropdowns at the top
2. **Declare Open:** Enter the 3-digit open pana — the open ank is shown live as you type. Click **DECLARE OPEN**
3. **Declare Close:** After open is declared, enter the 3-digit close pana — close ank and jodi are previewed live. Click **DECLARE CLOSE**
4. Settlements are generated automatically for all brokers on close declaration
5. Use **✎ Correct Open** if a mistake was made — recalculates everything

**Key features on this page:**
- Live ank preview as you type (digit sum mod 10)
- Jodi preview (open ank + close ank) shown before confirming close
- Declare button disabled until exactly 3 digits entered
- Accepts pana `000` as a valid result (e.g. open ank = 0)
- Socket.IO events (`open_declared`, `close_declared`) broadcast to all connected clients

---

## Settlements

**Who uses this:** Boss  
**Screenshot (Desktop):** `screenshots/desktop/settlements.png`  
**Screenshot (Mobile):** `screenshots/mobile/settlements.png`

**Purpose:**  
View and settle outstanding dues with all brokers after results are declared. Shows each broker's collection, winning payout, commission, and net balance — with clear direction of who owes whom. Includes a history tab for previously cleared settlements.

**How to use:**
1. Select a market and date, then click **Load Settlements**
2. Each broker card shows: Total Collection, Commission (10%), Winning Payout, Net Balance
3. **Green card = Boss Pays Broker** (broker's clients won more than they collected)
4. **Red card = Broker Pays Boss** (broker collected more than was paid out in winnings)
5. Click **✓ Clear** on any card to mark that broker's settlement as cleared
6. Confirm in the dialog — cancelled if you click No
7. Switch to the **Cleared** tab to see settlement history

**Key features on this page:**
- Commission fixed at 10% of gross collection
- Settlement formula: Net = (Collection − Commission) − Winning Payout
- Summary bar at top shows aggregate totals across all brokers
- Cleared history tab with timestamps
- Broker can view their own settlement figure from the Broker Panel

---

## Brokers

**Who uses this:** Boss  
**Screenshot (Desktop):** `screenshots/desktop/brokers.png`  
**Screenshot (Mobile):** `screenshots/mobile/brokers.png`

**Purpose:**  
Manage the roster of brokers who use the system. Create new broker accounts, view their codes and contact details, and enable/disable access as needed.

**How to use:**
1. Click **+ Add Broker** to open the creation form
2. Fill in: Name, Phone, Broker Code, Username, Password — all required
3. Click **Create** to save; the broker can now log in
4. Click **Edit** on any broker row to update name or phone
5. Click **Disable/Enable** to toggle a broker's access without deleting them

**Key features on this page:**
- Broker codes are unique identifiers shown on tokens (e.g. `BRK001`)
- Password stored securely using PostgreSQL pgcrypto (bcrypt)
- Disabled brokers cannot log in or submit entries
- Edit modal only allows updating name and phone — username/code cannot change

---

## Employees

**Who uses this:** Boss only  
**Screenshot (Desktop):** `screenshots/desktop/employees.png`  
**Screenshot (Mobile):** `screenshots/mobile/employees.png`

**Purpose:**  
Manage staff who help operate the system. Employees get access to the Boss Panel to submit entries on behalf of brokers, but cannot manage brokers, employees, markets, rates, or view reports — boss-only pages are hidden and access-blocked.

**How to use:**
1. Click **+ Add Employee** to create a new staff account
2. Fill in: Name, Mobile, Username, Password — all required
3. Click **Create** to save; the employee can now log in as their username
4. Click **Edit** to update name or mobile number
5. Click **Disable/Enable** to revoke or restore login access
6. Click **Reset Password** to set a new password for the employee

**Key features on this page:**
- Visible only to boss — employees and brokers cannot access this page
- Employee login takes them directly to the Boss Panel Dashboard
- Employee's name appears in the panel header: "Employee Panel — [Name]"
- All entries submitted by employees are tracked with their name in the audit log
- Password reset uses PostgreSQL pgcrypto for secure hashing

---

## Markets

**Who uses this:** Boss  
**Screenshot (Desktop):** `screenshots/desktop/markets.png`  
**Screenshot (Mobile):** `screenshots/mobile/markets.png`

**Purpose:**  
Configure the markets (games) available for betting. Each market has a name, short code, open cutoff time, and close cutoff time. Entries cannot be submitted after the cutoff time has passed for that session.

**How to use:**
1. Click **+ Add Market** to create a new market
2. Fill in: Market Name, Code (short, e.g. `MIL`), Open Time (HH:MM), Close Time (HH:MM)
3. Click **Create** to activate the market immediately
4. Click **Edit** to update market details including cutoff times
5. Click **Disable** to stop all entry submission for that market without deleting history

**Key features on this page:**
- Times must be in HH:MM 24-hour format — invalid formats return 400 error (not server crash)
- Open and close cutoff enforced server-side using IST timezone (Asia/Kolkata)
- Disabling a market blocks all new entries but preserves existing data
- Market code appears on all entry tokens (e.g. `MIL-300626-000001`)

---

## Payout Rates

**Who uses this:** Boss  
**Screenshot (Desktop):** `screenshots/desktop/rates.png`  
**Screenshot (Mobile):** `screenshots/mobile/rates.png`

**Purpose:**  
Configure the payout multipliers that determine how much winners receive. Single Ank (9×) and Jodi (90×) are fixed system rates. The boss can adjust the Pana Base Rate which controls Single Pana, Double Pana, and Triple Pana payouts.

**How to use:**
1. View the **Fixed Rates** section — Single Ank (9×) and Jodi (90×) cannot be changed
2. In the **Pana Base Rate** section, type a new multiplier value
3. The **Live Preview** below updates instantly to show what Single, Double, and Triple Pana will pay
4. Click **💾 Save Rates** to apply the new rates
5. The last-updated timestamp is shown below the Save button

**Key features on this page:**
- Default rates: Single Pana 150×, Double Pana 300×, Triple Pana 600×
- Double Pana is always 2× the base; Triple Pana is always 4× the base
- Rate changes take effect immediately for all new entries
- Existing entries already in the system retain their original potential_payout value

---

## Reports

**Who uses this:** Boss  
**Screenshot (Desktop):** `screenshots/desktop/reports.png`  
**Screenshot (Mobile):** `screenshots/mobile/reports.png`

**Purpose:**  
Financial summary reports for any date range. The Broker Report shows per-broker collection, commission, winnings, and net P&L. The Market Report shows the same breakdown grouped by market. Used for end-of-day and end-of-week accounting.

**How to use:**
1. Select a date range using the From and To date pickers
2. Choose a tab: **Broker Report** or **Market Report**
3. Click **Generate Report** to load the data
4. Review the table — each row shows collection, commission (10%), winning, and net settlement
5. The bottom row shows grand totals across all rows

**Key features on this page:**
- Date range filtering covers any historical period
- Net P&L = Collection − Commission − Winning (positive = boss profit, negative = boss loss)
- Broker Report groups by broker name; Market Report groups by market
- Market Report shows entry date in the first column when no broker name applies

---

## Search

**Who uses this:** Boss · Employee  
**Screenshot (Desktop):** `screenshots/desktop/search.png`  
**Screenshot (Mobile):** `screenshots/mobile/search.png`

**Purpose:**  
Look up any specific entry by token number, broker, date, market, bet number, or bet type. Essential for handling customer queries — e.g. "Did broker XYZ place a bet on number 123 on Tuesday?"

**How to use:**
1. Fill in one or more search fields: Token, Broker name, Date, Market, Number, Bet Type
2. Click **Search** to run the query
3. Browse the results table showing matching entries
4. Click any row to open a **Detail Panel** with the complete entry information including win/loss status

**Key features on this page:**
- Any combination of fields can be searched — all are optional
- Numbers displayed with correct formatting (Single Ank = 1 digit, Jodi = 2 digits, Pana = 3 digits)
- Detail panel shows potential payout, actual payout, and win/loss flag
- Accessible by employees as well as boss (search helps answer broker queries)

---

## Audit Logs

**Who uses this:** Boss  
**Screenshot (Desktop):** `screenshots/desktop/audit-logs.png`  
**Screenshot (Mobile):** `screenshots/mobile/audit-logs.png`

**Purpose:**  
Complete tamper-proof log of every action taken in the system — from entry submissions to result corrections to employee password resets. Each log entry shows who did what and when, making the system fully accountable.

**How to use:**
1. Browse the chronological log — newest actions appear at the top
2. Each entry shows: timestamp, action type (colour-coded), actor, and details
3. Use the browser's find (Ctrl+F) to search for specific actions or usernames
4. Scroll to load earlier history (or use pagination if available)

**Key features on this page:**
- Colour-coded action badges: green for creates/enables, red for deletes/disables, blue for employee actions, yellow for edits/resets
- Actions logged: entry submitted, entry cancelled, result declared, result corrected, settlement cleared, broker created/disabled, employee created/disabled/reset, market changes
- Employee submissions logged as `entry_submitted_by_employee` — visible here
- Cannot be edited or deleted — permanent record

---

---

## Broker Home / Dashboard

**Who uses this:** Broker  
**Screenshot (Desktop):** `screenshots/desktop/broker-home.png`  
**Screenshot (Mobile):** `screenshots/mobile/broker-home.png`

**Purpose:**  
The broker's landing page after login. Shows today's market status (open/closed), quick-access buttons to submit entries and view past submissions, and any outstanding settlement balance.

**How to use:**
1. On login, brokers land here automatically
2. Check which markets are currently open (cutoff time not yet passed)
3. Tap **Submit Entry** to place new bets
4. Tap **My Entries** to view past submissions
5. Tap **My Tokens** to look up a specific bet token

**Key features on this page:**
- Shows real-time market open/closed status based on current IST time vs cutoff
- Quick-action cards for Submit, Entries, Tokens, Settlement
- Mobile-first layout designed for use on phones

---

## Submit Entry

**Who uses this:** Broker  
**Screenshot (Desktop):** `screenshots/desktop/broker-submit-entry.png`  
**Screenshot (Mobile):** `screenshots/mobile/broker-submit-entry.png`

**Purpose:**  
The main betting entry screen for brokers. Supports all bet types including Single Ank, Jodi, and all Pana variants. Includes the Pana Family system which lets brokers bet on all related panas in a family at once, and SP/DP family modes for structured pana selection.

**How to use:**
1. **Step 1:** Select a market from the list
2. **Step 2:** Choose Open or Close session
3. **Step 3 — Single Entry:** Select bet type, enter the number and amount, click **+ Add to List**
4. **Step 3 — Pana Family:** Switch to the **Family** tab, type a 3-digit pana — all family members auto-load as chips. Toggle individual chips on/off or click **Select All**. Enter a per-pana amount and click **Add Family**
5. **Step 3 — SP/DP Family:** Switch to **SP Family** or **DP Family**, choose an ank (0-9), select panas from the chips shown, enter amount, click **Add SP/DP Family**
6. Review the entry list on the right showing all added bets and running total
7. Click **Submit** to place all entries at once
8. On success, a **Token screen** appears with the unique token number

**Key features on this page:**
- Pana family auto-loads using the cut table (digit pairs: 0-5, 1-6, 2-7, 3-8, 4-9)
- SP Family: all single-pana members for a given ank digit
- DP Family: all double-pana members for a given ank digit
- Submit button disabled while request is in-flight (prevents duplicate submissions)
- Server enforces cutoff time — entries rejected if submitted after market close time

---

## My Entries

**Who uses this:** Broker  
**Screenshot (Desktop):** `screenshots/desktop/broker-my-entries.png`  
**Screenshot (Mobile):** `screenshots/mobile/broker-my-entries.png`

**Purpose:**  
Complete history of all entry batches submitted by this broker, grouped by date. Expanding any batch shows the individual bet details, win/loss status after results are declared, and actual payout amounts.

**How to use:**
1. Filter by market using the dropdown at the top (default: all markets)
2. Browse batches grouped by date — newest date first
3. Tap any batch card to expand it and see individual bets
4. Green amounts show winnings; red shows losses; dash shows pending result

**Key features on this page:**
- Grouped by date for easy navigation
- Shows bet type, number (correctly formatted), amount, and result
- Cancelled batches shown with red border and 60% opacity
- Win amounts display actual payout (e.g. Rs. 9,000 for a Rs. 1,000 single ank bet)
- Market filter works correctly (type-safe string comparison)

---

## My Tokens

**Who uses this:** Broker  
**Screenshot (Desktop):** `screenshots/desktop/broker-my-tokens.png`  
**Screenshot (Mobile):** `screenshots/mobile/broker-my-tokens.png`

**Purpose:**  
Look up any previous entry batch by its token number. Useful when a customer queries a specific bet — the broker can quickly pull up the full details of that token.

**How to use:**
1. Enter the token number in the search field (e.g. `MIL-300626-000001`)
2. The matching batch details appear immediately
3. View the complete bet list with amounts and current win/loss status

**Key features on this page:**
- Token format: `[MARKET_CODE]-[DDMMYY]-[SEQUENCE]`
- Shows market, session, date, total amount, and all individual bets
- Numbers displayed with correct formatting per bet type

---

## My Settlement

**Who uses this:** Broker  
**Screenshot (Desktop):** `screenshots/desktop/broker-settlement.png`  
**Screenshot (Mobile):** `screenshots/mobile/broker-settlement.png`

**Purpose:**  
Shows the broker their own settlement figure after results are declared — how much they owe the boss or are owed by the boss. Brokers see only their own data; they cannot see other brokers' settlements.

**How to use:**
1. The page shows the current settlement status for the most recent result date
2. **You Owe Boss (Red):** Your clients' losses exceeded winnings — pay this amount to the boss
3. **Boss Owes You (Green):** Your clients won more than they paid — boss pays you this amount
4. Historical settled amounts appear in the Cleared tab once the boss marks it cleared

**Key features on this page:**
- Broker sees only their own settlement — full privacy from other brokers
- Figures match exactly what boss sees on the Settlement page for this broker
- Commission (10% of collection) automatically deducted
- Settlement direction shown clearly with colour (green = receive, red = pay)

---

---

*Documentation generated by automated screenshot + code analysis pipeline.*  
*App version: 2.2 · Screenshots captured: 36 (18 pages × 2 viewports)*  
*Screenshot locations:*
- *Desktop (1280×800): `screenshots/desktop/`*
- *Mobile (390×844): `screenshots/mobile/`*
