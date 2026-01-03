# Authentication Integration Plan: Stock App ↔ Stocktake System

**Status:** Planning  
**Last Updated:** 2025-01-27

## Current State

### Stock App (`/stock`)
- **Backend:** Google Apps Script
- **Password Storage:** Google Apps Script Properties (`password_username`)
- **Authentication:** Client → Apps Script → Script Properties
- **Users List:** Master Sheet "Users" sheet (Column A: Username)

### Stocktake System (`/stocktake-reconciliation`)
- **Backend:** Cloudflare Workers
- **Password Storage:** Cloudflare KV (`users` key)
- **Authentication:** Client → Cloudflare Worker → KV
- **Users List:** Cloudflare KV

## Problem

**Two separate authentication systems = two separate user databases**

Users must:
- Log in separately to each system
- Have different passwords (or remember to keep them in sync)
- Be managed separately

## Solution: Unified Authentication via Master Sheet

### Approach: Master Sheet as Single Source of Truth

**Store users and passwords in Master Sheet, both systems read from it.**

### Master Sheet Structure

**"Users" Sheet:**
| Column | Field | Type | Description |
|--------|-------|------|-------------|
| A | Username | string | Unique username |
| B | Password Hash | string | SHA-256 hash of password |
| C | Role | string | "admin" or "user" |

**Example:**
```
Username | Password Hash                                    | Role
---------|--------------------------------------------------|-------
admin    | 5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8 | admin
john     | 8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918 | user
sarah    | 8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918 | user
```

### Implementation Steps

#### Step 1: Update Master Sheet "Users" Sheet
1. Add Column B: "Password Hash"
2. Add Column C: "Role"
3. Populate with existing users (hash their passwords)

#### Step 2: Update Stock App (Google Apps Script)
**File:** `AppsScript.gs` (in Stock repo)

**Changes:**
- Remove password storage from Script Properties
- Read passwords from Master Sheet "Users" sheet (Column B)
- Hash input password (SHA-256) and compare with stored hash

**New Authentication Flow:**
```javascript
function authenticateUser(username, password) {
  const masterSheetId = 'YOUR_MASTER_SHEET_ID';
  const sheet = SpreadsheetApp.openById(masterSheetId).getSheetByName('Users');
  const data = sheet.getDataRange().getValues();
  
  // Skip header row
  for (let i = 1; i < data.length; i++) {
    const [storedUsername, storedHash, role] = data[i];
    if (storedUsername === username) {
      const inputHash = Utilities.computeDigest(
        Utilities.DigestAlgorithm.SHA_256,
        password,
        Utilities.Charset.UTF_8
      ).map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
      
      if (inputHash === storedHash) {
        return { authenticated: true, role: role || 'user' };
      }
    }
  }
  
  return { authenticated: false };
}
```

#### Step 3: Update Stocktake System (Cloudflare Worker)
**File:** `services/auth.js`

**Changes:**
- Remove KV storage for users
- Read users from Master Sheet "Users" sheet via Google Sheets API
- Cache users in memory (refresh every 5 minutes)

**New Authentication Flow:**
```javascript
static async getUsersFromMasterSheet(env) {
  const accessToken = await GoogleSheetsAPI.getAccessToken(env);
  const masterSheetId = env.MASTER_SHEET_ID;
  
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${masterSheetId}/values/'Users'!A:C`,
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );
  
  const data = await response.json();
  const rows = data.values || [];
  
  // Skip header row
  return rows.slice(1).map(row => ({
    username: row[0] || '',
    password: row[1] || '', // Already hashed
    role: row[2] || 'user'
  }));
}

static async login(username, password, env) {
  const users = await this.getUsersFromMasterSheet(env);
  const hashedPassword = await sha256(password); // Hash input
  
  const user = users.find(u => 
    u.username === username && u.password === hashedPassword
  );
  
  if (!user) return null;
  
  // Generate token...
  return { username, role: user.role, token };
}
```

#### Step 4: Add User Management Endpoints
**Stocktake System:**
- `POST /admin/users` - Add user (writes to Master Sheet)
- `PUT /admin/users/:username/password` - Update password (writes to Master Sheet)
- `DELETE /admin/users/:username` - Delete user (writes to Master Sheet)

**Stock App:**
- Add admin UI to manage users (optional, can use stocktake system's UI)

#### Step 5: Migration Script
**Create:** `migrate-users-to-master-sheet.js`

**Purpose:** Migrate existing users from:
- Cloudflare KV → Master Sheet
- Google Apps Script Properties → Master Sheet

## Benefits

1. ✅ **Single Source of Truth:** Master Sheet stores all users
2. ✅ **Unified Login:** Same username/password for both systems
3. ✅ **Centralized Management:** Manage users in one place (stocktake admin UI)
4. ✅ **Consistent Hashing:** Both systems use SHA-256
5. ✅ **Easy Sync:** No manual password syncing needed

## Security Considerations

1. **Password Hashing:** Both systems hash passwords the same way (SHA-256)
2. **Access Control:** Master Sheet must be shared with:
   - Service account (for stocktake system)
   - Apps Script (for Stock app)
3. **Read-Only for Service Account:** Service account only needs read access
4. **Write Access:** Only admin users can modify Master Sheet via stocktake system

## Implementation Priority

1. **Phase 1:** Update stocktake system to read from Master Sheet (non-breaking, can keep KV as fallback)
2. **Phase 2:** Update Stock app to read from Master Sheet
3. **Phase 3:** Remove KV/Properties storage
4. **Phase 4:** Add user management endpoints to write to Master Sheet

## Testing Checklist

- [ ] Stock app can authenticate using Master Sheet
- [ ] Stocktake system can authenticate using Master Sheet
- [ ] Same username/password works in both systems
- [ ] Password change in stocktake system updates Master Sheet
- [ ] New user added in stocktake system appears in Stock app
- [ ] User deletion works in both systems
- [ ] Caching works correctly (performance)

## Questions to Resolve

1. **Should we keep KV as a fallback?** (Yes, for migration period)
2. **How to handle password changes?** (Update Master Sheet, both systems read from it)
3. **What about existing users?** (Migration script)
4. **Performance:** Should we cache users? (Yes, 5-minute cache)

---

**Next Steps:**
1. Update stocktake system to read from Master Sheet (with KV fallback)
2. Test authentication
3. Update Stock app to read from Master Sheet
4. Test unified login
5. Add user management endpoints to write to Master Sheet


