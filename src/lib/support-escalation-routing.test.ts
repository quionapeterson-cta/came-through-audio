import { describe, expect, it } from "vitest";
import { resolveAccess } from "./departments";
import { ESCALATION_DEPARTMENTS } from "./escalation-departments";
import {
  ESCALATION_TAGS,
  escalationDepartments,
  escalationLeadLabels,
  leadTagsFor,
} from "./support-escalation-routing";

describe("escalationDepartments", () => {
  it("names the department behind a handoff, so its lead can be told", () => {
    expect(escalationDepartments(["marketing"])).toEqual(["marketing"]);
    expect(escalationLeadLabels(["marketing"])).toEqual(["Marketing & Social Media lead"]);
  });

  it("has no lead above the founder", () => {
    expect(escalationDepartments(["founder"])).toEqual([]);
    expect(escalationLeadLabels(["founder"])).toEqual([]);
  });

  it("routes only to departments whose lead the queue knows about", () => {
    // The tab rule, the routing and the server scope all read this one list, or a lead is told about a thread they
    // cannot open.
    expect(escalationDepartments([...ESCALATION_TAGS])).toEqual([...ESCALATION_DEPARTMENTS]);
  });

  it("never repeats a department when a thread goes to both", () => {
    expect(escalationDepartments(["marketing", "founder"])).toEqual(["marketing"]);
    expect(escalationDepartments(["marketing", "marketing"])).toEqual(["marketing"]);
    expect(escalationDepartments([])).toEqual([]);
  });
});

describe("leadTagsFor", () => {
  it("gives a department lead the tags of the department they lead", () => {
    expect(
      leadTagsFor(resolveAccess([{ role: "department_lead", departments: ["marketing"] }])),
    ).toEqual(["marketing"]);
  });

  it("leaves another department's lead and the team's employees out", () => {
    expect(
      leadTagsFor(resolveAccess([{ role: "department_lead", departments: ["support"] }])),
    ).toEqual([]);
    expect(leadTagsFor(resolveAccess([{ role: "employee", departments: ["marketing"] }]))).toEqual(
      [],
    );
    expect(leadTagsFor(null)).toEqual([]);
  });

  it("keeps the founder's own list the founder's", () => {
    // A super admin reads every ticket and her own notices; a second lead notice would only duplicate them.
    expect(leadTagsFor(resolveAccess([{ role: "super_admin" }]))).toEqual([]);
  });
});
