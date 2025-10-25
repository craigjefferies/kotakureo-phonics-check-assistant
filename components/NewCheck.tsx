import React, { useState } from 'react';
import type { PhonicsSet, CheckResult } from '../types';

interface NewCheckProps {
  phonicsSets: PhonicsSet[];
  onStart: (details: Omit<CheckResult, 'id'|'results'|'status'|'score'|'percentage'>) => void;
  onCancel: () => void;
}

const NewCheck: React.FC<NewCheckProps> = ({ phonicsSets, onStart, onCancel }) => {
  const [details, setDetails] = useState({
    studentName: '',
    nsn: '',
    teacher: '',
    school: '',
    location: '',
    phonicsSetId: '',
    checkType: '20-week' as '20-week' | '40-week',
    studentId: '',
    date: '',
    phonicsSetName: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedSet = phonicsSets.find(s => s.id === details.phonicsSetId);
    if (!selectedSet) {
      alert("Please select a valid term set.");
      return;
    }
    onStart({
      ...details,
      studentId: details.nsn,
      date: new Date().toISOString(),
      phonicsSetName: selectedSet.name
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setDetails(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const isFormValid = details.studentName && details.nsn && details.phonicsSetId;

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-3xl font-bold text-slate-900 mb-6">Start New Phonics Check</h2>
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputField label="Student Name" name="studentName" value={details.studentName} onChange={handleChange} required />
          <InputField label="NSN" name="nsn" value={details.nsn} onChange={handleChange} required />
          <InputField label="Teacher" name="teacher" value={details.teacher} onChange={handleChange} />
          <InputField label="School" name="school" value={details.school} onChange={handleChange} />
          <InputField label="Location" name="location" value={details.location} onChange={handleChange} />
          <SelectField label="Term Set" name="phonicsSetId" value={details.phonicsSetId} onChange={handleChange} required>
            <option value="" disabled>Select a term</option>
            {phonicsSets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </SelectField>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Check Type</label>
          <div className="flex gap-4">
            <RadioField label="20-week" name="checkType" value="20-week" checked={details.checkType === '20-week'} onChange={handleChange} />
            <RadioField label="40-week" name="checkType" value="40-week" checked={details.checkType === '40-week'} onChange={handleChange} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" onClick={onCancel} variant="secondary">Cancel</Button>
          <Button type="submit" disabled={!isFormValid}>Start Check</Button>
        </div>
      </form>
    </div>
  );
};

const InputField: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string }> = ({ label, ...props }) => (
  <div>
    <label htmlFor={props.name} className="block text-sm font-medium text-slate-700">{label}{props.required && <span className="text-red-500">*</span>}</label>
    <input {...props} id={props.name} className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-brand-500 focus:border-brand-500 sm:text-sm" />
  </div>
);

const SelectField: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }> = ({ label, children, ...props }) => (
  <div>
    <label htmlFor={props.name} className="block text-sm font-medium text-slate-700">{label}{props.required && <span className="text-red-500">*</span>}</label>
    <select {...props} id={props.name} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-brand-500 focus:border-brand-500 sm:text-sm rounded-md">
      {children}
    </select>
  </div>
);

const RadioField: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string }> = ({ label, ...props }) => (
  <div className="flex items-center">
    <input {...props} type="radio" className="focus:ring-brand-500 h-4 w-4 text-brand-600 border-slate-300" />
    <label htmlFor={props.id} className="ml-3 block text-sm font-medium text-slate-700">{label}</label>
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

export default NewCheck;