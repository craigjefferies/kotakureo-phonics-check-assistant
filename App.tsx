import React, { useState, useCallback, useMemo, useEffect, Suspense } from 'react';
import type { PhonicsSet, CheckResult, WordResult, PhonicsWord } from './types';
import useLocalStorage from './hooks/useLocalStorage';
import Dashboard from './components/Dashboard';
import NewCheck from './components/NewCheck';
import Assessment from './components/Assessment';
import Summary from './components/Summary';

// Lazy load UploadMaterials to reduce initial bundle size
const UploadMaterials = React.lazy(() => import('./components/UploadMaterials'));

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
        
        // Find the phonics set to get all words
        const phonicsSet = phonicsSets.find(s => s.id === currentCheck.phonicsSetId);
        if (!phonicsSet) return;
        
        // Pad results with "not_attempted" for remaining words
        const paddedResults: WordResult[] = [...results];
        for (let i = results.length; i < phonicsSet.words.length; i++) {
            paddedResults.push({
                word: phonicsSet.words[i],
                result: 'not_attempted',
                note: 'Assessment stopped early'
            });
        }
        
        const correctCount = paddedResults.filter(r => r.result === 'correct').length;
        const finalCheck: CheckResult = {
            ...currentCheck,
            results: paddedResults,
            overallComment: comment,
            status: 'completed',
            score: correctCount,
            percentage: (correctCount / phonicsSet.words.length) * 100
        };
        setCurrentCheck(finalCheck);
        setView('summary');
    };
    
    return (
        <div className="min-h-screen bg-slate-50 text-slate-800">
            <Header onNavigate={() => setView('dashboard')} />
            <main className="p-2 sm:p-4 lg:p-6 max-w-7xl mx-auto">
                {view === 'dashboard' && <Dashboard results={checkResults} onStartNewCheck={handleStartNewCheck} onUpload={() => setView('upload')} onViewResult={(result) => {setCurrentCheck(result); setView('summary')}}/>}
                {view === 'upload' && (
                    <Suspense fallback={<div className="flex items-center justify-center p-8"><div className="text-lg">Loading upload tools...</div></div>}>
                        <UploadMaterials onUploadSuccess={(set) => { setPhonicsSets(prev => [...prev, set]); setView('dashboard');}} onCancel={() => setView('dashboard')} sets={phonicsSets} setSets={setPhonicsSets} />
                    </Suspense>
                )}
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
            <div className="flex justify-between items-center py-3">
                <h1 onClick={onNavigate} className="text-xl font-bold text-brand-700 cursor-pointer">
                    Phonics Check Assistant
                </h1>
            </div>
        </div>
    </header>
);

export default App;