import type { PhonicsSet, PhonicsWord, CheckResult, WordResult } from '../types';
import JSZip from 'jszip';
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

const TEMPLATE_CANDIDATES = [
  'moe-phonics-marking-sheet-template.xlsx',
  'Phonics-Check-Marking-Sheet-test-2025-10-25.xlsx',
];

const SHEET_PATHS = {
  cover: 'xl/worksheets/sheet1.xml',
  marking: 'xl/worksheets/sheet2.xml',
};

const COVER_SHEET_CELLS = {
  studentName: 'C5',
  nsn: 'E5',
  testDate: 'C7',
  checkType: 'E7',
  reasonNotDone: 'C9',
  generalComment: 'E9',
  adminChange: 'C15',
  adminChangeReason: 'E15',
  location: 'C24',
  deliveryMedium: 'E24',
  duration: 'G24',
};

const MARKING_SHEET_CONFIG = {
  setNameCell: 'F2',
  startRow: 4,
  columns: {
    number: 'B',
    item: 'C',
    graphemeType: 'D',
    correct: 'E',
    comment: 'F',
  },
};

function formatDisplayDate(date: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }
  return parsed.toLocaleDateString('en-NZ');
}

function cellReference(column: string, row: number): string {
  return `${column}${row}`;
}

function findRowElement(doc: Document, rowNumber: number): Element | null {
  const rows = Array.from(doc.getElementsByTagName('row'));
  return rows.find(row => Number(row.getAttribute('r')) === rowNumber) || null;
}

function findCellElement(row: Element, reference: string): Element | null {
  const cells = Array.from(row.getElementsByTagName('c'));
  return cells.find(cell => cell.getAttribute('r') === reference) || null;
}

function clearCellContents(doc: Document, cell: Element): void {
  if (cell.hasChildNodes()) {
    while (cell.firstChild) {
      cell.removeChild(cell.firstChild);
    }
  }
  if (cell.getAttribute('t')) {
    cell.removeAttribute('t');
  }
}

function setInlineStringValue(doc: Document, cell: Element | null, value: string): void {
  if (!cell) return;
  const namespace = doc.documentElement.namespaceURI;
  clearCellContents(doc, cell);
  if (!value) {
    return;
  }
  if (namespace) {
    cell.setAttribute('t', 'inlineStr');
    const isElement = doc.createElementNS(namespace, 'is');
    const textElement = doc.createElementNS(namespace, 't');
    textElement.textContent = value;
    isElement.appendChild(textElement);
    cell.appendChild(isElement);
  }
}

function upsertCell(doc: Document, reference: string): Element | null {
  const namespace = doc.documentElement.namespaceURI;
  const rowNumber = parseInt(reference.replace(/[^0-9]/g, ''), 10);
  if (!namespace || Number.isNaN(rowNumber)) {
    return null;
  }
  let row = findRowElement(doc, rowNumber);
  if (!row) {
    const sheetData = doc.getElementsByTagName('sheetData')[0];
    if (!sheetData) {
      return null;
    }
    row = doc.createElementNS(namespace, 'row');
    row.setAttribute('r', rowNumber.toString());
    sheetData.appendChild(row);
  }
  let cell = findCellElement(row, reference);
  if (!cell) {
    cell = doc.createElementNS(namespace, 'c');
    cell.setAttribute('r', reference);
    row.appendChild(cell);
  }
  return cell;
}

async function loadTemplate(): Promise<JSZip> {
  const failures: string[] = [];

  for (const candidate of TEMPLATE_CANDIDATES) {
    try {
      const base = typeof window !== 'undefined'
        ? `${window.location.origin}${import.meta.env.BASE_URL}`
        : import.meta.env.BASE_URL;
      const url = new URL(candidate, base).toString();
      const response = await fetch(url);

      if (!response.ok) {
        failures.push(`${candidate} (status ${response.status})`);
        continue;
      }

      const buffer = await response.arrayBuffer();
      return JSZip.loadAsync(buffer);
    } catch (error) {
      failures.push(candidate);
    }
  }

  throw new Error(`Unable to load export template. Tried: ${failures.join(', ')}`);
}

