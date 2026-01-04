# Setting Up API Secret for Apps Script Authentication

## What is the API Secret?

The API secret is a password that protects your Apps Script endpoint from unauthorized access. When enabled, only requests that include the correct secret can execute operations.

## Current Status

**The secret is currently OPTIONAL** - if you don't set it, the code will still work (it only checks if the secret is not the default "CHANGE_THIS_SECRET" value).

## Option 1: Set Secret in Apps Script (Recommended)

### Step 1: Generate a Secure Secret

Use any of these methods to generate a random secret:

**Method A: Online Generator**
- Go to https://www.uuidgenerator.net/
- Copy a UUID (e.g., `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)

**Method B: Terminal/Command Line**
```bash
# On Mac/Linux:
openssl rand -hex 32

# Or generate UUID:
uuidgen
```

**Method C: Use a Password Manager**
- Generate a random 32+ character string
- Example: `MySecureSecret2024!@#$%^&*()_+`

### Step 2: Set Secret in Apps Script

1. Open your Apps Script project: https://script.google.com
2. Click on **Project Settings** (gear icon) in the left sidebar
3. Scroll down to **Script Properties**
4. Click **Add script property**
5. Set:
   - **Property**: `API_SECRET`
   - **Value**: Your generated secret (paste it here)
6. Click **Save script properties**

### Step 3: Update Apps Script Code (Optional)

You can also hardcode it in the code, but Script Properties is more secure:

```javascript
const API_SECRET = 'CHANGE_THIS_SECRET'; // Change this to your secret
```

Change to:
```javascript
const API_SECRET = 'your-actual-secret-here';
```

## Option 2: Set Secret in Cloudflare Worker

If you want the Worker to automatically inject the secret into requests:

### Step 1: Generate a Secret (same as above)

### Step 2: Set as Cloudflare Secret

```bash
cd stocktake-system/cloudflare-worker
npx wrangler secret put APPS_SCRIPT_SECRET
```

When prompted, paste your secret and press Enter.

### Step 3: Verify Secret is Set

```bash
npx wrangler secret list
```

You should see `APPS_SCRIPT_SECRET` in the list.

## How It Works

1. **Without Secret (Current)**: 
   - Apps Script checks if secret is "CHANGE_THIS_SECRET"
   - If yes, authentication is skipped
   - If no, it validates the secret

2. **With Secret Set**:
   - Worker adds `secret: "your-secret"` to every request
   - Apps Script validates the secret matches
   - If mismatch, returns `UNAUTHORIZED` error

## Testing

### Test Without Secret (Should Work)
```javascript
// In browser console or Postman
fetch('https://your-worker-url/apps-script/proxy', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'getProductDatabase'
    // No secret - should work if secret not set
  })
})
```

### Test With Secret (Required if set)
```javascript
fetch('https://your-worker-url/apps-script/proxy', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'getProductDatabase',
    secret: 'your-secret-here' // Required if secret is set
  })
})
```

## Security Best Practices

1. **Use Script Properties** instead of hardcoding
2. **Generate a long, random secret** (32+ characters)
3. **Don't commit secrets to Git** (they're already in .gitignore)
4. **Rotate secrets periodically** if compromised
5. **Use different secrets** for dev/prod if you have multiple deployments

## Troubleshooting

### "Unauthorized" Error
- Check that the secret in Apps Script matches the one in Worker
- Verify Script Properties is set correctly
- Check Worker logs: `npx wrangler tail`

### Secret Not Working
- Make sure you saved Script Properties (not just typed it)
- Redeploy Apps Script after changing Script Properties
- Clear browser cache if testing in browser

## Current Code Behavior

Looking at the code:
```javascript
const providedSecret = request.secret || request.apiSecret;
const expectedSecret = PropertiesService.getScriptProperties().getProperty('API_SECRET') || API_SECRET;
if (expectedSecret !== 'CHANGE_THIS_SECRET' && providedSecret !== expectedSecret) {
  return errorResponse('Unauthorized', 'doPost', requestId, 'UNAUTHORIZED');
}
```

This means:
- If `API_SECRET` constant is still `'CHANGE_THIS_SECRET'` AND no Script Property is set → **No auth required**
- If either is changed → **Auth required**

## Recommendation

**For now**: Leave it as-is (no secret) since it's working. 

**For production**: Set a secret via Script Properties for security.

