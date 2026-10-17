export type Prediction = 'forgive' | 'hiss' | 'unsure';
export type Outcome = 'forgive' | 'hiss';
export type Theme = 'dark' | 'light';
export interface SealInput { title: string; content: string; defense: string; prediction: Prediction }
export interface Verdict { outcome: Outcome; judgedAt: number; judgedDate: string; predictionMatched: boolean | null }
export interface CapsuleRecord extends SealInput {
  id: string; caseNumber: number; sealedAt: number; sealedDate: string; unlockDate: string;
  sealedTimeZone: string; verdict: Verdict | null;
}
export interface CapsuleSummary {
  id: string; caseNumber: number; title: string | null; sealedAt: number; sealedDate: string;
  unlockDate: string; status: 'sealed' | 'ready' | 'judged'; verdict: Verdict | null;
}
export type CaseFile = Omit<CapsuleRecord, 'prediction' | 'verdict'> & (
  { status: 'ready'; prediction?: never; verdict?: never } |
  { status: 'judged'; prediction: Prediction; verdict: Verdict }
);
export interface Statistics {
  sealedTotal: number; trialsTotal: number; hissTotal: number; forgiveTotal: number;
  predictedTotal: number; correctPredictions: number; accuracy: number | null;
  forgiveStreak: number; monthlyHiss: number; weekdayCounts: number[]; busiestWeekdays: number[];
}
export interface AppSettings { theme: Theme; onboardingDone: boolean }
export interface Backup { app: 'yesterday-me'; version: 1; exportedAt: string; capsules: CapsuleRecord[] }
export interface ImportResult { added: number; skipped: number; conflicts: number }
