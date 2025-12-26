# Deployment Guide - Stock Reconciliation System

This guide will walk you through deploying your stock reconciliation system to production.

## Prerequisites

Before you begin, ensure you have:
- ✅ GitHub account
- ✅ Cloudflare account (free tier is sufficient)
- ✅ Google Cloud account (free tier is sufficient)
- ✅ Node.js and npm installed locally
- ✅ Git installed locally

## Security Improvements Implemented

This deployment includes the following security enhancements:

1. **✅ PBKDF2 Password Hashing** - Replaced SHA-256 with proper password hashing
2. **✅ CORS Restrictions** - No longer accepts requests from any origin
3. **✅ Rate Limiting** - Prevents brute force attacks (5 login attempts/minute)
4. **✅ XSS Prevention** - All user input is sanitized before display
5. **✅ Input Validation** - File types, sizes, and all inputs are validated
6. **✅ No Inline Event Handlers** - Uses addEventListener for better security
7. **✅ Toast Notifications** - Replaced alert() with professional UI notifications

## Step 1: Google Cloud Setup

### 1.1 Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Create Project"
3. Name it "Stocktake System" (or your preferred name)
4. Click "Create"

### 1.2 Enable Required APIs

1. Go to "APIs & Services" > "Library"
2. Search for and enable:
   - Google Sheets API
   - Google Drive API

### 1.3 Create Service Account

1. Go to "IAM & Admin" > "Service Accounts"
2. Click "Create Service Account"
3. Name: `stocktake-service-account`
4. Click "Create and Continue"
5. Role: Select "Editor" (or more restrictive if you prefer)
6. Click "Done"

### 1.4 Create and Download Key

1. Click on your newly created service account
2. Go to "Keys" tab
3. Click "Add Key" > "Create New Key"
4. Select "JSON"
5. Click "Create" - this downloads the key file
6. **IMPORTANT**: Keep this file secure! Never commit it to Git

### 1.5 Prepare Your Google Sheets

1. Create a new Google Sheet for barcode mapping with two columns:
   - Column A: Barcode
   - Column B: Product Description

2. Create a Google Drive folder for count sheets

3. Share both with your service account email (found in the JSON file as `client_email`):
   - Right-click > Share
   - Paste the service account email
   - Give "Editor" permissions

4. Note the IDs:
   - Sheet ID: the long string in the URL between `/d/` and `/edit`
   - Folder ID: the long string in the URL after `/folders/`

## Step 2: Cloudflare Workers Setup

### 2.1 Install Wrangler CLI

```bash
npm install -g wrangler
```

### 2.2 Login to Cloudflare

```bash
wrangler login
```

### 2.3 Create KV Namespace

```bash
cd stocktake-system/cloudflare-worker
npm install
wrangler kv:namespace create "STOCKTAKE_KV"
```

