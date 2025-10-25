import React from 'react';
import type { CheckResult } from '../types';
import { PlusIcon, UploadIcon } from '../components/Icons';

interface DashboardProps {
  results: CheckResult[];
  onStartNewCheck: () => void;
  onUpload: () => void;
  onViewResult: (result: CheckResult) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ results, onStartNewCheck, onUpload, onViewResult }) => {
  const sortedResults = [...results].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h2 className="text-3xl font-bold text-slate-900">Dashboard</h2>
        <div className="flex items-center gap-2">
          <Button onClick={onUpload} variant="secondary">
            <UploadIcon className="w-5 h-5 mr-2" /> Upload Materials
          </Button>
          <Button onClick={onStartNewCheck}>
            <PlusIcon className="w-5 h-5 mr-2" /> Start New Check
          </Button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h3 className="text-xl font-semibold mb-4">Recent Checks</h3>
        {sortedResults.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b-2 border-slate-200">
                <tr className="text-slate-500">
                  <th className="p-3">Student</th>
                  <th className="p-3">Date</th>
                  <th className="p-3 hidden sm:table-cell">Term Set</th>
                  <th className="p-3">Score</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {sortedResults.map(result => (
                  <tr key={result.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-3 font-medium">{result.studentName}</td>
                    <td className="p-3 text-slate-600">{new Date(result.date).toLocaleDateString()}</td>
                    <td className="p-3 text-slate-600 hidden sm:table-cell">{result.phonicsSetName}</td>
                    <td className="p-3 font-semibold text-brand-700">{result.score}/40</td>
                    <td className="p-3 text-right">
                      <button onClick={() => onViewResult(result)} className="text-brand-600 hover:text-brand-800 font-medium">
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-slate-500 py-8">No phonics checks have been recorded yet.</p>
        )}
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

export default Dashboard;