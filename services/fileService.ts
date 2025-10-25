import type { PhonicsSet, PhonicsWord, CheckResult } from '../types';

// This function assumes the SheetJS library is loaded globally via a script tag in index.html
declare var XLSX: any;
// This function assumes the PDF.js library is loaded globally
declare var pdfjsLib: any;

export const parsePhonicsFile = (file: File): Promise<Omit<PhonicsSet, 'id' | 'createdAt'>> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        if (!e.target?.result) {
            return reject(new Error("File could not be read."));
        }
        const data = new Uint8Array(e.target.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet);

        if (json.length === 0) {
            return reject(new Error("The Excel file is empty."));
        }

        const words: PhonicsWord[] = json.map((row, index) => {
          const item = row['Item'] || row['item'];
          const graphemeType = row['Grapheme Type'] || row['grapheme type'];

          if (!item || !graphemeType) {
            throw new Error(`Row ${index + 2} is missing 'Item' or 'Grapheme Type' column.`);
          }
          return { item: String(item).trim(), graphemeType: String(graphemeType).trim() };
        });

        if (words.length !== 40) {
          return reject(new Error(`File must contain exactly 40 words, but found ${words.length}.`));
        }
        
        const termName = file.name.replace(/\.(xlsx|xls|csv)$/i, '');

        resolve({ name: termName, words });

      } catch (error) {
        if (error instanceof Error) {
            reject(new Error(`Failed to parse file: ${error.message}`));
        } else {
            reject(new Error("An unknown error occurred during file parsing."));
        }
      }
    };
    reader.onerror = () => {
        reject(new Error('Error reading the file.'));
    };
    reader.readAsArrayBuffer(file);
  });
};

export const parsePhonicsPdf = (file: File): Promise<Omit<PhonicsSet, 'id' | 'createdAt'>> => {
  return new Promise((resolve, reject) => {
    if (typeof pdfjsLib === 'undefined') {
        return reject(new Error("PDF processing library is not loaded."));
    }
    
    // Configure the worker to avoid errors
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.js`;

    const reader = new FileReader();
    reader.onload = async (e: ProgressEvent<FileReader>) => {
      try {
        if (!e.target?.result) {
            return reject(new Error("File could not be read."));
        }
        const data = new Uint8Array(e.target.result as ArrayBuffer);
        const pdf = await pdfjsLib.getDocument({ data }).promise;
        
        const allWords: string[] = [];

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ').toLowerCase();
          
          if (pageText.includes('student materials') || pageText.includes('published by') || pageText.includes('practice sheet')) {
            continue;
          }
          
          if (textContent.items.length === 0) {
            continue;
          }

          let maxHeight = 0;
          for (const item of textContent.items) {
            if (item.height > maxHeight) {
              maxHeight = item.height;
            }
          }

          if (maxHeight < 20) {
            continue;
          }

          const pageWords = textContent.items
            .filter((item: any) => item.height > maxHeight * 0.8)
            .map((item: any) => item.str.trim())
            .filter((str: string) => str.length > 0 && /^[a-z]+$/i.test(str));

          allWords.push(...pageWords);
        }
        
        if (allWords.length === 0) {
            return reject(new Error("Could not find any words in the PDF. Please ensure it is a valid phonics check document in the expected format."));
        }

        if (allWords.length !== 40) {
          return reject(new Error(`File must contain exactly 40 words, but found ${allWords.length}. The PDF may be in an unrecognized format.`));
        }

        const words: PhonicsWord[] = allWords.map(item => ({ item, graphemeType: 'N/A (from PDF)' }));
        const termName = file.name.replace(/\.pdf$/i, '');
        resolve({ name: termName, words });

      } catch (error) {
        console.error("PDF Parsing Error:", error);
        if (error instanceof Error) {
            reject(new Error(`Failed to parse PDF file: ${error.message}`));
        } else {
            reject(new Error("An unknown error occurred during PDF parsing."));
        }
      }
    };
    reader.onerror = () => {
        reject(new Error('Error reading the file.'));
    };
    reader.readAsArrayBuffer(file);
  });
};


export const exportResultsToExcel = (result: CheckResult) => {
    const data = [
      ["Student Name", result.studentName],
      ["NSN", result.nsn],
      ["Date", result.date],
      ["School", result.school],
      ["Location", result.location],
      ["Teacher", result.teacher],
      ["Check Type", result.checkType],
      ["Term Set", result.phonicsSetName],
      [],
      ["Word", "Result", "Note"],
      ...result.results.map(r => [r.word.item, r.result === 'correct' ? 'Got it' : 'Not yet', r.note || '']),
      [],
      ["Total Score", `${result.score} / 40`],
      ["Percentage", `${result.percentage.toFixed(1)}%`],
      ["Overall Comment", result.overallComment || '']
    ];
  
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Phonics Check Result");
  
    // This will trigger a download of the Excel file
    XLSX.writeFile(workbook, `Phonics-Check-${result.studentName.replace(/\s/g, '_')}-${result.date}.xlsx`);
};