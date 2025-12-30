# Setup Checklist - Step by Step

Follow these steps in order to set up the stocktake reconciliation system.

---

## ✅ Step 1: Google Cloud Setup (15 minutes)

### 1.1 Create Google Cloud Project
- [ ] Go to https://console.cloud.google.com
- [ ] Create new project: "stocktake-reconciliation"
- [ ] Enable Google Sheets API
- [ ] Enable Google Drive API

### 1.2 Create Service Account
- [ ] Go to "IAM & Admin" → "Service Accounts"
- [ ] Create service account: "stocktake-worker"
- [ ] Download JSON key file (SAVE THIS SECURELY!)
- [ ] Copy the service account email (format: `stocktake-worker@...`)

**Time:** ~10 minutes  
**Cost:** $0

---

## ✅ Step 2: Google Sheets Setup (10 minutes)

### 2.1 Verify Master Sheet (if you have one)
- [ ] Check if you have Master Sheet with:
  - [ ] Product Database sheet
  - [ ] Users sheet
  - [ ] Locations sheet
- [ ] If missing, create them (see COMPLETE_SETUP_GUIDE.md Part 2)

### 2.2 Barcode Mapping (Choose ONE option)

**Option A: Auto-Use Master Sheet (EASIEST - Recommended!)**
- [ ] Make sure Master Sheet has "Product Database" sheet with:
  - Column A = "Barcode"
  - Column B = "Product"
- [ ] **Copy the Master Sheet ID from URL** (save this!)
- [ ] Share Master Sheet with service account email (Viewer access) - if not already done
- [ ] **Done!** No separate Barcode Mapping sheet needed

**Option B: Create Separate Barcode Mapping Sheet**
- [ ] Create new Google Sheet
- [ ] Name it: "Barcode Mapping"
- [ ] Add headers: Column A = "Barcode", Column B = "Product"
- [ ] Add a few sample rows
- [ ] **Copy the Sheet ID from URL** (save this!)
- [ ] Share with service account email (Viewer access)

**Time:** ~5 minutes (Option A) or ~10 minutes (Option B)  
**Cost:** $0

---

## ✅ Step 3: Cloudflare Setup (20 minutes)

### 3.1 Install Tools
- [ ] Install Node.js (if not installed): https://nodejs.org
- [ ] Install Wrangler: `npm install -g wrangler`
- [ ] Login to Cloudflare: `wrangler login`

### 3.2 Set Up Worker
- [ ] Navigate to: `stocktake-system/cloudflare-worker`
- [ ] Install dependencies: `npm install`
- [ ] Create KV namespace: `wrangler kv:namespace create "STOCKTAKE_KV"`
- [ ] **Copy the KV namespace ID** (save this!)

### 3.3 Configure Worker
- [ ] Edit `wrangler.toml`:
  - [ ] **If using Option A (Master Sheet):** Set `MASTER_SHEET_ID` (from Step 2.2)
  - [ ] **If using Option B (Separate sheet):** Set `BARCODE_SHEET_ID` (from Step 2.2)
  - [ ] Set `COUNT_SHEETS_FOLDER_ID` (can leave empty)
  - [ ] Set KV namespace `id` (from Step 3.2)

### 3.4 Set Secrets
- [ ] Set service account key:
  ```bash
  wrangler secret put GOOGLE_SERVICE_ACCOUNT_KEY
  # Paste entire JSON file contents
  ```
- [ ] Set admin password:
  ```bash
  wrangler secret put INITIAL_ADMIN_PASSWORD
  # Enter your desired admin password
  ```

### 3.5 Create Admin User
- [ ] Run: `node init-admin.js your-password-here`
- [ ] Copy the output command
- [ ] Run the command to add user to KV:
  ```bash
  wrangler kv:key put "users" '...' --binding=STOCKTAKE_KV
  ```

### 3.6 Deploy Worker
- [ ] Deploy: `wrangler deploy`
- [ ] **Copy the Worker URL** (save this!)
  - Format: `https://stocktake-reconciliation.YOUR-ACCOUNT.workers.dev`

**Time:** ~20 minutes  
**Cost:** $0

---

## ✅ Step 4: Frontend Setup (10 minutes)

### 4.1 Update Configuration
- [ ] Edit `stocktake-system/frontend/app.js`
- [ ] Update `WORKER_URL` with your Worker URL (from Step 3.6)
- [ ] (No need to update BARCODE_SHEET_ID - handled by backend now)

### 4.2 Deploy to GitHub Pages
- [ ] Create GitHub repository (if needed)
- [ ] Push code to GitHub
- [ ] Enable GitHub Pages in repository settings
- [ ] **Note your GitHub Pages URL**

**Time:** ~10 minutes  
**Cost:** $0

---

## ✅ Step 5: Testing (5 minutes)

### 5.1 Test Login
- [ ] Go to your GitHub Pages URL
- [ ] Login with:
  - Username: `admin`
  - Password: (the one you set in Step 3.4)
- [ ] ✅ Should see admin dashboard

### 5.2 Test Stocktake Creation
- [ ] Click "Start New Stocktake"
- [ ] Upload a sample HnL Excel file (if you have one)
- [ ] Select a count sheet (should show "Stocktake -" spreadsheets)
- [ ] Enter stocktake name
- [ ] Click "Create Stocktake"
- [ ] ✅ Should create successfully

### 5.3 Test Variance View
- [ ] Click "View Variance Report"
- [ ] ✅ Should show variance data (if count data exists)

**Time:** ~5 minutes

---

## 🎯 Total Setup Time: ~60 minutes

---

## Quick Command Reference

```bash
# Navigate to worker directory
cd stocktake-system/cloudflare-worker

# Install dependencies
npm install

# Create KV namespace
wrangler kv:namespace create "STOCKTAKE_KV"

# Set secrets
wrangler secret put GOOGLE_SERVICE_ACCOUNT_KEY
wrangler secret put INITIAL_ADMIN_PASSWORD

# Create admin user
node init-admin.js your-password

# Deploy
wrangler deploy

# View logs
wrangler tail
```

---

## What You'll Need to Save

Keep these handy:
1. ✅ Service account email
2. ✅ Service account JSON key file
3. ✅ Master Sheet ID (if using Option A for barcode mapping)
4. ✅ Barcode Mapping Sheet ID (if using Option B for barcode mapping)
5. ✅ KV Namespace ID
6. ✅ Worker URL
7. ✅ Admin password

---

## Need Help?

- **Detailed guide:** See `COMPLETE_SETUP_GUIDE.md`
- **Troubleshooting:** Check guide's troubleshooting section
- **Architecture:** See `ARCHITECTURE_EXPLANATION.md`
- **Costs:** See `COST_BREAKDOWN.md` (spoiler: $0)

---

## Ready to Start?

Begin with **Step 1** above, or follow the detailed guide in `COMPLETE_SETUP_GUIDE.md` for more detailed instructions.

Good luck! 🚀

