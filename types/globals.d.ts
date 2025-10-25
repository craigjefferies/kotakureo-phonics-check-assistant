// Type declarations for external CDN libraries
// These provide minimal typing for the global variables loaded from CDNs

declare global {
  // SheetJS (XLSX) library types
  namespace XLSX {
    interface WorkBook {
      SheetNames: string[];
      Sheets: { [sheetName: string]: WorkSheet };
    }

    interface WorkSheet {
      [cell: string]: CellObject;
    }

    interface CellObject {
      t: string; // type
      v: any; // value
      w?: string; // formatted text
    }

    interface ParsingOptions {
      type?: string;
    }

    interface Utils {
      sheet_to_json<T = any>(worksheet: WorkSheet, opts?: any): T[];
      aoa_to_sheet(data: any[][]): WorkSheet;
      book_new(): WorkBook;
      book_append_sheet(workbook: WorkBook, worksheet: WorkSheet, sheetName: string): void;
    }

    function read(data: any, opts?: ParsingOptions): WorkBook;
    function writeFile(workbook: WorkBook, filename: string): void;

    const utils: Utils;
  }

  const XLSX: typeof XLSX;

  // PDF.js library types
  namespace pdfjsLib {
    interface GlobalWorkerOptions {
      workerSrc: string;
    }

    interface PDFDocumentProxy {
      numPages: number;
      getPage(pageNumber: number): Promise<PDFPageProxy>;
    }

    interface PDFPageProxy {
      getTextContent(): Promise<TextContent>;
    }

    interface TextContent {
      items: TextItem[];
    }

    interface TextItem {
      str: string;
      height: number;
      width?: number;
      transform?: number[];
    }

    interface PDFLoadingTask<T> {
      promise: Promise<T>;
    }

    interface GetDocumentParameters {
      data?: Uint8Array;
      url?: string;
    }

    function getDocument(src: GetDocumentParameters): PDFLoadingTask<PDFDocumentProxy>;

    const GlobalWorkerOptions: GlobalWorkerOptions;
  }

  const pdfjsLib: typeof pdfjsLib;
}

declare global {
  interface Window {
    pdfJsReady?: boolean;
  }
}

export {};