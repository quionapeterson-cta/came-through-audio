import type { Contributor } from "@/lib/metadata";
import { societyForPro } from "@/lib/repertoires";

/** A BMI writer: with no publisher, BMI pays the publisher share to the writers, in proportion to their splits. */
export const isBmi = (w: Contributor) => societyForPro(w.pro)?.id === "bmi";
