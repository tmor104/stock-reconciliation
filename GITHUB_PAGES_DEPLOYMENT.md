# GitHub Pages Deployment - Unified Stock System

## ✅ Files Ready

The unified system frontend files are now in the repository root:
- `index.html` - Main application
- `app.js` - Application logic
- `api-service.js` - API service
- `indexeddb-service.js` - IndexedDB service
- `styles.css` - Styling

## 🚀 Enable GitHub Pages

### Option 1: Via GitHub Web Interface (Recommended)

1. Go to: https://github.com/tmor104/stock-reconciliation/settings/pages
2. Under **Source**, select:
   - **Branch:** `main`
   - **Folder:** `/ (root)`
3. Click **Save**
4. Wait 1-2 minutes for deployment

### Option 2: Via GitHub CLI

```bash
gh api repos/tmor104/stock-reconciliation/pages \
  -X PUT \
  -f source[type]=branch \
  -f source[branch]=main \
  -f source[path]=/
```

## 📍 Your Site URL

Once enabled, your site will be available at:
```
https://tmor104.github.io/stock-reconciliation/
```

## ✅ Verification

After enabling Pages:

1. Wait 2-3 minutes for initial deployment
2. Check the Actions tab for build status
3. Visit: https://tmor104.github.io/stock-reconciliation/
4. You should see the login screen

## 🔧 Configuration

The frontend is already configured with:
- Worker URL: `https://stocktake-reconciliation.tomwmorgan47.workers.dev`
- All API endpoints ready
- IndexedDB for offline storage

## 🐛 Troubleshooting

### Site Not Loading?
- Check Settings → Pages to ensure it's enabled
- Verify branch is `main` and folder is `/ (root)`
- Wait 2-3 minutes for deployment
- Check Actions tab for errors

### 404 Error?
- Make sure you're accessing: `https://tmor104.github.io/stock-reconciliation/`
- Verify `index.html` exists in root
- Check browser console for errors

### API Errors?
- Verify Worker URL in `api-service.js` is correct
- Check Cloudflare Worker is deployed
- Check browser console for CORS errors

## 🔄 Updating

Every push to `main` branch automatically rebuilds and deploys within 1-2 minutes.

