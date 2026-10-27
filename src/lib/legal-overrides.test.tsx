import { renderToStaticMarkup } from "react-dom/server";
import { htmlToLegalText, lastUpdated, renderLegalText } from "./legal-overrides";
import { TERMS } from "./legal-docs";

describe("legal wording", () => {
  it("turns the built-in text into editable text and back without losing links or bullets", () => {
    const html = '<p>Email <a class="x" href="mailto:legal@camethroughaudio.com">legal@camethroughaudio.com</a> &amp; more.</p><ul><li>One</li><li>Two</li></ul>';
    const text = htmlToLegalText(html);
    expect(text).toBe("Email [legal@camethroughaudio.com](mailto:legal@camethroughaudio.com) & more.\n\n- One\n- Two");
    const back = renderToStaticMarkup(<>{renderLegalText(text)}</>);
    expect(back).toContain('href="mailto:legal@camethroughaudio.com"');
    expect(back).toContain("<li>One</li>");
  });

  it("never turns typed text into code or unsafe links", () => {
    const out = renderToStaticMarkup(<>{renderLegalText('<script>x</script> [bad](javascript:alert(1))')}</>);
    expect(out).not.toContain("<script>");
    expect(out).not.toContain('href="javascript');
  });

  it("shows the newer of the built-in date and the latest edit", () => {
    expect(lastUpdated("October 25, 2026", {})).toBe("October 25, 2026");
    expect(lastUpdated("October 25, 2026", { a: { body: "x", updatedAt: "2026-11-02T12:00:00Z" } })).toBe("November 2, 2026");
  });

  it("every built-in section converts to non-empty text", () => {
    for (const s of TERMS.sections) expect(htmlToLegalText(renderToStaticMarkup(<>{s.body}</>)).length).toBeGreaterThan(10);
  });
});
