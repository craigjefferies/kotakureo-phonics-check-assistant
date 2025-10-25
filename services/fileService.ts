import type { PhonicsSet, PhonicsWord, CheckResult } from '../types';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker for bundled version
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../pdf.worker.min.js', import.meta.url).toString();

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

        if (workbook.SheetNames.length === 0) {
          return reject(new Error("The Excel file contains no worksheets."));
        }

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet);

        if (json.length === 0) {
            return reject(new Error("The Excel file is empty or contains no data rows."));
        }

        console.log('Excel parsing: Found', json.length, 'rows with columns:', Object.keys(json[0] || {}));

        // Find the best column matches for "Item" and "Grapheme Type"
        const headers = Object.keys(json[0] || {});
        const itemColumn = findBestColumnMatch(headers, ['item', 'word', 'text', 'content', 'value']);
        const graphemeColumn = findBestColumnMatch(headers, ['grapheme', 'type', 'category', 'group', 'class']);

        if (!itemColumn) {
          return reject(new Error(`Could not find a column for words/items. Available columns: ${headers.join(', ')}. Expected something like "Item", "Word", or "Text".`));
        }

        console.log('Excel parsing: Using columns - Item:', itemColumn, 'Grapheme:', graphemeColumn);

        const words: PhonicsWord[] = [];
        let validRows = 0;

        for (let i = 0; i < json.length; i++) {
          const row = json[i];
          const item = row[itemColumn];
          const graphemeType = graphemeColumn ? row[graphemeColumn] : 'N/A (from Excel)';

          // Skip empty rows or rows with missing item
          if (!item || String(item).trim() === '') {
            continue;
          }

          const itemStr = String(item).trim();
          const graphemeStr = String(graphemeType).trim();

          // Basic validation - item should be a reasonable word
          if (itemStr.length < 1 || itemStr.length > 50) {
            console.warn(`Skipping row ${i + 2}: Item "${itemStr}" has invalid length`);
            continue;
          }

          words.push({ item: itemStr, graphemeType: graphemeStr });
          validRows++;
        }

        if (words.length === 0) {
          return reject(new Error("No valid words found in the Excel file. Please ensure the file contains a column with word data."));
        }

        if (words.length < 20 || words.length > 40) {
          const sampleWords = words.slice(0, 5).map(w => w.item).join(', ');
          return reject(new Error(`Expected 20-40 words for a phonics check (20-week or 40-week), but found ${words.length}. First few words: ${sampleWords}. Please ensure you're uploading a complete phonics check dataset.`));
        }

        const termName = file.name.replace(/\.(xlsx|xls|csv)$/i, '');
        console.log('Excel parsing: Successfully parsed', words.length, 'words for term:', termName);

        resolve({ name: termName, words });

      } catch (error) {
        console.error('Excel parsing error:', error);
        if (error instanceof Error) {
            reject(new Error(`Failed to parse Excel file: ${error.message}`));
        } else {
            reject(new Error("An unknown error occurred during Excel file parsing."));
        }
      }
    };
    reader.onerror = () => {
        reject(new Error('Error reading the Excel file.'));
    };
    reader.readAsArrayBuffer(file);
  });
};

// Helper function to find the best column match from a list of possible names
function findBestColumnMatch(availableHeaders: string[], possibleNames: string[]): string | null {
  const lowerHeaders = availableHeaders.map(h => h.toLowerCase());

  // First try exact matches
  for (const name of possibleNames) {
    const exactMatch = availableHeaders.find(h => h.toLowerCase() === name.toLowerCase());
    if (exactMatch) return exactMatch;
  }

  // Then try partial matches
  for (const name of possibleNames) {
    const partialMatch = availableHeaders.find(h => h.toLowerCase().includes(name.toLowerCase()));
    if (partialMatch) return partialMatch;
  }

  // Finally try fuzzy matches
  for (const header of availableHeaders) {
    const lowerHeader = header.toLowerCase();
    if (possibleNames.some(name => name.toLowerCase().includes(lowerHeader) || lowerHeader.includes(name.toLowerCase()))) {
      return header;
    }
  }

  return null;
}