Copy the `id` from the output (you'll need it for wrangler.toml).

### 2.4 Configure wrangler.toml

```bash
cp wrangler.toml.template wrangler.toml
```

Edit `wrangler.toml` and update:
- `id` under `kv_namespaces` - paste the KV namespace ID from step 2.3
- `BARCODE_SHEET_ID` - your barcode mapping sheet ID
- `COUNT_SHEETS_FOLDER_ID` - your Google Drive folder ID
- `ALLOWED_ORIGINS` - add your GitHub Pages URL (you'll get this in step 3)

### 2.5 Set Secrets

Set your Google Service Account key:

```bash
cat path/to/your-service-account-key.json | wrangler secret put GOOGLE_SERVICE_ACCOUNT_KEY
```

Set your initial admin password:

```bash
echo "YourSecurePassword123!" | wrangler secret put INITIAL_ADMIN_PASSWORD
```

**IMPORTANT**: Remember this password! You'll use it to login as `admin`.

### 2.6 Deploy Worker

```bash
wrangler deploy
```

Copy the Worker URL from the output (e.g., `https://stocktake-reconciliation.your-subdomain.workers.dev`).

## Step 3: GitHub Pages Setup

### 3.1 Update Frontend Configuration

Edit `stocktake-system/frontend/app.js`:

Find the CONFIG section (around line 3) and update:

```javascript
const CONFIG = {
    WORKER_URL: 'https://your-worker-url.workers.dev', // Paste your Worker URL here
    BARCODE_SHEET_ID: 'YOUR_BARCODE_SHEET_ID', // Your sheet ID
    PASSWORD_ITERATIONS: 100000,
};
```

### 3.2 Commit and Push to GitHub

```bash
git add .
git commit -m "Initial deployment with security improvements"
git push origin claude/review-and-deploy-JEBj5
```

### 3.3 Enable GitHub Pages

1. Go to your repository on GitHub
2. Click "Settings"
3. Click "Pages" in the left sidebar
4. Under "Source", select your branch
5. Select "/ (root)" as the folder
6. Click "Save"
7. Wait a few minutes for deployment
8. Your site will be available at: `https://yourusername.github.io/your-repo-name/`

### 3.4 Update CORS Settings

Go back to `cloudflare-worker/wrangler.toml` and add your GitHub Pages URL to `ALLOWED_ORIGINS`:

```toml
ALLOWED_ORIGINS = "https://yourusername.github.io,http://localhost:8787"
```

Then redeploy the worker:

```bash
cd stocktake-system/cloudflare-worker
wrangler deploy
```

## Step 4: Test the System

### 4.1 Access Your Application

Go to your GitHub Pages URL.

### 4.2 Login

- Username: `admin`
- Password: The password you set in step 2.5

### 4.3 Create Additional Users (Optional)

1. In the admin dashboard, go to "User Management"
2. Add usernames, passwords, and select roles
3. Regular users can view variance reports
4. Admins can manage stocktakes and users

### 4.4 Test Workflow

1. **Start a Stocktake**:
   - Click "Start New Stocktake"
   - Upload an HnL Excel export
   - Select a count sheet
   - Give it a name

2. **View Variance Report**:
   - Click "View Variance Report"
   - Check the color coding works
   - Test filters and sorting

3. **Edit a Count**:
   - Click "Edit" on any item
   - Change the count
   - Add a reason
   - Verify it updates

4. **Export Reports**:
   - Try exporting variance report (Excel)
   - Try exporting manual entry list (TXT)

5. **Finish Stocktake**:
   - Click "Finish Current Stocktake"
   - Download the .dat file
   - Verify it's in the correct format

## Step 5: Ongoing Maintenance

### Updating the Application

To deploy updates:

```bash
# Update code
git add .
git commit -m "Description of changes"
git push

# If you changed the worker:
cd stocktake-system/cloudflare-worker
wrangler deploy
```

### Monitoring

#### Cloudflare Worker Logs

```bash
cd stocktake-system/cloudflare-worker
wrangler tail
```

#### Check Rate Limiting

Rate limits are automatically handled:
- Login: 5 attempts per minute per IP
- API calls: 100 requests per minute

### Rotating Secrets

Periodically rotate your secrets:

```bash
# Generate new service account key in Google Cloud
# Then update the secret:
cat new-service-account-key.json | wrangler secret put GOOGLE_SERVICE_ACCOUNT_KEY

# Update admin password:
echo "NewSecurePassword!" | wrangler secret put INITIAL_ADMIN_PASSWORD
```

## Troubleshooting

### "Unauthorized" Errors

1. Check your service account has access to the Google Sheets
2. Verify the GOOGLE_SERVICE_ACCOUNT_KEY secret is set correctly
3. Check the sheet IDs in wrangler.toml are correct

### CORS Errors

1. Verify ALLOWED_ORIGINS in wrangler.toml includes your GitHub Pages URL
2. Make sure you redeployed the worker after updating CORS settings

### Rate Limit Issues

If legitimate users are getting rate limited:
- Increase the limits in `index.js` (RATE_LIMITS configuration)
- Redeploy the worker

### Login Not Working

1. Check the INITIAL_ADMIN_PASSWORD secret is set
2. Verify you're using username: `admin`
3. Check browser console for errors

## Security Best Practices

1. **Never commit secrets** - They're in .gitignore for a reason
2. **Use strong passwords** - Especially for admin accounts
3. **Rotate credentials** - Change service account keys periodically
4. **Monitor logs** - Watch for suspicious activity
5. **Keep dependencies updated** - Run `npm audit` regularly
6. **Limit access** - Only share with users who need it

## Cost Estimate

With the free tiers:
- Cloudflare Workers: 100,000 requests/day (FREE)
- Cloudflare KV: 100,000 reads/day (FREE)
- Google Cloud: Sheets API calls within free limits (FREE)
- GitHub Pages: Unlimited static hosting (FREE)

**Expected cost: $0/month** for normal usage

## Support

If you encounter issues:

1. Check Cloudflare Worker logs: `wrangler tail`
2. Check browser console (F12) for frontend errors
3. Verify all configuration values are correct
4. Check that Google Sheets are shared with service account
5. Review the main README.md for system architecture details

## Next Steps

Once deployed, you might want to:

- Set up automated backups of your KV data
- Add monitoring/alerting for errors
- Implement the historical stocktake viewing feature
- Add email notifications
- Create custom reports

---

**Congratulations! Your stock reconciliation system is now live and secured! 🎉**