function updateCoverSheet(doc: Document, result: CheckResult): void {
  try {
    setInlineStringValue(doc, upsertCell(doc, COVER_SHEET_CELLS.studentName), result.studentName);
    setInlineStringValue(doc, upsertCell(doc, COVER_SHEET_CELLS.nsn), result.nsn);
    setInlineStringValue(doc, upsertCell(doc, COVER_SHEET_CELLS.testDate), formatDisplayDate(result.date));
    setInlineStringValue(doc, upsertCell(doc, COVER_SHEET_CELLS.checkType), result.checkType);
    setInlineStringValue(doc, upsertCell(doc, COVER_SHEET_CELLS.reasonNotDone), result.reasonNotDone || '');
    setInlineStringValue(doc, upsertCell(doc, COVER_SHEET_CELLS.generalComment), result.overallComment || '');
    setInlineStringValue(doc, upsertCell(doc, COVER_SHEET_CELLS.adminChange), '');
    setInlineStringValue(doc, upsertCell(doc, COVER_SHEET_CELLS.adminChangeReason), '');
    setInlineStringValue(doc, upsertCell(doc, COVER_SHEET_CELLS.location), result.location || '');
    setInlineStringValue(doc, upsertCell(doc, COVER_SHEET_CELLS.deliveryMedium), 'Digital');
    setInlineStringValue(doc, upsertCell(doc, COVER_SHEET_CELLS.duration), '');
  } catch (error) {
    console.error('Cover sheet update failed:', error);
    throw error;
  }
}

function mapResultOutcome(outcome: WordResult['result']): string {
  if (outcome === 'correct') return 'Got it';
  if (outcome === 'incorrect') return 'Not yet';
  return '';
}

function updateMarkingSheet(doc: Document, result: CheckResult): void {
  try {
    setInlineStringValue(doc, upsertCell(doc, MARKING_SHEET_CONFIG.setNameCell), result.phonicsSetName);

    const totalRows = Math.min(result.results.length, 40);

    for (let index = 0; index < totalRows; index++) {
      const rowNumber = MARKING_SHEET_CONFIG.startRow + index;
    const correctRef = cellReference(MARKING_SHEET_CONFIG.columns.correct, rowNumber);
    const commentRef = cellReference(MARKING_SHEET_CONFIG.columns.comment, rowNumber);
    const wordResult = result.results[index];

    setInlineStringValue(doc, upsertCell(doc, correctRef), mapResultOutcome(wordResult.result));
    setInlineStringValue(doc, upsertCell(doc, commentRef), wordResult.note || '');
  }

  for (let index = result.results.length; index < 40; index++) {
    const rowNumber = MARKING_SHEET_CONFIG.startRow + index;
    setInlineStringValue(doc, upsertCell(doc, cellReference(MARKING_SHEET_CONFIG.columns.correct, rowNumber)), '');
    setInlineStringValue(doc, upsertCell(doc, cellReference(MARKING_SHEET_CONFIG.columns.comment, rowNumber)), '');
  }
  } catch (error) {
    console.error('Marking sheet update failed:', error);
    throw error;
  }
}

