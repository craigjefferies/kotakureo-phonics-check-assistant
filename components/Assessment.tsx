import React, { useState, useMemo, useCallback } from 'react';
import type { CheckResult, PhonicsSet, WordResult } from '../types';
import { CheckIcon, XMarkIcon } from './Icons';

interface AssessmentProps {
  check: CheckResult;
  phonicsSets: PhonicsSet[];
  onComplete: (results: WordResult[], comment: string) => void;
}

const Assessment: React.FC<AssessmentProps> = ({ check, phonicsSets, onComplete }) => {
  const [wordIndex, setWordIndex] = useState(0);
  const [results, setResults] = useState<WordResult[]>([]);
  const [note, setNote] = useState('');

  const phonicsSet = phonicsSets.find(s => s.id === check.phonicsSetId);
  if (!phonicsSet) return <p>Error: Phonics set not found.</p>;

  const words = phonicsSet.words;
  const currentWord = words[wordIndex];

  const consecutiveIncorrect = useMemo(() => {
    let count = 0;
    for (let i = results.length - 1; i >= 0; i--) {
      if (results[i].result === 'incorrect') {
        count++;
      } else {
        break;
      }
    }
    return count;
  }, [results]);

  const handleMark = useCallback((result: 'correct' | 'incorrect') => {
    const newResult: WordResult = { word: currentWord, result, note };
    const newResults = [...results, newResult];

    const newConsecutiveIncorrect = (result === 'incorrect' ? consecutiveIncorrect + 1 : 0);

    if (wordIndex === words.length - 1 || newConsecutiveIncorrect >= 5) {
      onComplete(newResults, '');
    } else {
      setResults(newResults);
      setWordIndex(prev => prev + 1);
      setNote('');
    }
  }, [wordIndex, words, results, note, onComplete, currentWord, consecutiveIncorrect]);

  const progress = (wordIndex / words.length) * 100;

  return (
    <div className="max-w-3xl mx-auto text-center">
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1 text-sm text-slate-600">
          <span>Progress</span>
          <span>Word {wordIndex + 1} of {words.length}</span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2.5">
          <div className="bg-brand-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-8 sm:p-12 my-8">
        <p className="text-7xl sm:text-8xl lg:text-9xl font-bold tracking-wider">{currentWord.item}</p>
        <p className="text-slate-500 mt-2">Grapheme Type: {currentWord.graphemeType}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl mx-auto">
        <Button onClick={() => handleMark('correct')} variant="custom" className="bg-green-600 hover:bg-green-700 text-white text-2xl py-6 flex items-center justify-center">
          <CheckIcon className="w-8 h-8 mr-3" /> Got it
        </Button>
        <Button onClick={() => handleMark('incorrect')} variant="custom" className="bg-red-600 hover:bg-red-700 text-white text-2xl py-6 flex items-center justify-center">
          <XMarkIcon className="w-8 h-8 mr-3" /> Not yet
        </Button>
      </div>

      <div className="mt-6 max-w-xl mx-auto">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a short note (e.g. 'did not blend')..."
          className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-brand-500 focus:border-brand-500 sm:text-sm"
        />
      </div>
    </div>
  );
};

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'custom' }> = ({
  children,
  className,
  variant = 'primary',
  ...props
}) => {
  const baseClasses = "inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

  const variantClasses = {
    primary: "text-white bg-brand-600 hover:bg-brand-700 focus:ring-brand-500",
    secondary: "text-brand-700 bg-brand-100 hover:bg-brand-200 focus:ring-brand-500",
    custom: ""
  };

  return (
    <button className={`${baseClasses} ${variantClasses[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

export default Assessment;