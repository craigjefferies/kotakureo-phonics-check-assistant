import React, { useState, useEffect } from 'react';
import type { PhonicsSet } from '../types';
import { UploadIcon, TrashIcon } from './Icons';

interface UploadMaterialsProps {
  onUploadSuccess: (set: PhonicsSet) => void;
  onCancel: () => void;
  sets: PhonicsSet[];
  setSets: React.Dispatch<React.SetStateAction<PhonicsSet[]>>;
}

const UploadMaterials: React.FC<UploadMaterialsProps> = ({ onUploadSuccess, onCancel, sets, setSets }) => {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [termName, setTermName] = useState('');
  const [isPdfLibReady, setIsPdfLibReady] = useState(true); // PDF.js is now bundled

  useEffect(() => {
    // PDF.js is now bundled with the application, so it's always ready
    console.log('UploadMaterials: PDF.js is bundled and ready');
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setTermName(selectedFile.name.replace(/\.(xlsx|xls|csv|pdf)$/i, ''));
      setError('');
    }
  };

  const handleDeleteSet = (id: string) => {
    if (window.confirm('Are you sure you want to delete this term set? This action cannot be undone.')) {
      setSets(prev => prev.filter(s => s.id !== id));
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      let parsedSet;

      if (fileExtension === 'pdf') {
        parsedSet = await parsePhonicsPdf(file);
      } else if (['xlsx', 'xls'].includes(fileExtension || '')) {
        parsedSet = await parsePhonicsFile(file);
      } else {
        throw new Error("Unsupported file type. Please upload an Excel (.xlsx, .xls) or PDF file.");
      }

      const newSet: PhonicsSet = {
        ...parsedSet,
        name: termName || parsedSet.name,
        id: `set_${Date.now()}`,
        createdAt: new Date().toISOString()
      };
      onUploadSuccess(newSet);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const acceptedFileTypes = isPdfLibReady ? ".xlsx, .xls, .pdf" : ".xlsx, .xls";
  const uploadHint = file ? file.name : (isPdfLibReady ? "XLSX, XLS, or PDF up to 10MB" : "XLSX, XLS only");

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-3xl font-bold text-slate-900">Upload & Manage Materials</h2>
            <div className="bg-white p-6 rounded-lg shadow-sm space-y-4">
        <h3 className="text-xl font-semibold">Upload New Term Set</h3>
        {error && <p className="text-red-600 bg-red-100 p-3 rounded-md">{error}</p>}
        <div>
          <label htmlFor="file-upload" className="block text-sm font-medium text-slate-700 mb-1">Phonics Materials File</label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-md">
            <div className="space-y-1 text-center">
              <UploadIcon className="mx-auto h-12 w-12 text-slate-400" />
              <div className="flex text-sm text-slate-600">
                <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-brand-600 hover:text-brand-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-brand-500">
                  <span>Upload a file</span>
                  <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept={acceptedFileTypes} />
                </label>
                <p className="pl-1">or drag and drop</p>
              </div>
              <p className="text-xs text-slate-500">{uploadHint}</p>
              <div className="mt-2 text-xs text-slate-600 bg-slate-50 p-2 rounded">
                <p className="font-medium mb-1">� Upload Formats:</p>
                <ul className="text-left space-y-1">
                  <li>• <strong>PDF:</strong> NZ MoE phonics materials (e.g., "Term 4 2025-1.pdf")</li>
                  <li>• <strong>Excel:</strong> .xlsx or .xls files with word lists</li>
                  <li>• Both formats should contain exactly 40 words</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        <div>
          <label htmlFor="termName" className="block text-sm font-medium text-slate-700">Term Name</label>
          <input
            type="text"
            id="termName"
            value={termName}
            onChange={(e) => setTermName(e.target.value)}
            className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-brand-500 focus:border-brand-500 sm:text-sm"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button onClick={onCancel} variant="secondary">Cancel</Button>
          <Button onClick={handleUpload} disabled={isLoading || !file}>
            {isLoading ? 'Processing...' : 'Upload & Save'}
          </Button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h3 className="text-xl font-semibold mb-4">Existing Term Sets</h3>
        {sets.length > 0 ? (
          <ul className="space-y-2">
            {sets.map(s => (
              <li key={s.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-md">
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-sm text-slate-500">Uploaded on {new Date(s.createdAt).toLocaleDateString()}</p>
                </div>
                <button onClick={() => handleDeleteSet(s.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-100 rounded-full">
                  <TrashIcon className="w-5 h-5" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-center text-slate-500 py-4">No term sets uploaded yet.</p>
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

// Import the parsing functions
import { parsePhonicsFile, parsePhonicsPdf } from '../services/fileService';

export default UploadMaterials;