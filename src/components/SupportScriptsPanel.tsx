import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, Copy, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type Department } from "@/lib/departments";
import { SCRIPT_VARIABLES, fillScript, scriptDepartments, searchScripts, type SupportScript } from "@/lib/support-scripts";

const chip = (on: boolean) => `rounded-full border px-3 py-1 text-sm font-semibold ${on ? "border-primary bg-primary text-primary-foreground" : "border-border"}`;

function ScriptCard({ script, values }: { script: SupportScript; values: Record<string, string> }) {
  const [copied, setCopied] = useState(false);
  const text = fillScript(script.body, values);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied. Fill in anything still in {{braces}} before sending.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — select the text and copy it by hand.");
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{script.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{script.when}</p>
        </div>
        <div className="flex items-center gap-2">
          {script.internal ? <Badge variant="outline" className="border-destructive text-destructive">Internal only</Badge> : null}
          <Button size="sm" variant="outline" onClick={() => void copy()}>
            {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>
      {script.internal ? (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Staff only. This wording is never sent to a member.
        </p>
      ) : null}
      <pre className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-muted p-3 font-sans text-sm leading-relaxed">{text}</pre>
    </div>
  );
}

/**
 * Admin → Support Scripts (founder, 2026-11-05): every department's wording in one place, readable by every staff
 * member. Support owns the ticket queue; Billing answers its own tickets; everyone answering a question uses the script
 * its department owns, so the same question gets the same answer whoever is on the desk.
 */
export function SupportScriptsPanel() {
  const [department, setDepartment] = useState<Department | "all">("all");
  const [query, setQuery] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const departments = useMemo(() => scriptDepartments(), []);
  const rows = useMemo(() => searchScripts(query, department), [query, department]);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-card p-5">
        <h3 className="text-lg font-bold">Support Scripts</h3>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          The words to send, by department. Pick the department, fill the name and amount, copy, and send from the ticket.
          Every staff member can read every script; the department named on a script is who owns its wording. Anything
          marked <b>Internal only</b> is for the team, never for a member.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {SCRIPT_VARIABLES.map((v) => (
            <label key={v} className="text-xs font-semibold text-muted-foreground">
              {v.replace(/_/g, " ")}
              <Input className="mt-1" value={values[v] ?? ""} placeholder={`{{${v}}}`} onChange={(e) => setValues((prev) => ({ ...prev, [v]: e.target.value }))} />
            </label>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <button className={chip(department === "all")} onClick={() => setDepartment("all")}>All ({rows.length && department === "all" ? rows.length : departments.reduce((sum, d) => sum + d.count, 0)})</button>
        {departments.map((d) => (
          <button key={d.department} className={chip(department === d.department)} onClick={() => setDepartment(d.department)}>
            {d.label} ({d.count})
          </button>
        ))}
      </div>

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <Search className="h-4 w-4" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the scripts — 'hold', 'prorated', 'ISRC', 'split'" className="max-w-md" />
      </label>

      {!rows.length ? <p className="text-sm text-muted-foreground">No script matches that. Try another word, or All departments.</p> : null}
      <div className="space-y-3">
        {rows.map((s) => <ScriptCard key={s.id} script={s} values={values} />)}
      </div>
    </div>
  );
}
