# Integration Contract Template

**Copy this file and customize it for each integration.**

---

# Integration Contract: [System A Name] ↔ [System B Name]

**Version:** 1.0  
**Last Updated:** [Date]  
**Maintained By:** [Your Name/Team]

## Overview

[Brief description of how these two systems interact]

**System A:** [Name and purpose]  
**System B:** [Name and purpose]

---

## System A → System B

### Purpose
[What does A need from B?]

### Data Flow
- **Format:** [JSON, CSV, Google Sheets, REST API, etc.]
- **Frequency:** [Real-time, batch daily, on-demand, etc.]
- **Direction:** [Push from A, Pull by B, or both]

### Interface Details

#### Option 1: API Endpoint
```
Endpoint: [URL]
Method: [GET/POST/PUT/DELETE]
Authentication: [API key, OAuth, etc.]
Headers: [Required headers]
```

**Request Format:**
```json
{
  "field1": "example",
  "field2": 123
}
```

**Response Format:**
```json
{
  "status": "success",
  "data": {}
}
```

#### Option 2: Shared Storage (Google Sheets, Database, etc.)
- **Location:** [Sheet ID, table name, etc.]
- **Format:** [Column structure]
- **Permissions:** [Read/write access]
- **Update Frequency:** [How often data changes]

### Error Handling
- **What happens if B is unavailable?** [Retry, queue, fail gracefully]
- **Retry Logic:** [Number of retries, backoff strategy]
- **Fallback:** [Alternative data source or behavior]

### Example
```javascript
// Example code showing how A calls B
const response = await fetch('https://system-b.com/api/data', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({ ... })
});
```

---

## System B → System A

### Purpose
[What does B need from A?]

### Data Flow
- **Format:** [JSON, CSV, Google Sheets, REST API, etc.]
- **Frequency:** [Real-time, batch daily, on-demand, etc.]
- **Direction:** [Push from B, Pull by A, or both]

### Interface Details

[Same structure as above]

---

## Shared Resources

### Google Sheets
- **Sheet Name/ID:** [ID or name]
- **Purpose:** [What it's used for]
- **Permissions:** [Who can read/write]
- **Schema:** [Column structure]

### Databases
- **Database:** [Name]
- **Tables:** [List tables]
- **Purpose:** [What data is stored]

### Other Resources
- **Cloudflare KV:** [Which keys]
- **S3 Buckets:** [Which buckets]
- **Other:** [List any other shared resources]

---

## Data Formats

### Common Data Structures

#### Example: Count Data
```typescript
interface CountData {
  barcode: string;
  product: string;
  quantity: number;
  location: string;
  user: string;
  timestamp: string; // ISO 8601
  stockLevel: string;
  value: number;
  synced: boolean;
  status: string;
  syncId: string;
}
```

#### Example: Stocktake Data
```typescript
interface StocktakeData {
  id: string;
  name: string;
  status: 'active' | 'completed';
  createdAt: string;
  items: StocktakeItem[];
}
```

---

## Authentication & Security

### System A → System B
- **Method:** [API key, OAuth, service account, etc.]
- **Credentials Location:** [Where stored]
- **Rotation Policy:** [How often rotated]

### System B → System A
- **Method:** [API key, OAuth, service account, etc.]
- **Credentials Location:** [Where stored]
- **Rotation Policy:** [How often rotated]

### Shared Credentials
- **Service Account:** [Email/ID]
- **API Keys:** [Where stored, who has access]

---

## Versioning & Compatibility

### Current Version
- **API Version:** v1
- **Data Format Version:** v1.2
- **Last Breaking Change:** [Date]

### Breaking Changes Policy
- **Notice Period:** [How much advance notice]
- **Deprecation Timeline:** [How long old versions supported]
- **Migration Guide:** [Link to migration docs]

### Backwards Compatibility
- **Supported Versions:** [List versions]
- **Compatibility Matrix:** [Which versions work together]

---

## Testing

### Local Testing
```bash
# How to test integration locally
# Example commands or setup steps
```

### Mock Data
```json
{
  "example": "data"
}
```

### Test Scenarios
1. **Happy Path:** [Normal operation]
2. **Error Cases:** [What happens on errors]
3. **Edge Cases:** [Boundary conditions]

---

## Monitoring & Logging

### What to Monitor
- [ ] API response times
- [ ] Error rates
- [ ] Data sync status
- [ ] [Other metrics]

### Logging
- **Where:** [Log location/service]
- **What:** [What events are logged]
- **Retention:** [How long logs kept]

### Alerts
- **When:** [What triggers alerts]
- **Who:** [Who gets notified]
- **How:** [Email, Slack, etc.]

---

## Deployment

### Deployment Order
1. [ ] Deploy System A changes
2. [ ] Deploy System B changes
3. [ ] Verify integration works
4. [ ] Monitor for issues

### Rollback Plan
- **If System A breaks:** [Steps]
- **If System B breaks:** [Steps]
- **If integration breaks:** [Steps]

---

## Change Log

| Date | Version | Change | Breaking? |
|------|---------|--------|-----------|
| 2025-01-01 | 1.0 | Initial contract | - |
| | | | |

---

## Contacts

**System A Owner:** [Name/Email]  
**System B Owner:** [Name/Email]  
**Integration Maintainer:** [Name/Email]

---

## Notes

[Any additional notes, gotchas, or important information]

