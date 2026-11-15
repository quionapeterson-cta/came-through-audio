import { describe, expect, it } from "vitest";
import {
  adminFields,
  internshipPacketTemplate,
  packetForms,
  packetProblems,
  packetProgress,
  recipientCheckboxes,
  recipientFields,
  recipientNeedsSignature,
  visibleBlocks,
} from "./pdf-packets";

const template = internshipPacketTemplate();
const forms = packetForms(template);
const allForms = forms.map((f) => f.key);

describe("internship packet", () => {
  it("carries a cover plus eight forms and the orientation sheet, each with a form key", () => {
    expect(template.blocks.filter((b) => b.kind === "section")).toHaveLength(10);
    expect(forms).toHaveLength(9);
    expect(new Set(allForms).size).toBe(9);
    expect(forms[0]!.title).toContain("Form 1");
    expect(forms.at(-1)!.title.toLowerCase()).toContain("orientation");
  });

  it("has recipient fields, checkbox groups and a recipient signature", () => {
    expect(recipientFields(template, allForms).length).toBeGreaterThan(20);
    expect(recipientCheckboxes(template, allForms).length).toBeGreaterThan(5);
    expect(recipientNeedsSignature(template, allForms)).toBe(true);
    expect(adminFields(template).length).toBeGreaterThan(0);
    expect(adminFields(template).every((f) => f.role === "admin")).toBe(true);
  });

  it("drops a switched-off optional form and everything under it", () => {
    const nda = forms[1]!;
    const without = allForms.filter((key) => key !== nda.key);
    const headings = visibleBlocks(template, without)
      .filter((b) => b.kind === "section")
      .map((b) => (b.kind === "section" ? b.title : ""));
    expect(headings.some((t) => t.includes("Confidentiality"))).toBe(false);
    expect(headings.some((t) => t.includes("Internship Agreement"))).toBe(true);
    // The NDA's signature block left with it.
    expect(
      visibleBlocks(template, without).filter(
        (b) => b.kind === "signature" && b.role === "recipient",
      ),
    ).not.toHaveLength(
      visibleBlocks(template, allForms).filter(
        (b) => b.kind === "signature" && b.role === "recipient",
      ).length,
    );
  });
});

describe("packet progress and checks", () => {
  const enabled = forms.slice(0, 2).map((f) => f.key);
  const required = recipientFields(template, enabled).filter((f) => f.required);
  const requiredGroups = recipientCheckboxes(template, enabled).filter(
    ({ block }) => block.required,
  );

  const answers = () => {
    const values: Record<string, string | string[]> = Object.fromEntries(
      required.map((f) => [f.id, "answered"]),
    );
    for (const { block } of requiredGroups) values[block.id] = [block.options[0]!.id];
    return values;
  };

  it("counts a required field as done only when it has text", () => {
    const empty = packetProgress(template, enabled, {});
    expect(empty.done).toBe(0);
    expect(empty.required).toBe(required.length + requiredGroups.length + 1);

    const filled = packetProgress(template, enabled, { ...answers(), __signature: "signed" });
    expect(filled.done).toBe(filled.required);
  });

  it("names what is missing before a submission", () => {
    const problems = packetProblems(template, enabled, {});
    expect(problems.some((p) => p.endsWith("is required."))).toBe(true);
    expect(problems).toContain("Add your signature.");

    expect(packetProblems(template, enabled, { ...answers(), __signature: "signed" })).toEqual([]);
  });

  it("requires a choice in a required checkbox group", () => {
    if (!requiredGroups.length) return;
    const withoutChoice: Record<string, string | string[]> = {
      ...answers(),
      __signature: "signed",
    };
    delete withoutChoice[requiredGroups[0]!.block.id];
    expect(
      packetProblems(template, enabled, withoutChoice).some((p) =>
        p.startsWith("Choose at least one option"),
      ),
    ).toBe(true);
  });
});
