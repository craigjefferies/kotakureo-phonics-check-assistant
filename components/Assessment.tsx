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

  // Function to infer basic grapheme type from word structure
  const inferGraphemeType = useCallback((word: string): string => {
    if (word.includes('N/A')) return word; // Keep original N/A messages

    const lowerWord = word.toLowerCase();
    const vowels = 'aeiou';
    const consonants = 'bcdfghjklmnpqrstvwxyz';

    // Count vowels and consonants
    let vowelCount = 0;
    let consonantCount = 0;
    let hasDigraph = false;

    for (let i = 0; i < lowerWord.length; i++) {
      const char = lowerWord[i];
      if (vowels.includes(char)) {
        vowelCount++;
      } else if (consonants.includes(char)) {
        consonantCount++;
        // Check for common digraphs
        if (i < lowerWord.length - 1) {
          const nextChar = lowerWord[i + 1];
          if (['ch', 'sh', 'th', 'wh', 'ph', 'ck', 'ng', 'qu'].some(d => char + nextChar === d)) {
            hasDigraph = true;
          }
        }
      }
    }

    // Basic pattern recognition
    if (lowerWord.length === 1) return 'Single Letter';
    if (lowerWord.length === 2) {
      if (vowelCount === 1 && consonantCount === 1) return 'VC';
      if (consonantCount === 2) return 'CC';
    }
    if (lowerWord.length === 3) {
      if (vowelCount === 1 && consonantCount === 2) {
        if (hasDigraph) return 'Digraph CC';
        return 'CVC';
      }
    }
    if (lowerWord.length === 4) {
      if (vowelCount === 1 && consonantCount === 3) return 'CCVC';
      if (vowelCount === 2 && consonantCount === 2) return 'CVCC';
    }

    // More complex patterns
    if (hasDigraph) return 'Contains Digraph';
    if (vowelCount > consonantCount) return 'Vowel Heavy';
    if (consonantCount > vowelCount + 1) return 'Consonant Heavy';

    return 'Complex Pattern';
  }, []);

  const displayGraphemeType = currentWord.graphemeType.includes('N/A')
    ? inferGraphemeType(currentWord.item)
    : currentWord.graphemeType;

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
      <div className="mb-2">
        <div className="flex justify-between items-center mb-1 text-sm text-slate-600">
          <span>Progress</span>
          <span>Word {wordIndex + 1} of {words.length}</span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div className="bg-brand-600 h-2 rounded-full" style={{ width: `${progress}%` }}></div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 my-2">
        <div className="text-center mb-2">
          <p className="text-7xl sm:text-8xl lg:text-9xl font-bold tracking-wider leading-tight mb-1">{currentWord.item}</p>
        </div>
        <div className="border-t border-slate-200 pt-2">
          <div className="flex items-center justify-center">
            <div className="text-center">
              <p className="text-slate-600 text-xs font-medium mb-0.5">Grapheme Type</p>
              <p className={`text-sm font-semibold ${displayGraphemeType.includes('N/A') || displayGraphemeType.includes('Not specified') || displayGraphemeType.includes('Complex') ? 'text-slate-400 italic' : 'text-slate-700'}`}>
                {displayGraphemeType}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-xl mx-auto mb-2">
        <Button onClick={() => handleMark('correct')} variant="custom" className="bg-green-600 hover:bg-green-700 text-white text-lg py-3 flex items-center justify-center">
          <CheckIcon className="w-5 h-5 mr-2" /> Got it
        </Button>
        <Button onClick={() => handleMark('incorrect')} variant="custom" className="bg-red-600 hover:bg-red-700 text-white text-lg py-3 flex items-center justify-center">
          <XMarkIcon className="w-5 h-5 mr-2" /> Not yet
        </Button>
      </div>

      <div className="max-w-xl mx-auto">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a short note..."
          className="block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-brand-500 focus:border-brand-500 text-sm"
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