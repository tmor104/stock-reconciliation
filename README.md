# Stock Reconciliation System

[![Security: Hardened](https://img.shields.io/badge/Security-Hardened-green.svg)](./SECURITY.md)
[![Deployment: Ready](https://img.shields.io/badge/Deployment-Ready-blue.svg)](./DEPLOYMENT_GUIDE.md)
[![Cost: Free](https://img.shields.io/badge/Cost-$0/month-brightgreen.svg)](#)

A comprehensive, secure web application for reconciling theoretical stock from HnL against physical stocktake counts.

## 🚀 Quick Start

1. **Deploy in 3 steps**:
   ```bash
   # 1. Set up Google Cloud (see DEPLOYMENT_GUIDE.md)
   # 2. Deploy Cloudflare Worker
   cd stocktake-system/cloudflare-worker
   wrangler deploy

   # 3. Update configuration and push to GitHub Pages
   git push origin main
   ```

2. **Full deployment guide**: See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

## ✨ Features

- ✅ **Parse HnL Excel exports** - Handles complex merged cells and categories
- ✅ **Real-time variance calculations** - Quantity and dollar variance with percentages
- ✅ **Barcode scanning integration** - Automatic summation of multiple scans
- ✅ **Manual count adjustments** - With full audit trail
- ✅ **Advanced filtering & sorting** - By category, variance, product name
- ✅ **Export capabilities** - Excel reports, HnL .dat files, manual entry lists
- ✅ **Multi-user support** - Admin and user roles with authentication
- ✅ **Production-ready security** - PBKDF2 hashing, CORS restrictions, rate limiting
- ✅ **Completely free** - Uses free tiers of Cloudflare, Google Cloud, GitHub

## 🔒 Security Features (v2.0)

All security issues have been addressed:

- ✅ **PBKDF2 password hashing** with 100,000 iterations
- ✅ **CORS restrictions** - No longer accepts requests from any origin
- ✅ **Rate limiting** - Prevents brute-force attacks (5 login attempts/minute)
- ✅ **XSS prevention** - All user input sanitized
- ✅ **Input validation** - File types, sizes, and all user inputs
- ✅ **No inline handlers** - CSP-compatible code
- ✅ **Professional UI** - Toast notifications instead of alerts

**Full security documentation**: [SECURITY.md](./SECURITY.md)

## 📋 What's New in v2.0

- 🔒 **23 security and code quality issues fixed**
- 🎨 **Complete UI overhaul** with toast notifications
- 📝 **Comprehensive documentation** for deployment
- 🛠️ **Configuration templates** to prevent secret leaks
- ⚡ **Rate limiting** to prevent abuse
- 🔐 **Improved password security** with PBKDF2

**Full changelog**: [CHANGES.md](./CHANGES.md)

## 📚 Documentation

- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** - Step-by-step deployment instructions
- **[SECURITY.md](./SECURITY.md)** - Security features and best practices
- **[CHANGES.md](./CHANGES.md)** - Complete changelog of improvements
- **[stocktake-system/README.md](./stocktake-system/README.md)** - Original project documentation
- **[stocktake-system/PROJECT_SUMMARY.md](./stocktake-system/PROJECT_SUMMARY.md)** - Technical architecture details

## 🏗️ Architecture

```
┌──────────────────┐
│  GitHub Pages    │  Static frontend (HTML/CSS/JS)
│  (Frontend)      │  - User interface
│                  │  - Client-side validation
└────────┬─────────┘  - Toast notifications
         │
         ↓ HTTPS + CORS
┌──────────────────┐
│ Cloudflare       │  Serverless API
│   Workers        │  - Parse HnL Excel files
│   (Backend)      │  - Calculate variance
│                  │  - Rate limiting
└────────┬─────────┘  - Authentication
         │
         ↓ Service Account
┌──────────────────┐
│ Google Sheets    │  Data storage
│   + KV Store     │  - Theoretical stock
│                  │  - Count data
└──────────────────┘  - Audit trail
```

## 🎯 Use Cases

### Admin Workflow
1. **Start Stocktake** - Upload HnL Excel export, select count sheet
2. **Monitor Progress** - Real-time variance report with filtering
3. **Manual Adjustments** - Edit counts with audit trail
4. **Finish Stocktake** - Generate .dat file for HnL import

### User Workflow
- View variance reports
- Make manual count adjustments
- Export reports to Excel

## 💰 Cost

**$0/month** using free tiers:
- Cloudflare Workers: 100,000 requests/day
- Cloudflare KV: 100,000 reads/day
- Google Cloud: Sheets API within free limits
- GitHub Pages: Unlimited static hosting

## 🛠️ Technology Stack

- **Frontend**: Pure HTML/CSS/JavaScript (no frameworks)
- **Backend**: Cloudflare Workers (serverless)
- **Database**: Cloudflare KV + Google Sheets
- **Hosting**: GitHub Pages (frontend), Cloudflare (backend)

## 📦 Project Structure

```
stock-reconciliation/
├── index.html                    # GitHub Pages entry point
├── DEPLOYMENT_GUIDE.md           # Deployment instructions
├── SECURITY.md                   # Security documentation
├── CHANGES.md                    # Changelog
├── .gitignore                    # Git ignore rules
└── stocktake-system/
    ├── frontend/                 # Static web application
    │   ├── index.html           # Main UI
    │   ├── styles.css           # Styling with toast support
    │   ├── app.js               # Frontend logic (secure)
    │   └── config.js.template   # Configuration template
    ├── cloudflare-worker/        # Serverless backend
    │   ├── index.js             # Main router with security
    │   ├── wrangler.toml.template  # Config template
    │   ├── parsers/             # HnL Excel parser
    │   ├── services/            # Business logic
    │   └── utils/               # Response helpers
    ├── docs/                     # Additional documentation
    └── DEMO.html                # Demo data visualization
```

## 🚦 Getting Started

### Prerequisites

- GitHub account
- Cloudflare account (free)
- Google Cloud account (free)
- Node.js and npm installed
- Your HnL stocktake export file

### Quick Setup

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd stock-reconciliation
   ```

2. **Follow the deployment guide**
   - See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for complete instructions
   - Estimated setup time: 30-60 minutes

3. **Configure your system**
   - Update `stocktake-system/cloudflare-worker/wrangler.toml`
   - Update `stocktake-system/frontend/app.js`
   - Set secrets via `wrangler secret put`

4. **Deploy**
   ```bash
   # Deploy worker
   cd stocktake-system/cloudflare-worker
   wrangler deploy

   # Push to GitHub Pages
   git push origin main
   ```

## 🔍 Testing

After deployment, verify:

- ✅ Login works with admin credentials
- ✅ CORS only allows your GitHub Pages domain
- ✅ Rate limiting triggers after 5 failed logins
- ✅ File uploads validate type and size
- ✅ Toast notifications appear correctly
- ✅ Variance calculations are accurate
- ✅ Export functions generate correct files

## 🐛 Troubleshooting

### Common Issues

**"Unauthorized" errors**
- Check service account has access to Google Sheets
- Verify `GOOGLE_SERVICE_ACCOUNT_KEY` secret is set
- Check sheet IDs in `wrangler.toml`

**CORS errors**
- Add your GitHub Pages URL to `ALLOWED_ORIGINS` in `wrangler.toml`
- Redeploy the worker

**Rate limit issues**
- Adjust `RATE_LIMITS` in `cloudflare-worker/index.js`
- Redeploy the worker

**More help**: See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md#troubleshooting)

## 📊 Monitoring

```bash
# View real-time worker logs
cd stocktake-system/cloudflare-worker
wrangler tail

# Check for errors
wrangler tail --format=pretty | grep ERROR
```

## 🤝 Contributing

This is a production system with security hardening. When contributing:

1. Never commit secrets or credentials
2. Follow existing code patterns
3. Maintain security standards
4. Update documentation
5. Test thoroughly before pushing

## 📄 License

MIT License - See LICENSE file for details

## 🙏 Acknowledgments

Built using:
- [Cloudflare Workers](https://workers.cloudflare.com/)
- [Google Sheets API](https://developers.google.com/sheets/api)
- [GitHub Pages](https://pages.github.com/)

Security best practices from:
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Cloudflare Security](https://developers.cloudflare.com/workers/platform/security/)
- [MDN Web Security](https://developer.mozilla.org/en-US/docs/Web/Security)

## 📞 Support

- **Deployment issues**: Check [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
- **Security questions**: Read [SECURITY.md](./SECURITY.md)
- **Technical details**: See [stocktake-system/PROJECT_SUMMARY.md](./stocktake-system/PROJECT_SUMMARY.md)

## 🎉 Ready to Deploy?

Follow the [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) to get your stock reconciliation system live in under an hour!

---

**Version**: 2.0 (Security Hardened)
**Status**: Production Ready ✅
**Last Updated**: 2025-12-26