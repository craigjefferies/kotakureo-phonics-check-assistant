import React, { useState, useMemo } from 'react';
import type { CheckResult } from '../types';
import { CheckIcon, XMarkIcon, DocumentArrowDownIcon } from './Icons';
import { exportResultsToExcel } from '../services/fileService';

interface SummaryProps {
  result: CheckResult;
  onSave: (result: CheckResult) => void;
}

const Summary: React.FC<SummaryProps> = ({ result, onSave }) => {
  const [finalResult, setFinalResult] = useState(result);

  const graphemeBreakdown = useMemo(() => {
    const breakdown: { [key: string]: { correct: number, total: number } } = {};
    finalResult.results.forEach(r => {
      const type = r.word.graphemeType;
      if (!breakdown[type]) {
        breakdown[type] = { correct: 0, total: 0 };
      }
      breakdown[type].total++;
      if (r.result === 'correct') {
        breakdown[type].correct++;
      }
    });
    return Object.entries(breakdown).sort((a,b) => a[0].localeCompare(b[0]));
  }, [finalResult.results]);

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFinalResult(prev => ({...prev, overallComment: e.target.value}));
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 print:space-y-4 print:shadow-none">
      <div className="flex justify-between items-start print:hidden">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Check Summary</h2>
          <p className="text-slate-500">For {finalResult.studentName} on {new Date(finalResult.date).toLocaleDateString()}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => { void exportResultsToExcel(finalResult); }} variant="secondary">
            <DocumentArrowDownIcon className="w-5 h-5 mr-2"/> Export Excel
          </Button>
          <Button onClick={handlePrint} variant="secondary">Print</Button>
          <Button onClick={() => onSave(finalResult)}>Save & Finish</Button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm print:shadow-none print:p-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center mb-8">
          <StatCard label="Total Score" value={`${finalResult.score} / 40`} />
          <StatCard label="Percentage" value={`${finalResult.percentage.toFixed(1)}%`} />
          <StatCard label="Student" value={finalResult.studentName} />
          <StatCard label="Term" value={finalResult.phonicsSetName} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-3">Grapheme Breakdown</h3>
            <div className="space-y-2">
              {graphemeBreakdown.map(([type, stats]) => (
                <div key={type}>
                  <div className="flex justify-between text-sm font-medium text-slate-600">
                    <span>{type}</span>
                    <span>{stats.correct} / {stats.total}</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 mt-1">
                    <div className="bg-brand-500 h-2 rounded-full" style={{width: `${(stats.correct / stats.total) * 100}%`}}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-3">Overall Comment</h3>
            <textarea
              value={finalResult.overallComment || ''}
              onChange={handleCommentChange}
              rows={5}
              className="w-full p-2 border border-slate-300 rounded-md focus:ring-brand-500 focus:border-brand-500"
              placeholder="Add an overall comment..."
            />
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-3">Word by Word Results</h3>
          <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-md">
            {finalResult.results.map((r, index) => (
              <div key={index} className={`flex items-center justify-between p-3 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                <div className="flex items-center">
                  <span className={`mr-3 w-5 h-5 rounded-full flex items-center justify-center text-white ${
                    r.result === 'correct' ? 'bg-green-500' :
                    r.result === 'incorrect' ? 'bg-red-500' :
                    'bg-gray-400'
                  }`}>
                    {r.result === 'correct' ? <CheckIcon className="w-3 h-3" /> :
                     r.result === 'incorrect' ? <XMarkIcon className="w-3 h-3"/> :
                     <span className="text-xs">-</span>}
                  </span>
                  <span className="font-mono text-lg">{r.word.item}</span>
                </div>
                <span className="text-sm text-slate-500 italic">{r.note}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{label: string, value: string}> = ({label, value}) => (
  <div className="bg-slate-50 p-4 rounded-lg">
    <p className="text-sm text-slate-500">{label}</p>
    <p className="text-2xl font-bold text-brand-700">{value}</p>
  </div>
);

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

export default Summary;
