import { useState } from "react";
import { Check, Eye, EyeOff, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_RULES, passwordStrength } from "@/lib/password";

const STRENGTH = ["", "Weak", "Fair", "Good", "Strong"];

/**
 * New-password input with a live pass/fail checklist and strength bar, so people set a strong password the first
 * time. Rules start neutral and turn red only after the field is touched. With `rules={false}` only the strength bar
 * shows (the homepage signup), and the parent turns the rules on after a submit that doesn't pass them.
 */
export function PasswordField({ id, label = "Password", value, onChange, rules = true }: { id: string; label?: string; value: string; onChange: (v: string) => void; rules?: boolean }) {
  const [show, setShow] = useState(false);
  const [touched, setTouched] = useState(false);
  const strength = passwordStrength(value);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input id={id} type={show ? "text" : "password"} autoComplete="new-password" value={value} required className="pr-10"
          onChange={(e) => { onChange(e.target.value); if (!touched && e.target.value) setTouched(true); }} aria-describedby={rules ? `${id}-rules` : undefined} />
        <button type="button" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow((s) => !s)}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground">
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      <div className="flex items-center gap-2 pt-1" aria-hidden={!value}>
        <div className="flex flex-1 gap-1">{[1, 2, 3, 4].map((i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${strength >= i ? "bg-primary" : "bg-muted"}`} />)}</div>
        <span className="w-12 text-right text-xs font-semibold text-muted-foreground">{STRENGTH[strength]}</span>
      </div>
      {rules && <>
      <ul id={`${id}-rules`} className="grid gap-0.5 pt-1 text-xs sm:grid-cols-2" aria-live="polite">
        {PASSWORD_RULES.map((r) => {
          const ok = r.test(value);
          return (
            <li key={r.id} className={`flex items-start gap-1.5 ${ok ? "text-primary" : touched ? "text-destructive" : "text-muted-foreground"}`}>
              {ok ? <Check className="mt-0.5 h-3 w-3 shrink-0" /> : <X className="mt-0.5 h-3 w-3 shrink-0" />}
              <span>{r.label}<span className="sr-only">{ok ? " (passed)" : " (not yet)"}</span></span>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">Tip: three or four unrelated words with a number and a symbol are strong and easy to remember. Don't reuse a password from another site.</p>
      </>}
    </div>
  );
}
