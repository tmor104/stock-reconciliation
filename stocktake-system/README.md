# Stocktake Reconciliation System

A comprehensive web-based system for reconciling theoretical stock from HnL against physical stocktake counts.

## Features

- ✅ Parse and import HnL Excel exports
- ✅ Real-time variance calculations
- ✅ Support for barcode scanning integration
- ✅ Manual count adjustments with audit trail
- ✅ Advanced filtering and sorting
- ✅ Export to Excel and HnL .dat format
- ✅ Multi-user support with role-based access
- ✅ Completely free (using free tiers)

## Quick Start

### Prerequisites
- GitHub account
- Cloudflare account
- Google Cloud account
- Your HnL stocktake export file
- Barcode mapping Google Sheet

### Installation

1. **Clone/Download this repository**

2. **Set up Google Cloud** (see docs/SETUP_GUIDE.md for details)
   - Create project
   - Enable Sheets & Drive APIs
   - Create service account
   - Download credentials JSON

3. **Deploy Cloudflare Worker**
   ```bash
   cd cloudflare-worker
   npm install
   
   # Create KV namespace
   wrangler kv:namespace create "STOCKTAKE_KV"
   
   # Update wrangler.toml with KV ID and your Google Sheet IDs
   
   # Set secrets
   wrangler secret put GOOGLE_SERVICE_ACCOUNT_KEY
   wrangler secret put INITIAL_ADMIN_PASSWORD
   
   # Deploy
   wrangler deploy
   ```

4. **Deploy Frontend to GitHub Pages**
   ```bash
   # Update frontend/app.js with your Worker URL
   
   git add .
   git commit -m "Initial commit"
   git push origin main
   
   # Enable GitHub Pages in repository settings
   ```

5. **Access the System**
   - Open your GitHub Pages URL
   - Login with username: `admin` and the password you set
   - Start your first stocktake!

## Usage

### Admin Workflow

1. **Start Stocktake**
   - Upload HnL Excel export
   - Select count sheet from dropdown
   - System creates Google Sheet and links data

2. **Monitor Progress**
   - Real-time variance report
   - Filter by category, sort by variance
   - See counted vs. uncounted items

3. **Manual Adjustments**
   - Click "Edit" on any item
   - Enter new count with reason
   - Automatically saved to audit trail

4. **Finish Stocktake**
   - Generates .dat file for HnL import
   - Locks spreadsheet (read-only)
   - Archives for future reference

### User Workflow

- View variance reports
- Make manual count adjustments
- Export reports to Excel

## System Architecture

```
┌─────────────────┐
│  GitHub Pages   │  Static frontend (HTML/CSS/JS)
│   (Frontend)    │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ Cloudflare      │  Serverless API
│   Workers       │  - Parse HnL files
│   (Backend)     │  - Calculate variance
└────────┬────────┘  - Handle auth
         │
         ↓
┌─────────────────┐
│ Google Sheets   │  Data storage
│   + KV Store    │  - Theoretical stock
└─────────────────┘  - Count data
                     - Audit trail
```

## File Structure

```
stocktake-system/
├── frontend/
│   ├── index.html          # Main UI
│   ├── styles.css          # Styling
│   └── app.js              # Frontend logic
├── cloudflare-worker/
│   ├── index.js            # Worker entry point
│   ├── package.json
│   ├── wrangler.toml       # Configuration
│   ├── parsers/
│   │   └── hnl-parser.js   # Excel parsing
│   └── services/
│       ├── auth.js         # Authentication
│       ├── google-sheets.js # Google Sheets API
│       ├── variance-calculator.js
│       └── export.js       # Report generation
└── docs/
    └── SETUP_GUIDE.md      # Detailed setup instructions
```

## Data Flow

### 1. Upload HnL Export
```
HnL Excel → Parse → Google Sheets (Theoretical)
```

### 2. Count Data
```
Count App → Google Sheet → Read by System
```

### 3. Variance Calculation
```
Theoretical + Counts + Adjustments → Variance Report
```

### 4. Export to HnL
```
Variance Data → .dat file (barcode + count)
```

## Technical Details

### HnL Export Format
- Merged cells with category headers
- Product data in rows
- Handles negative theoretical quantities
- Supports various units of measure

### DAT File Format
```
BARCODE         COUNT
9300857058404   15.5
```
- Barcode at position 1
- Count at position 17
- Fixed-width format

### Barcode Mapping
Google Sheet with two columns:
- Barcode → Product (matching HnL description)

### Security
- SHA-256 password hashing
- Token-based authentication
- Service account for Google Sheets
- HTTPS everywhere

## Cost

**$0/month** - Completely free using:
- GitHub Pages (free)
- Cloudflare Workers (100k requests/day free)
- Cloudflare KV (100k reads/day free)
- Google Cloud (free tier)

## Integration with Other Systems

This system integrates with:
- **Barcode Scanning App:** Reads count data from Google Sheets
- **HnL System:** Imports Excel exports and exports .dat files

For details on integrating with other systems, see:
- `../INTEGRATION_GUIDE.md` - How to manage multi-repo integrations
- `../INTEGRATION_CONTRACT_TEMPLATE.md` - Template for defining integration contracts

## Support

See `docs/SETUP_GUIDE.md` for detailed documentation.

For issues:
1. Check Cloudflare Worker logs: `wrangler tail`
2. Check browser console
3. Verify Google Sheets permissions

## Future Enhancements

- [ ] Real-time WebSocket updates
- [ ] Mobile app for scanning
- [ ] Historical variance analysis
- [ ] Automated email reports
- [ ] Integration with other POS systems

## License

MIT License - feel free to use and modify for your needs.
