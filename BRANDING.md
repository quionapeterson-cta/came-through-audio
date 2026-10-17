# Came Through Audio — Branding & Global Rules

## 1. Brand Identity

- **Name:** Came Through Audio
- **Business name:** Came Through Audio, LLC
- **Font:** Poppins
- **Tagline:** YOUR FIRST STOP BEFORE DISTRIBUTION — always uppercase, 2px letter spacing; never "1ST".

### Color hierarchy

**Primary neutrals.** These are the primary brand colors and rank above Cobalt Blue.

| Color | Hex | Use |
| --- | --- | --- |
| Black | `#0b0b0b` | Primary text, "Came Through" wordmark on light backgrounds, dark mode base |
| White | `#FFFFFF` | Primary text on dark, "Came Through" wordmark on dark backgrounds, light mode base |

- **Light backgrounds:** white base with black text.
- **Dark backgrounds:** black or dark charcoal base with white text.
- **Primary Black is `#0b0b0b`, not `#000000`.** Never use pure `#000000` for backgrounds or large text blocks. Pure `#000000` is only allowed for 1px borders, or in print PDFs if required.
- Filled badge backgrounds use Primary Black `#0b0b0b`. Gold, Platinum and badge stone colors stay exactly as they are.
- **Exception:** popup overlays and dim layers remain `bg-black/80` for focus; they are not converted to `#0b0b0b`.

**Signature accent**

| Color | Hex | Use |
| --- | --- | --- |
| Cobalt Blue | `#004AAD` | Buttons, highlights, navigation accents, accent borders |
| Electric Cobalt | `#4D8CFF` | "Audio" in small or medium wordmarks on dark backgrounds |

**Prestige colors (badges and the award system only, never general site design)**

| Color | Hex | Use |
| --- | --- | --- |
| Gold | `#FFD700` | Badges, milestones, prestige seals. Use sparingly: never ordinary buttons or large background blocks. |
| Platinum | `#E5E4E2` | Badges and awards. |

Gold and platinum are a nod to gold and platinum record sales, signaling prestige and luxury. Slight stone-to-stone variation in badge artwork is expected.

## 2. Logo and wordmark contrast

Apply these rules across the website, emails and PDFs.

- **Light backgrounds:** dark logo. "Came Through" in Black `#0b0b0b`, "Audio" in Cobalt Blue `#004AAD`.
- **Dark backgrounds:** light logo. "Came Through" in White `#FFFFFF`.
  - Small and medium text: "Audio" in Electric Cobalt `#4D8CFF`.
  - Large display text: "Audio" in Cobalt Blue `#004AAD` with a thin white outline.

## 3. Organization and user flow

- Attention to detail is a core pillar. Keep information organized, easy to read and quick to retrieve.
- Consolidate related information; avoid clutter and unnecessary duplicate fields.
- Spread catalog information left to right rather than bunching it together.
- Use grouped releases, collapsible sections and clear summaries where appropriate.
- Keep controls in natural workflow order: complete inputs first, then confirmations, saving and final actions.
- Keep later actions unavailable until their prerequisites are complete.
- List specific filter categories first; "All" always comes last, to keep the interface organized and decluttered.

## 4. Naming and writing

- Always use **AI Protection Hub**, never "AI Protection Portal" or "AI Defense Hub".
- Call the catalog uploader **Embed Metadata**, located inside My Catalog.
- Call the branded avatar option **CTA Badge**.
- Preserve the founder welcome message exactly as supplied; do not rewrite or polish it without permission.
- Provide previews before making changes, so they can be reviewed and approved first.

## 5. Writer and producer terminology

- **Writer** is the section title, not the name of an input field.
- Each writer row has **Credited name** (stage names are fine) and **Legal name** (optional until registration), plus a role.
- Keep the role dropdown: Author, Composer, or Author/Composer.
- Authors and composers may be different people; do not assume they are the same person.
- **Producer Name (Stage Name)** is for embedded credits.
- A producer's royalty-split identity belongs under Writer as Composer, using their legal name.
- PRO/IPI information can be left blank and added after registration; explain this concisely.
- For MLC exports: Author = A, Composer = C, Author/Composer = CA.

## 6. Catalog and split sheets

- Remember each user's catalog profile across sessions and devices, not only when they type their name.
- Require first-time catalog-profile setup before embedding.
- Use catalog Artist and Featured Artist information; avoid duplicate performer fields in collaborator rows.
- Prefill the owner's account email with their signup email when the field is blank.
- Preserve the "they can add it too" guidance for collaborator PRO/IPI information.
- Offer worldwide PRO choices, not only BMI and ASCAP.
- Include publisher information and associated fields.
- Place freeform Notes directly above signatures in the signing view and the exported split sheet.
- Free accounts may sign invited split sheets; creating one requires Catalog & Collaborate or higher.
- Invitation copy should describe the free 30-day Catalog & Collaborate trial.

## 7. Email branding and compliance

- Every email includes the logo, Came Through Audio, and the prominent all-caps tagline.
- Every footer includes Came Through Audio, LLC and 789 Garden Walk Blvd, Atlanta, GA 30349.
- Include why the recipient received the email, legal links and a copyright line.
- Marketing emails require a working unsubscribe link and honest subject lines.
- Never include "Or paste this link" raw-link fallback wording.
- All outgoing emails use the same shared branded email layout (`emailLayout()` in `src/lib/email-layout.ts`).

## 8. Awards direction (deferred, not a finished specification)

- Finish core functionality before implementing the awards system.
- Reuse the uploaded badges; remove duplicates.
- Support an ongoing mix of milestones, repeatable achievements and time-of-day awards.
- Marathon example: an award for every five consecutive catalog entries completed between 9 PM and midnight.
- In the Quiet example: the first catalog entry between 4 AM and 6 AM.
- These are examples, not the complete award rules.
- Include future lyric achievements and surprise awards to make repetitive work more enjoyable.

## 9. Platform safeguards

- Keep private PRO affiliations, IPI numbers and split percentages out of embedded MP3 metadata.
- Paid access comes from verified payment records; users cannot grant themselves paid access.
- Staff access is controlled securely; users cannot promote themselves through profile edits.
- Metadata embedding creates local MP3 downloads without changing catalog permissions.
- Bitcoin anchoring proves a file's existence and timing, not ownership by itself.
