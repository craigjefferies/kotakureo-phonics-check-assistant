# Phonics Check Assistant

A React-based application for conducting and managing New Zealand Ministry of Education (MoE) phonics checks. This tool allows teachers to upload phonics materials and perform standardized assessments, then export results to MoE-compliant Excel marking sheets.

## Features

- **Upload Phonics Materials**: Support for both Excel (.xlsx, .xls, .csv) and PDF formats
- **Student Assessment**: Interactive phonics testing interface
- **Results Management**: View and manage completed assessments
- **Excel Export**: Generate MoE-compliant marking sheets with CoverSheet, MarkingSheet, Summary, and Lists
- **Local Storage**: All data stored locally in the browser

## Prerequisites

- **Node.js** (version 18 or higher)
- **npm** (comes with Node.js)

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd kotakureo-phonics-check-assistant
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:3000`

## Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Usage

1. **Upload Materials** (Admin): Upload phonics check materials in Excel or PDF format
2. **Start Assessment**: Create a new phonics check for a student
3. **Conduct Test**: Guide the student through the phonics assessment
4. **Review Results**: View detailed results and grapheme breakdowns
5. **Export**: Generate Excel marking sheets for MoE submission

## File Formats Supported

- **Excel**: .xlsx, .xls, .csv files with columns for words/items and grapheme types
- **PDF**: NZ MoE phonics materials (automatically extracts word lists)

## Data Storage

All assessment data is stored locally in your browser's localStorage. No data is sent to external servers.
