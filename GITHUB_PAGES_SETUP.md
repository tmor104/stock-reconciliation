# GitHub Pages Setup Guide

## Quick Setup (5 minutes)

### Step 1: Enable GitHub Pages

1. Go to your repository: https://github.com/tmor104/stock-reconciliation
2. Click **Settings** (top menu)
3. Scroll down to **Pages** (left sidebar)
4. Under **Source**, select:
   - **Branch:** `main`
   - **Folder:** `/ (root)`
5. Click **Save**

### Step 2: Wait for Deployment

- GitHub will build and deploy your site (usually 1-2 minutes)
- You'll see a green checkmark when it's ready

### Step 3: Access Your Site

Your site will be available at:
```
https://tmor104.github.io/stock-reconciliation/stocktake-system/frontend/
```

**Note:** The frontend files are in `stocktake-system/frontend/`, so you need to include that path in the URL.

---

## Alternative: Custom Domain (Optional)

If you want a custom domain:
1. In Pages settings, add your custom domain
2. Update DNS records as instructed
3. Wait for SSL certificate (automatic)

---

## Troubleshooting

### Site Not Loading?
- Check that Pages is enabled in Settings
- Verify the branch is `main` and folder is `/ (root)`
- Wait 2-3 minutes for initial deployment
- Check Actions tab for build errors

### 404 Error?
- Make sure you're using the full path: `/stocktake-system/frontend/`
- Check that `index.html` exists in `stocktake-system/frontend/`

### Styling Not Working?
- Clear browser cache
- Check browser console for errors
- Verify all CSS files are committed to GitHub

---

## Updating Your Site

Every time you push to `main` branch, GitHub Pages will automatically rebuild and deploy your site within 1-2 minutes.

---

## Current Status

✅ Code pushed to GitHub  
✅ Ready for Pages deployment  
⏳ **Next:** Enable Pages in repository settings (see Step 1 above)

