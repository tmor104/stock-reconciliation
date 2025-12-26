# Stocktake System - Quick Reference

## Common Commands

### Cloudflare Worker

```bash
# Install dependencies
npm install

# Run locally for testing
wrangler dev

# Create KV namespace
wrangler kv:namespace create "STOCKTAKE_KV"

# Set secrets
wrangler secret put GOOGLE_SERVICE_ACCOUNT_KEY
wrangler secret put INITIAL_ADMIN_PASSWORD

# Deploy to production
wrangler deploy

# View live logs
wrangler tail

# Delete deployment
wrangler delete
```

### Git/GitHub Pages

```bash
# Initial setup
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin YOUR_REPO_URL
git push -u origin main

# Update after changes
git add .
git commit -m "Update configuration"
git push
```

## Configuration Checklist

### Before Deployment

- [ ] Google Cloud project created
- [ ] Service account created and key downloaded
- [ ] Barcode mapping sheet created and shared
- [ ] Count sheets folder created and shared
- [ ] Cloudflare account created
- [ ] GitHub repository created

### Cloudflare Worker Setup

- [ ] `wrangler.toml` updated with:
  - [ ] BARCODE_SHEET_ID
  - [ ] COUNT_SHEETS_FOLDER_ID
  - [ ] KV namespace ID
- [ ] Secrets set:
  - [ ] GOOGLE_SERVICE_ACCOUNT_KEY
  - [ ] INITIAL_ADMIN_PASSWORD
- [ ] Worker deployed
- [ ] Worker URL noted

### Frontend Setup

- [ ] `frontend/app.js` updated with Worker URL
- [ ] Pushed to GitHub
- [ ] GitHub Pages enabled
- [ ] Site accessible at GitHub Pages URL

## Default Login

**Username:** admin  
**Password:** Whatever you set in INITIAL_ADMIN_PASSWORD

## Troubleshooting Commands

```bash
# Check worker logs
wrangler tail

# List KV namespaces
wrangler kv:namespace list

# View KV data
wrangler kv:key list --binding=STOCKTAKE_KV

# Get specific key
wrangler kv:key get "users" --binding=STOCKTAKE_KV

# Delete all data (fresh start)
wrangler kv:key delete "current_stocktake" --binding=STOCKTAKE_KV
wrangler kv:key delete "stocktake_history" --binding=STOCKTAKE_KV
```

## Google Sheets IDs

### Finding Sheet ID
URL: `https://docs.google.com/spreadsheets/d/SHEET_ID/edit`

The `SHEET_ID` is the long string in the middle.

### Finding Folder ID
URL: `https://drive.google.com/drive/folders/FOLDER_ID`

The `FOLDER_ID` is at the end of the URL.

## Common Issues

### "Invalid credentials"
1. Check password is correct
2. Run: `wrangler kv:key get "users" --binding=STOCKTAKE_KV`
3. Verify user exists and password hash matches

### "Failed to load count sheets"
1. Verify service account email has access to Drive folder
2. Check GOOGLE_SERVICE_ACCOUNT_KEY is set: `wrangler secret list`
3. Verify COUNT_SHEETS_FOLDER_ID in wrangler.toml

### "CORS error"
1. Verify Worker is deployed: `wrangler deployments list`
2. Check Worker URL in frontend/app.js matches deployed URL
3. Ensure corsHeaders are in all Worker responses

### Items not matching
1. Verify barcode mapping sheet has correct format (Barcode | Product)
2. Check product descriptions match EXACTLY between HnL and mapping
3. Verify BARCODE_SHEET_ID in wrangler.toml

## File Size Limits

- **HnL Excel Upload:** ~10MB max
- **Google Sheets:** 5 million cells max
- **Cloudflare Worker:** 1MB response size max

## Performance Tips

- Keep barcode mapping sheet under 10,000 rows
- Limit historical stocktakes to 50 (archive older ones)
- For large inventories (>5000 items), consider batching

## Security Best Practices

1. Use strong admin password (16+ characters)
2. Rotate service account keys annually
3. Don't commit secrets to Git
4. Review user list regularly
5. Archive completed stocktakes

## Support Resources

- Cloudflare Docs: https://developers.cloudflare.com/workers/
- Google Sheets API: https://developers.google.com/sheets/api
- GitHub Pages: https://pages.github.com/

## Version History

- v1.0 - Initial release
- Features: HnL import, variance calc, DAT export
