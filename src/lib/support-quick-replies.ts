/**
 * Quick replies for the public info@ channel (founder, 2026-11-19).
 *
 * Three starters Support reaches for most often, so a general inquiry does not begin from a blank box. They are
 * starters, not scripts: the words still get edited for the person, and nothing here states a fee, a turnaround, a
 * rights term or a promise the founder has not approved — where an answer depends on the catalogue or the deal, the
 * reply asks for the details instead of guessing.
 */

export type QuickReply = { id: string; label: string; body: string };

export const INFO_QUICK_REPLIES: QuickReply[] = [
  {
    id: "general",
    label: "General Info",
    body: `Hi {{first_name}},

Thanks for reaching out. Came Through Audio is a catalog and metadata studio: we help artists get their masters, credits and registration paperwork in order before distribution.

Tell me a little about what you're working on — a release you're preparing, a catalogue you're moving, or a question about the platform — and I'll point you to the right next step.

Came Through Audio`,
  },
  {
    id: "licensing",
    label: "Beat Licensing / Catalog",
    body: `Hi {{first_name}},

Thanks for writing about licensing. So we point you at the right thing, could you share:

- the song or beat you're asking about (title and artist),
- what you want to do with it (release it, place it, sample it, or move it between distributors), and
- who else holds a share, if anyone.

With those details we can tell you what is already in the catalogue and what the next step looks like.

Came Through Audio`,
  },
  {
    id: "press",
    label: "Press & Partnerships",
    body: `Hi {{first_name}},

Thanks for getting in touch. I've passed this to the team that handles press and partnerships, and they'll come back to you here.

If it helps, send any deadline, the outlet or partner you're writing for, and a link to what you're working on.

Came Through Audio`,
  },
];

/** A quick reply as the composer wants it: the member's first name filled in, everything else left for the agent. */
export function fillQuickReply(body: string, first_name: string): string {
  return body.replace(/\{\{\s*first_name\s*\}\}/gi, first_name.trim() || "there");
}