export const parsePhonicsPdf = (file: File): Promise<Omit<PhonicsSet, 'id' | 'createdAt'>> => {
  return new Promise((resolve, reject) => {

    const reader = new FileReader();
    reader.onload = async (e: ProgressEvent<FileReader>) => {
      try {
        if (!e.target?.result) {
            return reject(new Error("File could not be read."));
        }
        const data = new Uint8Array(e.target.result as ArrayBuffer);
        const pdf = await pdfjsLib.getDocument({ data }).promise;

        console.log(`PDF loaded: ${pdf.numPages} pages`);

        const allWords: string[] = [];
        const seenWords = new Set<string>();

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          console.log(`Processing page ${pageNum}/${pdf.numPages}`);
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();

          console.log(`Page ${pageNum} has ${textContent.items.length} text items`);

          // Extract all text items
          const pageText = textContent.items
            .map((item: any) => ({
              text: item.str.trim(),
              height: item.height || 0,
              width: item.width || 0
            }))
            .filter((item: any) => item.text.length > 0);

          console.log(`Page ${pageNum} has ${pageText.length} non-empty text items`);

          // Skip pages that are clearly not word lists (headers, instructions, etc.)
          // Be more selective - only skip if the page is mostly headers/instructions
          const fullPageText = pageText.map(item => item.text.toLowerCase()).join(' ');

          const skipReasons: string[] = [];
          // Only skip if these terms appear frequently or the page is very short
          const headerTerms = ['published by', 'practice sheet', 'instructions', 'teacher guide'];
          const hasManyHeaders = headerTerms.some(term => fullPageText.split(term).length > 2);
          if (hasManyHeaders) skipReasons.push('contains multiple header terms');

          if (fullPageText.length < 50) skipReasons.push(`too short (${fullPageText.length} chars)`);

          // Skip if more than 80% of text is headers/instructions
          const headerWordCount = headerTerms.reduce((count, term) =>
            count + (fullPageText.split(term).length - 1), 0);
          const totalWords = fullPageText.split(/\s+/).length;
          if (headerWordCount > totalWords * 0.8) skipReasons.push('mostly headers/instructions');

          if (skipReasons.length > 0) {
            console.log(`Skipping page ${pageNum} because: ${skipReasons.join(', ')}`);
            continue;
          }

          // Find the most common font sizes (likely the word sizes)
          const fontSizes = pageText.map(item => Math.round(item.height));
          const sizeCounts: { [key: number]: number } = {};
          fontSizes.forEach(size => {
            sizeCounts[size] = (sizeCounts[size] || 0) + 1;
          });

          // Get the top 2 most common font sizes to capture both headers and body text
          const sortedSizes = Object.keys(sizeCounts)
            .map(size => ({ size: Number(size), count: sizeCounts[Number(size)] }))
            .sort((a, b) => b.count - a.count);
          const commonSizes = sortedSizes.slice(0, 2).map(s => s.size);

          console.log(`Most common font sizes: ${commonSizes.join(', ')}px`);

          // Extract words that are in the most common font sizes
          const pageWords = pageText
            .filter((item: any) => commonSizes.includes(Math.round(item.height)))
            .map((item: any) => item.text)
            .filter((text: string) => {
              // Filter for likely phonics words - be permissive for NZ MoE materials
              const cleanText = text.toLowerCase().trim();
              const isValidWord = cleanText.length >= 2 && // At least 2 characters
                     cleanText.length <= 20 && // Reasonable word length
                     /^[a-z]+$/i.test(cleanText) && // Only letters
                     !seenWords.has(cleanText); // Avoid duplicates

              // Skip practice words and obvious non-content
              const excludePatterns = /^(the|and|for|are|but|not|you|all|can|had|her|was|one|our|out|day|get|has|him|his|how|its|may|new|now|old|see|two|way|who|practice|sheet|familiarisation|before|begins|labelled|student|materials)$/i;

              if (excludePatterns.test(cleanText)) {
                return false;
              }

              return isValidWord;
            });

          console.log(`Page ${pageNum} extracted ${pageWords.length} candidate words:`, pageWords.slice(0, 10));

          // Add unique words from this page, but skip practice words that appear early
          pageWords.forEach((word, index) => {
            const lowerWord = word.toLowerCase();
            if (!seenWords.has(lowerWord)) {
              seenWords.add(lowerWord);

              // Skip the first few words if they look like practice words (very short, simple words)
              const isLikelyPracticeWord = allWords.length < 4 && word.length <= 3 && /^(it|on|in|at|up|if|is|as|by|or|so|no|go|do|to|me|my|he|she|we|be)$/i.test(word);

              if (!isLikelyPracticeWord) {
                allWords.push(word);
              } else {
                console.log(`Skipping likely practice word: "${word}"`);
              }
            }
          });
        }

        console.log(`Total candidate words found: ${allWords.length}`);
        console.log('All candidate words:', allWords.join(', '));

        if (allWords.length === 0) {
            return reject(new Error("Could not find any words in the PDF. Please ensure it is a valid phonics check document with word lists."));
        }

        // Handle practice words: NZ MoE phonics checks often have 4 practice words before the 40 scored words
        let finalWords: string[];
        if (allWords.length > 44) {
          // If we have significantly more than 40 words, skip the first 4 (likely practice words)
          finalWords = allWords.slice(4, 44); // Skip first 4, take next 40
          console.log(`Skipped first 4 practice words, using words 5-44:`, finalWords);
        } else if (allWords.length >= 40) {
          // Take the last 40 words (in case practice words appear first)
          finalWords = allWords.slice(-40);
          console.log(`Using last 40 words (assuming practice words appear first):`, finalWords);
        } else {
          // If we have fewer than 40, use what we have
          finalWords = allWords;
          console.log(`Using all ${finalWords.length} words found`);
        }

        // Allow flexibility for word count - NZ MoE phonics checks should be 20-40 words
        if (finalWords.length < 20) {
          return reject(new Error(`Expected 20-40 words for a phonics check (20-week or 40-week), but found ${finalWords.length}. The PDF may be in an unrecognized format or contain extra content. Found words: ${finalWords.slice(0, 10).join(', ')}${finalWords.length > 10 ? '...' : ''}`));
        }

        // Ensure we don't exceed 40 words
        if (finalWords.length > 40) {
          finalWords = finalWords.slice(0, 40);
        }

        console.log(`Final ${finalWords.length} words for phonics check:`, finalWords);

        const words: PhonicsWord[] = finalWords.map(item => ({ item, graphemeType: 'N/A (from PDF)' }));
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
  const workbook = XLSX.utils.book_new();

  // Create CoverSheet
  const coverSheetData = [
    ['English Phonics Check – Cover Sheet'],
    [],
    ['Student\'s full name *', result.studentName],
    ['NSN *', result.nsn],
    ['Teacher', result.teacher],
    ['School', result.school],
    ['Test date', result.date],
    ['Location of test', result.location],
    ['Check type', result.checkType],
    ['Delivery medium', 'Digital'], // Since this is exported from the app
    ['Reason if check not conducted', result.reasonNotDone || ''],
    ['Comments', result.overallComment || '']
  ];

  const coverSheet = XLSX.utils.aoa_to_sheet(coverSheetData);
  XLSX.utils.book_append_sheet(workbook, coverSheet, 'CoverSheet');

  // Create MarkingSheet
  const markingSheetData = [
    ['№', 'Item', 'Grapheme Type', 'Correct?', 'Comment']
  ];

  // Add each result
  result.results.forEach((wordResult, index) => {
    markingSheetData.push([
      (index + 1).toString(),
      wordResult.word.item,
      wordResult.word.graphemeType,
      wordResult.result === 'correct' ? 'Got it' : 'Not yet',
      wordResult.note || ''
    ]);
  });

  const markingSheet = XLSX.utils.aoa_to_sheet(markingSheetData);
  XLSX.utils.book_append_sheet(workbook, markingSheet, 'MarkingSheet');

  // Create Summary sheet
  const summaryData = [
    ['Grapheme Type', 'Correct', 'Out of', '%']
  ];

  // Group results by grapheme type
  const graphemeGroups: { [key: string]: { correct: number; total: number } } = {};

  result.results.forEach(wordResult => {
    const type = wordResult.word.graphemeType;
    if (!graphemeGroups[type]) {
      graphemeGroups[type] = { correct: 0, total: 0 };
    }
    graphemeGroups[type].total++;
    if (wordResult.result === 'correct') {
      graphemeGroups[type].correct++;
    }
  });

  // Add summary rows
  Object.entries(graphemeGroups).forEach(([type, stats]) => {
    const percentage = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
    summaryData.push([type, stats.correct.toString(), stats.total.toString(), percentage.toString()]);
  });

  // Add overall total
  const totalCorrect = result.results.filter(r => r.result === 'correct').length;
  summaryData.push([]);
  summaryData.push(['Total', totalCorrect.toString(), result.results.length.toString(), Math.round(result.percentage).toString()]);

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // Create Lists sheet (data validation)
  const listsData = [
    ['Lists Sheet - Data Validation'],
    [],
    ['Correct Values:'],
    ['Got it'],
    ['Not yet'],
    [],
    ['Location Values:'],
    ['Classroom'],
    ['Library'],
    ['Hall'],
    ['Other'],
    [],
    ['Reason Values:'],
    ['Absent'],
    ['Ill'],
    ['Refused'],
    ['Other'],
    [],
    ['Grapheme Types:'],
    ['VC'],
    ['CVC'],
    ['CVCC'],
    ['VCC'],
    ['CCVC'],
    ['Other'],
    [],
    ['Check Types:'],
    ['20-week'],
    ['40-week'],
    [],
    ['Delivery Medium:'],
    ['Digital'],
    ['Paper']
  ];

  const listsSheet = XLSX.utils.aoa_to_sheet(listsData);
  XLSX.utils.book_append_sheet(workbook, listsSheet, 'Lists');

  // Generate filename and download
  const dateStr = new Date(result.date).toISOString().split('T')[0];
  const filename = `Phonics-Check-Marking-Sheet-${result.studentName.replace(/\s/g, '_')}-${dateStr}.xlsx`;

  XLSX.writeFile(workbook, filename);
};