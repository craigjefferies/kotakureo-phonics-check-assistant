
export interface PhonicsWord {
  item: string;
  graphemeType: string;
}

export interface PhonicsSet {
  id: string;
  name: string;
  words: PhonicsWord[];
  createdAt: string;
}

export interface WordResult {
  word: PhonicsWord;
  result: 'correct' | 'incorrect';
  note?: string;
}

export interface Student {
  id: string; // NSN can serve as ID
  name: string;
}

export type CheckStatus = 'completed' | 'not_done' | 'in_progress';

export interface CheckResult {
  id: string;
  studentId: string;
  studentName: string;
  nsn: string;
  teacher: string;
  date: string;
  school: string;
  location: string;
  phonicsSetId: string;
  phonicsSetName: string;
  checkType: '20-week' | '40-week';
  status: CheckStatus;
  results: WordResult[];
  overallComment?: string;
  reasonNotDone?: 'Absent' | 'Ill' | 'Other';
  score: number;
  percentage: number;
}
