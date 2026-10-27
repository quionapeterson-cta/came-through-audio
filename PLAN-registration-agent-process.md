# PLAN — Registration agent process (Expert Registration) · v1

Status: **built and written 2026-10-27 (Level 2). Passwords: team password manager approved 2026-10-27 (§4).**
Source: founder testing list and call with The MLC, 2026-10-27. Builds on PLAN-registration-intake.md.

---

## 1. What keeps registrations from getting mixed up (built)

- **One customer at a time, visible to the whole team.** An agent clicks **Start** on the customer in Admin → My
  Queue. Admin → Registrations then shows **🔒 [agent name]** on that order to everyone else, with a note to pick a
  different order. The agent sees "You're on this". Paused orders show "(paused)".
- **Match the invite to the right person.** Each order shows the customer's artist name, account email and the
  **legal name they signed the Registration Authorization with**. Agency invites come from accounts in that name.
- **Everything registered comes from the customer's submitted copy**, not live catalog edits, and the export buttons
  stay locked until every song is submitted, the agreement is signed and access is confirmed.
- **Agent tips** box at the top of Admin → Registrations with every reminder below.

## 2. Step by step (The MLC example; ASCAP, BMI and SoundExchange follow the same pattern)

1. **Laptop or desktop only.** The MLC's bulk registration doesn't work on a phone.
2. Admin → **My Queue** → click **Start** on the customer. Only one "working" item at a time.
3. Admin → **Registrations** → open the order. Note the legal name, artist name and email.
4. Log in to the **registrations@camethroughaudio.com** inbox. Open the agency's invite for this customer. **Check the
   account name on the invite matches the order's legal name or artist name.** If it doesn't, stop and ask Support.
5. Accept the invite on the agency site. If asked to create a password, see §4.
6. **Two-step verification:** choose **email**. Copy the code from the registrations@ inbox and enter it.
7. The MLC: **Member Settings is at the bottom left of the Members Hub.**
8. In Admin → Registrations, click **Export for The MLC** to download the customer's bulk file, then upload it with
   **Bulk registration**. If the user has an ISWC, it's in the file: The MLC doesn't require it, but it helps matching.
9. **A field shows red?** Check for spaces before or after the text and delete them.
10. Back in Admin → Registrations, set each song to **In progress**, then **Registered** once the agency confirms.
    The customer is emailed automatically when an agency is fully filed.
11. My Queue → **Done** on the customer. If something urgent comes up first, **Pause** with a note on where you left
    off, so you (or a teammate) can pick it up exactly there.

## 3. "How do we make sure we're linked to the right user?" (built)

The order shows the legal name from the signed agreement next to the account email, and Agent tips say to match
every invite against it before accepting. Customers add us using the same representative details (Came / Through
Audio / registrations@camethroughaudio.com), so the account name on the invite is what tells customers apart.

## 4. Passwords for agency accounts: my recommendation changed (decision needed)

You approved storing a new password per customer in a staff-only, encrypted field in our app. Looking closer, I
recommend **not** building that, and using a **team password manager** instead:

- **Often there's only one password per agency.** Every customer invites the same email
  (registrations@camethroughaudio.com). On most portals that's one login with access to each customer's account, not a
  new login per customer. Check this on your first two invites: if the second invite asks you to log in rather than
  create a password, it's one login.
- **If a portal does make a separate login per customer,** use a new strong password for each (never reuse one) and
  save it in a password manager such as **Bitwarden** (free for 2 people, low cost for a team) or 1Password, in a
  shared "Registrations" vault named "[Agency] – [customer legal name]".
- **Why not in our app:** storing other services' passwords in our own database makes Came Through Audio a much bigger
  target and puts us on the hook if it leaks. Password managers are built and audited for exactly this, with access
  logs and the ability to remove a staff member's access in one click.
- Never put agency passwords in the customer's account, chats, spreadsheets, tasks or notes.

- [x] **Approved 2026-10-27: team password manager.** No in-app password storage will be built.
- [ ] Set up the shared "Registrations" vault (Bitwarden or 1Password) and invite the registration team.
