# How to Set the Service Account Secret in Cloudflare

## Method 1: Using Wrangler CLI (Recommended)

```bash
# Navigate to worker directory
cd /home/user/stock-reconciliation/stocktake-system/cloudflare-worker

# Login to Cloudflare (if not already)
npx wrangler login

# Set the secret
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_KEY

# When prompted, paste the ENTIRE contents of your service account JSON file
# (It should start with { and end with })
```

## Method 2: Using Cloudflare Dashboard

1. Go to: https://dash.cloudflare.com
2. Navigate to: **Workers & Pages**
3. Click on: **stocktake-reconciliation**
4. Go to: **Settings** → **Variables and Secrets**
5. Click: **Add variable** → Choose **Secret**
6. Variable name: `GOOGLE_SERVICE_ACCOUNT_KEY`
7. Value: Paste the ENTIRE JSON content from your service account key file
8. Click: **Save**

## What the JSON Should Look Like

```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "stocktake-worker@stocktake-reconciliation.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "..."
}
```

## Verify It's Set

```bash
cd /home/user/stock-reconciliation/stocktake-system/cloudflare-worker
npx wrangler secret list

# You should see:
# GOOGLE_SERVICE_ACCOUNT_KEY
# INITIAL_ADMIN_PASSWORD
```

## After Setting the Secret

1. **Redeploy your worker**:
   ```bash
   npx wrangler deploy
   ```

2. **Test the stocktake creation again**

3. If you still get errors, check the Cloudflare Workers logs:
   ```bash
   npx wrangler tail
   ```
   Then try creating a stocktake and watch the live logs.
