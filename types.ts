
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
  result: 'correct' | 'incorrect' | 'not_attempted';
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

export interface MarkingSheetData {
  studentName: string;
  nsn: string;
  teacher: string;
  school: string;
  date: string;
  location: string;
  checkType: '20-week' | '40-week';
  deliveryMedium: 'Digital' | 'Paper';
  reasonNotDone?: 'Absent' | 'Ill' | 'Refused' | 'Other';
  comments?: string;
  results: Array<{
    itemNo: number;
    word: string;
    graphemeType: string;
    correct: 'Got it' | 'Not yet';
    comment?: string;
  }>;
}
