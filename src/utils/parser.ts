import { ParseResult } from "../types";

const SPELL_FIXES: Record<string, string> = {
  "رقبا": "رقبة",
  "ضهر": "ظهر",
  "ركبا": "ركبة",
  "كتاف": "كتف",
  "اسفل": "أسفل",
  "عامود": "عمود",
  "فقره": "فقرة",
  "الم": "ألم"
};

const WORD_NUMBERS: Record<string, string> = {
  "واحد": "1", "اثنين": "2", "اتنين": "2", "ثلاثة": "3", "تلاتة": "3",
  "اربعة": "4", "أربعة": "4", "خمسة": "5", "ستة": "6", "سبعة": "7",
  "ثمانية": "8", "تمانية": "8", "تسعة": "9", "عشرة": "10", "عشره": "10",
  "خمستاشر": "15", "عشرين": "20", "تلاتين": "30"
};

const PHRASES: Record<string, string[]> = {
  "NAME": ["اسمه", "اسمها", "المريض", "patient", "his name", "her name"],
  "AGE": ["سنة", "سنين", "عمره", "years", "yrs"],
  "SEX_MALE": ["راجل", "ذكر", "male"],
  "SEX_FEMALE": ["ست", "أنثى", "female"],
  "DOA": ["تاريخ الدخول", "اليوم", "today", "date"],
  "OCCUPATION": ["شغله", "بيشتغل", "works as", "occupation"],
  "COMPLAINT": ["بيشتكي", "ألم في", "عنده", "complain", "chief"],
  "HISTORY": ["تاريخ مرضي", "history", "previously"],
  "RADIOGRAPH": ["أشعة", "xray", "radiograph", "finding"],
  "EXAMINATION": ["فحص", "examination", "rom"],
  "TENS": ["tens"],
  "FARADIC": ["faradic", "فارادي"],
  "HEAT": ["حرارة", "heat"],
  "IR": ["infrared", "ir"],
  "ULTRASOUND": ["ultrasound", "موجات"],
  "VIBRATOR": ["vibrator"],
  "LASER": ["laser", "ليزر"],
  "TRACTION": ["traction", "شد"],
  "ELECTROMAGNETIC": ["electromagnetic"],
  "PNEUMATIC": ["pneumatic"],
  "DURATION": ["دقيقة", "min", "minutes"],
  "WEIGHT_KG": ["كيلو", "kg"]
};

// Flatten phrases to a searchable structure
interface PhraseIndexEntry {
  words: string[];
  tag: string;
}

const phraseIndex: PhraseIndexEntry[] = [];
let maxPhraseLen = 0;

for (const [tag, variants] of Object.entries(PHRASES)) {
  for (const variant of variants) {
    const words = variant.toLowerCase().split(/\s+/);
    phraseIndex.push({ words, tag });
    if (words.length > maxPhraseLen) {
      maxPhraseLen = words.length;
    }
  }
}

function correctSpelling(text: string): string {
  let out = text;
  for (const [wrong, right] of Object.entries(SPELL_FIXES)) {
    // Regex for matching words with boundary or non-whitespace
    const regex = new RegExp(`(?<!\\S)${wrong}(?!\\S)`, "g");
    out = out.replace(regex, right);
  }
  return out;
}

