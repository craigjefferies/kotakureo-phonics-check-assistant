import React, { useState, useCallback, useMemo, useEffect } from 'react';
import type { PhonicsSet, CheckResult, WordResult, PhonicsWord } from './types';
import useLocalStorage from './hooks/useLocalStorage';
import { parsePhonicsFile, parsePhonicsPdf, exportResultsToExcel } from './services/fileService';
import { UploadIcon, PlusIcon, CheckIcon, XMarkIcon, ArrowRightIcon, TrashIcon, ChevronDownIcon, DocumentArrowDownIcon } from './components/Icons';

type View = 'dashboard' | 'upload' | 'newCheck' | 'assessment' | 'summary';

const App: React.FC = () => {
    const [view, setView] = useState<View>('dashboard');
    const [phonicsSets, setPhonicsSets] = useLocalStorage<PhonicsSet[]>('phonicsSets', []);
    const [checkResults, setCheckResults] = useLocalStorage<CheckResult[]>('checkResults', []);
    const [currentCheck, setCurrentCheck] = useState<CheckResult | null>(null);

    const handleStartNewCheck = () => {
        setView('newCheck');
    };
    
    const handleSaveCheck = (result: CheckResult) => {
        setCheckResults(prev => [...prev.filter(r => r.id !== result.id), result]);
        setCurrentCheck(null);
        setView('dashboard');
    };

    const handleCreateCheck = (details: Omit<CheckResult, 'id'|'results'|'status'|'score'|'percentage'>) => {
        const newCheck: CheckResult = {
            ...details,
            id: `check_${Date.now()}`,
            results: [],
            status: 'in_progress',
            score: 0,
            percentage: 0,
        };
        setCurrentCheck(newCheck);
        setView('assessment');
    };
    
    const handleAssessmentComplete = (results: WordResult[], comment: string) => {
        if (!currentCheck) return;
        const correctCount = results.filter(r => r.result === 'correct').length;
        const finalCheck: CheckResult = {
            ...currentCheck,
            results,
            overallComment: comment,
            status: 'completed',
            score: correctCount,
            percentage: (correctCount / 40) * 100
        };
        setCurrentCheck(finalCheck);
        setView('summary');
    };
    
    return (
        <div className="min-h-screen bg-slate-50 text-slate-800">
            <Header onNavigate={() => setView('dashboard')} />
            <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
                {view === 'dashboard' && <Dashboard results={checkResults} onStartNewCheck={handleStartNewCheck} onUpload={() => setView('upload')} onViewResult={(result) => {setCurrentCheck(result); setView('summary')}}/>}
                {view === 'upload' && <UploadMaterials onUploadSuccess={(set) => { setPhonicsSets(prev => [...prev, set]); setView('dashboard');}} onCancel={() => setView('dashboard')} sets={phonicsSets} setSets={setPhonicsSets} />}
                {view === 'newCheck' && <NewCheck phonicsSets={phonicsSets} onStart={handleCreateCheck} onCancel={() => setView('dashboard')} />}
                {view === 'assessment' && currentCheck && <Assessment check={currentCheck} phonicsSets={phonicsSets} onComplete={handleAssessmentComplete} />}
                {view === 'summary' && currentCheck && <Summary result={currentCheck} onSave={handleSaveCheck} />}
            </main>
        </div>
    );
};

const Header: React.FC<{onNavigate: () => void}> = ({onNavigate}) => (
    <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
                <h1 onClick={onNavigate} className="text-2xl font-bold text-brand-700 cursor-pointer">
                    Phonics Check Assistant
                </h1>
            </div>
        </div>
    </header>
);

// --- DASHBOARD VIEW ---
const Dashboard: React.FC<{ results: CheckResult[], onStartNewCheck: () => void, onUpload: () => void, onViewResult: (result: CheckResult) => void }> = ({ results, onStartNewCheck, onUpload, onViewResult }) => {
    const sortedResults = [...results].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <h2 className="text-3xl font-bold text-slate-900">Dashboard</h2>
                <div className="flex items-center gap-2">
                    <Button onClick={onUpload} variant="secondary"><UploadIcon className="w-5 h-5 mr-2" /> Upload Materials</Button>
                    <Button onClick={onStartNewCheck}><PlusIcon className="w-5 h-5 mr-2" /> Start New Check</Button>
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
                                            <button onClick={() => onViewResult(result)} className="text-brand-600 hover:text-brand-800 font-medium">View</button>
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

// --- UPLOAD VIEW ---
const UploadMaterials: React.FC<{ onUploadSuccess: (set: PhonicsSet) => void, onCancel: () => void, sets: PhonicsSet[], setSets: React.Dispatch<React.SetStateAction<PhonicsSet[]>> }> = ({ onUploadSuccess, onCancel, sets, setSets }) => {
    const [file, setFile] = useState<File | null>(null);
    const [error, setError] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [termName, setTermName] = useState('');
    const [isPdfLibReady, setIsPdfLibReady] = useState(false);

    useEffect(() => {
        // Poll to check if pdf.js is loaded, since it's from a CDN script
        if ((window as any).pdfjsLib) {
            setIsPdfLibReady(true);
            return;
        }
        const intervalId = setInterval(() => {
            if ((window as any).pdfjsLib) {
                setIsPdfLibReady(true);
                clearInterval(intervalId);
            }
        }, 200);

        return () => clearInterval(intervalId);
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
    const uploadHint = file ? file.name : (isPdfLibReady ? "XLSX, XLS, or PDF up to 10MB" : "XLSX, XLS only (PDF support loading...)");

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
                        </div>
                    </div>
                </div>
                 <div>
                    <label htmlFor="termName" className="block text-sm font-medium text-slate-700">Term Name</label>
                    <input type="text" id="termName" value={termName} onChange={(e) => setTermName(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-brand-500 focus:border-brand-500 sm:text-sm" />
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

// --- NEW CHECK VIEW ---
const NewCheck: React.FC<{ phonicsSets: PhonicsSet[], onStart: (details: any) => void, onCancel: () => void }> = ({ phonicsSets, onStart, onCancel }) => {
    const [details, setDetails] = useState({ studentName: '', nsn: '', teacher: '', school: '', location: '', phonicsSetId: '', checkType: '20-week' });
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const selectedSet = phonicsSets.find(s => s.id === details.phonicsSetId);
        if (!selectedSet) {
            alert("Please select a valid term set.");
            return;
        }
        onStart({
            ...details,
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


// --- ASSESSMENT VIEW ---
const Assessment: React.FC<{ check: CheckResult, phonicsSets: PhonicsSet[], onComplete: (results: WordResult[], comment: string) => void }> = ({ check, phonicsSets, onComplete }) => {
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
                 <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a short note (e.g. 'did not blend')..." className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-brand-500 focus:border-brand-500 sm:text-sm" />
            </div>
        </div>
    );
};


// --- SUMMARY VIEW ---
const Summary: React.FC<{ result: CheckResult, onSave: (result: CheckResult) => void }> = ({ result, onSave }) => {
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
                    <Button onClick={() => exportResultsToExcel(finalResult)} variant="secondary"><DocumentArrowDownIcon className="w-5 h-5 mr-2"/> Export Excel</Button>
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
                                    <span className={`mr-3 w-5 h-5 rounded-full flex items-center justify-center text-white ${r.result === 'correct' ? 'bg-green-500' : 'bg-red-500'}`}>
                                        {r.result === 'correct' ? <CheckIcon className="w-3 h-3" /> : <XMarkIcon className="w-3 h-3"/>}
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

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'custom' }> = ({ children, className, variant = 'primary', ...props }) => {
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

export default App;