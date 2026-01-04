# Master Sheet Explanation

## What is the Master Sheet?

The **Master Sheet** is used by your **Stock app** (barcode scanning tool), NOT by the stocktake reconciliation system.

### Master Sheet Contains:

1. **Product Database** sheet
   - Barcode | Product | Current Stock | Value
   - Used by Stock app to look up products when scanning

2. **Users** sheet
   - Username
   - Used by Stock app for authentication

3. **Locations** sheet
   - Location name
   - Used by Stock app to select where items are being counted

### Who Uses It?

- ✅ **Stock App** (your barcode scanner) - Reads from Master Sheet
- ❌ **Stocktake System** - Does NOT use Master Sheet

---

## Do You Already Have One?

**If your Stock app is working, you already have a Master Sheet!**

The Stock app's Apps Script reads from it (see `AppsScript.gs` line 6: `MASTER_SHEET_ID`).

---

## What the Stocktake System Actually Needs

The stocktake system needs a **different sheet** called **"Barcode Mapping"**:

### Barcode Mapping Sheet (for Stocktake System)
- **Purpose:** Maps barcodes to product descriptions
- **Format:**
  - Column A: Barcode
  - Column B: Product (description)
- **Used by:** Stocktake system to match count data to HnL theoretical stock

**This is separate from the Master Sheet!**

---

## Do You Need to Create Master Sheet?

### If Stock App is Already Working:
- ✅ **You already have a Master Sheet** - No need to create it!
- ✅ Just verify it has the 3 sheets (Product Database, Users, Locations)
- ✅ Skip Step 2 in the setup guide

### If Stock App is NOT Working:
- ⚠️ You need to create Master Sheet for Stock app to work
- ⚠️ Follow Step 2 in the setup guide

---

## Summary

| Sheet | Used By | Purpose | Need to Create? |
|-------|---------|---------|-----------------|
| **Master Sheet** | Stock App | Product database, users, locations | Only if Stock app not working |
| **Barcode Mapping** | Stocktake System | Map barcodes to products | ✅ YES - for stocktake system |

---

## What You Should Do

1. **Check if Stock app works:**
   - Can you scan barcodes?
   - Does it show product names?
   - If YES → You have Master Sheet ✅

2. **For Stocktake System:**
   - Skip Master Sheet setup (Step 2)
   - Go straight to **Barcode Mapping Sheet** (Step 3)
   - This is what stocktake system needs

---

## Quick Answer

**Master Sheet = For Stock App (you probably already have it)**  
**Barcode Mapping Sheet = For Stocktake System (you need to create this)**

The stocktake system does NOT automatically create the Master Sheet because it's not for the stocktake system - it's for the Stock app!



