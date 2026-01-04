# Integration Guide - Multi-Repo Management

## How to Work with Multiple Repos Without AI Confusion

### Understanding Context in Cursor

**Good News:** Cursor is smart about context! It only sees files you have open or explicitly reference. Here's how to keep things organized:

### Best Practices for Multi-Repo Work

#### 1. **Use Separate Cursor Windows/Workspaces**
- Open each repo in its own Cursor window
- Or use Cursor's workspace feature to switch between projects
- This keeps contexts completely separate

#### 2. **Create Integration Contracts**
- Define clear APIs/interfaces between systems
- Document what each system expects and provides
- Keep integration docs in BOTH repos (or a shared location)

#### 3. **Use Clear Naming Conventions**
- Prefix integration-related code with system names
- Example: `stocktake_api_client.js` vs `count_app_api_client.js`
- Use namespaces/modules to separate concerns

#### 4. **Document Dependencies**
- List external systems in README
- Document API versions and contracts
- Keep changelogs for integration changes

---

## Integration Interface Definition

### For This Stocktake System

**This system provides:**
- Google Sheets API (read/write to count sheets)
- Cloudflare Worker API endpoints
- Data formats (Excel, DAT, manual entry lists)

**This system expects:**
- Count data in Google Sheets (from barcode scanning app)
- HnL Excel exports (from HnL system)
- Barcode mapping sheet (maintained externally)

---

## Integration Contract Template

Use this template to define how your systems interact:

```markdown
# Integration Contract: [System A] ↔ [System B]

## Overview
Brief description of how the systems interact

## System A → System B

### Data Flow
- What data does A send to B?
- Format: JSON, CSV, Google Sheets, etc.
- Frequency: Real-time, batch, on-demand
- Authentication: API keys, OAuth, etc.

### API Endpoints / Interfaces
- Endpoint: `/api/counts`
- Method: POST
- Payload: { barcode, quantity, timestamp }
- Response: { success, countId }

### Error Handling
- What happens if B is unavailable?
- Retry logic?
- Fallback mechanisms?

## System B → System A

### Data Flow
- What data does B send to A?
- Format: ...
- Frequency: ...

### API Endpoints / Interfaces
- ...

## Shared Resources
- Google Sheets (which sheets, permissions)
- Cloudflare KV (which keys)
- Other shared storage

## Versioning
- Current API version: v1
- Breaking changes policy
- Deprecation timeline

## Testing
- How to test integration locally
- Mock data examples
- Integration test scenarios
```

---

## Working with AI in Multi-Repo Scenarios

### ✅ DO:
1. **Be explicit about which repo you're working in**
   - "In the stocktake repo, add..."
   - "Update the count-app integration..."

2. **Reference specific files when needed**
   - "In `INTEGRATION_GUIDE.md`, document..."
   - "The API contract is defined in..."

3. **Use clear context markers**
   - Start conversations with: "I'm working on the stocktake system integration with count-app"
   - Specify: "This is for repo A, not repo B"

4. **Create integration documentation**
   - Keep it in both repos
   - Or in a shared integration repo
   - Update when interfaces change

### ❌ DON'T:
1. Assume AI remembers which repo you're in
2. Mix contexts without clarifying
3. Make breaking changes without documenting
4. Use ambiguous names like "the API" (which API?)

---

## Practical Example: Stocktake + Count App Integration

### Scenario
You have:
- **Repo A:** Stocktake Reconciliation System (this repo)
- **Repo B:** Barcode Scanning Count App (another repo)

### Step 1: Define the Contract

Create `INTEGRATION_CONTRACT.md` in BOTH repos:

```markdown
# Stocktake ↔ Count App Integration

## Count App → Stocktake

### Data Format
Count app writes to Google Sheet with columns:
- Barcode (string)
- Product (string) 
- Quantity (number)
- Location (string)
- User (string)
- Timestamp (ISO 8601)
- Stock Level (string)
- $ Value (number)
- Synced (boolean)
- Status (string)
- Sync ID (string)

### Sheet Location
- Folder: `COUNT_SHEETS_FOLDER_ID` (from wrangler.toml)
- Sheet name: User-defined, selected in stocktake UI

### Authentication
- Service account with read access to folder
- No direct API calls needed (uses Google Sheets)

## Stocktake → Count App

### Notifications (Future)
- Webhook when stocktake starts: `POST /webhooks/stocktake-started`
- Webhook when stocktake finishes: `POST /webhooks/stocktake-finished`
- Payload: `{ stocktakeId, name, spreadsheetId }`

## Shared Resources
- Google Sheets: Count sheets folder
- Google Sheets: Barcode mapping sheet
```

### Step 2: Document in Each Repo

**In Stocktake Repo:**
- Add to README: "Integrates with Count App via Google Sheets"
- Link to integration contract
- Document which sheets/folders are used

**In Count App Repo:**
- Add to README: "Writes to Google Sheets for Stocktake system"
- Link to integration contract
- Document the exact format expected

### Step 3: Version Control

When making changes:
1. Update integration contract FIRST
2. Update both repos' documentation
3. Test integration
4. Deploy both systems together

---

## AI Context Management Tips

### When Working on Integration:

**Start your conversation with:**
```
I'm working on integrating the stocktake system (this repo) 
with the count-app (another repo). The integration uses 
Google Sheets as the interface. I need to update the 
stocktake system to handle a new field from count-app.
```

**When switching contexts:**
```
Now I'm switching to work on the count-app repo. 
I need to add a new field that the stocktake system expects.
```

**When referencing the other system:**
```
According to the integration contract in INTEGRATION_GUIDE.md,
the count-app writes data in this format: [describe format]
```

### Use File References:
- "See `INTEGRATION_CONTRACT.md` for the API format"
- "The count-app expects this in `services/google-sheets.js`"
- "Update the contract in both repos"

---

## Recommended File Structure

### In Each Repo:

```
repo-root/
├── README.md (mentions integration)
├── INTEGRATION_GUIDE.md (this file, or link to shared location)
├── INTEGRATION_CONTRACT.md (defines the interface)
├── docs/
│   ├── integration/
│   │   ├── api-reference.md
│   │   ├── data-formats.md
│   │   └── testing.md
└── [your code]
```

### Or Use a Shared Integration Repo:

```
integration-repo/
├── README.md
├── contracts/
│   ├── stocktake-countapp.md
│   └── stocktake-hnl.md
├── examples/
│   ├── sample-data.json
│   └── test-scenarios.md
└── changelog.md
```

---

## Quick Reference: Context Commands

When talking to AI about integrations:

✅ **Good:**
- "In the stocktake system, update the Google Sheets reader to handle the new 'location' field from count-app"
- "According to INTEGRATION_CONTRACT.md, count-app writes data in this format..."
- "I'm now switching to count-app repo to add the location field"

❌ **Avoid:**
- "Update the API" (which API? which repo?)
- "Fix the integration" (what's broken? which system?)
- "Add the new field" (to which system? what field?)

---

## Integration Checklist

When adding/modifying integrations:

- [ ] Document the integration contract
- [ ] Update README in both repos
- [ ] Add integration tests
- [ ] [ ] Document error handling
- [ ] Add versioning/backwards compatibility
- [ ] Test with sample data
- [ ] Update both repos' documentation
- [ ] Add to changelog if breaking change

---

## Need Help?

If AI gets confused:
1. **Clarify which repo:** "I'm in the stocktake repo now"
2. **Reference the contract:** "See INTEGRATION_CONTRACT.md line 45"
3. **Be specific:** "Update the `getCountData` function in `services/google-sheets.js`"
4. **Close unrelated files:** Only have relevant files open

Remember: AI only sees what you show it. Keep contexts clean and explicit!



