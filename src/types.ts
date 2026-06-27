export interface Patient {
  id: string;
  name: string;
  age: string;
  sex: string;
  occupation: string;
  doa: string;
  chief_complaint: string;
  history: string;
  radiograph_finding: string;
  examination: string;
  created_at: string;
}

export interface Program {
  id: string;
  patient_id: string;
  session_id: string | null;
  tens: boolean;
  tens_note?: string;
  faradic: boolean;
  faradic_note?: string;
  heat: boolean;
  heat_duration: string;
  ir: boolean;
  ultrasound: boolean;
  us_duration: string;
  vibrator: boolean;
  laser: boolean;
  traction: boolean;
  traction_kg: string;
  electromagnetic: boolean;
  pneumatic: boolean;
}

export interface Session {
  id: string;
  patient_id: string;
  created_at: string; // ISO date or YYYY-MM-DD
  note: string;
  raw_transcript: string;
  pain_level: number; // 0-10
  is_edited: boolean;
  chief_complaint: string;
  history: string;
  radiograph_finding: string;
  examination: string;
  program?: Program | null;
}

export interface ParseResult {
  name: string;
  age: string;
  sex: string;
  doa: string;
  occupation: string;
  chief_complaint: string;
  history: string;
  radiograph_finding: string;
  examination: string;
  
  // Treatments
  tens: boolean;
  faradic: boolean;
  heat: boolean;
  heat_duration: string;
  ir: boolean;
  ultrasound: boolean;
  us_duration: string;
  vibrator: boolean;
  laser: boolean;
  traction: boolean;
  traction_kg: string;
  electromagnetic: boolean;
  pneumatic: boolean;
  
  unmatched?: string[];
}
