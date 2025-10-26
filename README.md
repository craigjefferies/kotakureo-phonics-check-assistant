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

## Railway Deployment

This application is configured for easy deployment on Railway.

### Automatic Deployment

1. **Connect to Railway**:
   - Go to [Railway.app](https://railway.app) and sign in
   - Click "New Project" → "Deploy from GitHub repo"
   - Select this repository

2. **Railway will automatically**:
   - Detect the Vite configuration
   - Install dependencies
   - Build the application
   - Deploy to a live URL

### Manual Deployment (Alternative)

If you prefer manual control:

1. **Push to GitHub** (if not already done):
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Deploy on Railway**:
   - Railway will detect the `railway.toml` or `railway.json` configuration
   - The app will build and deploy automatically

### Environment Variables

If your app requires environment variables (like API keys), add them in your Railway project settings under "Variables".

### Custom Domain (Optional)

In Railway project settings, you can add a custom domain under "Settings" → "Domains".

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