function tokenize(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

function tokenToNumber(t: string): string {
  const normalized = t.toLowerCase();
  if (/^\d+$/.test(normalized)) return normalized;
  return WORD_NUMBERS[normalized] || "";
}

export function parseTranscript(transcript: string): ParseResult {
  const result: ParseResult = {
    name: "", age: "", sex: "", doa: "", occupation: "",
    chief_complaint: "", history: "", radiograph_finding: "", examination: "",
    tens: false, faradic: false, heat: false, heat_duration: "", ir: false,
    ultrasound: false, us_duration: "", vibrator: false, laser: false,
    traction: false, traction_kg: "", electromagnetic: false, pneumatic: false,
    unmatched: []
  };

  if (!transcript || !transcript.trim()) {
    return result;
  }

  const text = correctSpelling(transcript);
  const tokens = tokenize(text);
  const tokensLower = tokens.map(t => t.toLowerCase());
  const n = tokens.length;

  let i = 0;
  let currentField: keyof ParseResult | null = null;
  let lastTreatmentTag: string | null = null;

  while (i < n) {
    let matched = false;
    const window = tokensLower.slice(i, i + maxPhraseLen);

    let bestLen = 0;
    let bestTag: string | null = null;

    for (const entry of phraseIndex) {
      const pLen = entry.words.length;
      if (pLen > bestLen && window.length >= pLen) {
        const subWindow = window.slice(0, pLen);
        if (subWindow.join(" ") === entry.words.join(" ")) {
          bestLen = pLen;
          bestTag = entry.tag;
        }
      }
    }

    if (bestTag) {
      if (bestTag === "AGE" || bestTag === "DURATION" || bestTag === "WEIGHT_KG") {
        const after = i + bestLen;
        let num = "";
        if (after < n) num = tokenToNumber(tokensLower[after]);
        if (!num && i > 0) num = tokenToNumber(tokensLower[i - 1]);

        if (num) {
          if (bestTag === "AGE") {
            result.age = num;
          } else if (bestTag === "WEIGHT_KG") {
            result.traction_kg = num;
            result.traction = true;
          } else if (bestTag === "DURATION") {
            if (lastTreatmentTag === "HEAT") {
              result.heat_duration = num;
            } else if (lastTreatmentTag === "ULTRASOUND") {
              result.us_duration = num;
            } else if (result.heat && !result.heat_duration) {
              result.heat_duration = num;
            } else if (result.ultrasound && !result.us_duration) {
              result.us_duration = num;
            }
          }
        }
        i += bestLen;
        matched = true;
        continue;
      } else if (bestTag === "SEX_MALE") {
        result.sex = "Male";
      } else if (bestTag === "SEX_FEMALE") {
        result.sex = "Female";
      } else if (["TENS", "FARADIC", "HEAT", "IR", "ULTRASOUND", "VIBRATOR", "LASER", "TRACTION", "ELECTROMAGNETIC", "PNEUMATIC"].includes(bestTag)) {
        const field = bestTag.toLowerCase() as keyof ParseResult;
        (result as any)[field] = true;
        lastTreatmentTag = bestTag;
      } else if (bestTag === "NAME") {
        currentField = "name";
      } else if (bestTag === "DOA") {
        currentField = "doa";
      } else if (bestTag === "OCCUPATION") {
        currentField = "occupation";
      } else if (bestTag === "COMPLAINT") {
        currentField = "chief_complaint";
      } else if (bestTag === "HISTORY") {
        currentField = "history";
      } else if (bestTag === "RADIOGRAPH") {
        currentField = "radiograph_finding";
      } else if (bestTag === "EXAMINATION") {
        currentField = "examination";
      }

      i += bestLen;
      matched = true;
    } else {
      const tok = tokens[i];
      if (currentField) {
        (result as any)[currentField] = (((result as any)[currentField] || "") + " " + tok).trim();
      } else {
        result.unmatched = result.unmatched || [];
        result.unmatched.push(tok);
      }
      i++;
    }
  }

  return result;
}

export function summarizeProgram(prog: any): string {
  if (!prog) return "None";
  const parts: string[] = [];
  if (prog.tens) parts.push("TENS");
  if (prog.faradic) parts.push("Faradic");
  if (prog.heat) parts.push(`Heat (${prog.heat_duration || "0"}m)`);
  if (prog.ir) parts.push("IR");
  if (prog.ultrasound) parts.push(`US (${prog.us_duration || "0"}m)`);
  if (prog.vibrator) parts.push("Vibrator");
  if (prog.laser) parts.push("Laser");
  if (prog.traction) parts.push(`Traction (${prog.traction_kg || "0"}kg)`);
  if (prog.electromagnetic) parts.push("Electromagnetic");
  if (prog.pneumatic) parts.push("Pneumatic");
  return parts.join(", ") || "None";
}
