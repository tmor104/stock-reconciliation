# Switch to OAuth 2.0 User Authentication

## The Problem
Service accounts **cannot own files** - they have no storage quota. This is a Google limitation, not a bug.

## The Solution: OAuth 2.0 User Authentication

Instead of using a service account, we'll use OAuth 2.0 to authenticate as **your Google account**. Files will be created in your Drive using your storage quota.

## Implementation Plan

### Step 1: Set Up OAuth 2.0 Credentials
1. Go to: https://console.cloud.google.com/apis/credentials
2. Click "Create Credentials" → "OAuth client ID"
3. Application type: "Web application"
4. Authorized redirect URIs: Add your app URL
5. Download the credentials JSON

### Step 2: Update Frontend
- Add Google Sign-In button
- User logs in with their Google account
- Get OAuth access token
- Send token to backend

### Step 3: Update Backend
- Accept OAuth tokens instead of service account
- Use user's token to create files
- Files created in user's Drive (their storage quota)

## Alternative: Quick Workaround

If you want to keep using service account, you could:
1. Manually create spreadsheets in your Drive
2. Share them with service account
3. Service account can read/write but not create

But this defeats the purpose of automation.

## Recommendation

**Switch to OAuth 2.0** - it's the proper solution for personal Google accounts without Workspace.