async function markWorkbookForRecalculation(zip: JSZip, parser: DOMParser, serializer: XMLSerializer): Promise<void> {
  try {
    const workbookFile = zip.file('xl/workbook.xml');
    if (!workbookFile) {
      return;
    }

    const workbookXml = await workbookFile.async('text');
    const workbookDoc = parser.parseFromString(workbookXml, 'application/xml');

    if (workbookDoc.getElementsByTagName('parsererror').length > 0) {
      throw new Error('Failed to parse workbook XML');
    }

    const namespace = workbookDoc.documentElement.namespaceURI;
    if (!namespace) {
      return;
    }

    let workbookPr = workbookDoc.getElementsByTagNameNS(namespace, 'workbookPr')[0];
    if (!workbookPr) {
      workbookPr = workbookDoc.createElementNS(namespace, 'workbookPr');
      workbookDoc.documentElement.insertBefore(workbookPr, workbookDoc.documentElement.firstChild);
    }
    workbookPr.setAttribute('calcMode', 'auto');
    workbookPr.setAttribute('calcCompleted', '0');
    workbookPr.setAttribute('fullCalcOnLoad', '1');

    let calcPr = workbookDoc.getElementsByTagNameNS(namespace, 'calcPr')[0];
    if (!calcPr) {
      calcPr = workbookDoc.createElementNS(namespace, 'calcPr');
      workbookDoc.documentElement.appendChild(calcPr);
    }
    const calcId = parseInt(calcPr.getAttribute('calcId') || '191028', 10) + 1;
    calcPr.setAttribute('calcId', calcId.toString());
    calcPr.setAttribute('calcOnSave', '1');
    calcPr.setAttribute('fullCalcOnLoad', '1');
    calcPr.setAttribute('forceFullCalc', '1');

    zip.file('xl/workbook.xml', serializer.serializeToString(workbookDoc));
  } catch (error) {
    console.error('Failed to mark workbook for recalculation', error);
  }
}

export const exportResultsToExcel = async (result: CheckResult) => {
  try {
    const zip = await loadTemplate();
    const parser = new DOMParser();
    const serializer = new XMLSerializer();

    const coverSheetXml = await zip.file(SHEET_PATHS.cover)?.async('text');
    const markingSheetXml = await zip.file(SHEET_PATHS.marking)?.async('text');

    if (!coverSheetXml || !markingSheetXml) {
      throw new Error('Template is missing expected worksheets');
    }

    const coverDoc = parser.parseFromString(coverSheetXml, 'application/xml');
    const markingDoc = parser.parseFromString(markingSheetXml, 'application/xml');

    // Check if parsing failed
    if (coverDoc.getElementsByTagName('parsererror').length > 0) {
      throw new Error('Failed to parse cover sheet XML');
    }
    if (markingDoc.getElementsByTagName('parsererror').length > 0) {
      throw new Error('Failed to parse marking sheet XML');
    }

    updateCoverSheet(coverDoc, result);
    updateMarkingSheet(markingDoc, result);

    zip.file(SHEET_PATHS.cover, serializer.serializeToString(coverDoc));
    zip.file(SHEET_PATHS.marking, serializer.serializeToString(markingDoc));

    await markWorkbookForRecalculation(zip, parser, serializer);

    // Force recalculation by removing calcChain and clearing cached formula values
    if (zip.file('xl/calcChain.xml')) {
      zip.remove('xl/calcChain.xml');
    }

    // Also clear cached values in Summary sheet to force recalculation
    try {
      const summarySheetPath = 'xl/worksheets/sheet3.xml';
      const summaryXml = await zip.file(summarySheetPath)?.async('text');
      if (summaryXml) {
        const summaryDoc = parser.parseFromString(summaryXml, 'application/xml');
        // Clear cached values for formula cells in Summary sheet (rows 4-16, columns C-E)
        for (let row = 4; row <= 16; row++) {
          for (const col of ['C', 'D', 'E']) {
            const cellRef = `${col}${row}`;
            const cell = summaryDoc.querySelector(`c[r="${cellRef}"]`);
            if (cell && cell.querySelector('f')) {
              // Remove the cached value <v> if it exists, keeping only the formula <f>
              const vElement = cell.querySelector('v');
              if (vElement) {
                cell.removeChild(vElement);
              }
            }
          }
        }
        zip.file(summarySheetPath, serializer.serializeToString(summaryDoc));
      }
    } catch (error) {
      console.warn('Failed to clear Summary sheet cached values:', error);
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const dateStr = new Date(result.date).toISOString().split('T')[0];
    const filename = `Phonics-Check-Marking-Sheet-${result.studentName.replace(/\s/g, '_')}-${dateStr}.xlsx`;

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    }, 100);

  } catch (error) {
    console.error('Export failed:', error);
    alert('Unable to export results. Please try again.');
  }
};
