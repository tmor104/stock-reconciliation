# Stock Wizard - Reconciliation System v2.0

A modern, offline-first stock reconciliation system built with React, TypeScript, Tailwind CSS, and Supabase. Designed for bar and restaurant inventory management with barcode scanning, variance analysis, and comprehensive reporting.

## 🎯 Overview

Stock Wizard helps businesses conduct physical stock counts, reconcile inventory against theoretical stock levels, and generate detailed variance reports. The system supports:

- **7-Stage Workflow**: Guided process from initial counts to final reconciliation
- **Barcode Scanning**: Fast product entry with barcode support
- **Offline-First**: Works seamlessly without internet connection
- **Multi-Location**: Track inventory across different physical locations
- **Templates & Batches**: Predefined product lists and recipe calculations
- **Variance Analysis**: Automatic calculation of quantity and dollar variances
- **Excel Integration**: Import theoretical stock and export reports

## 🏗️ Architecture

### Frontend
- **React 18** - Modern UI library
- **TypeScript** - Type-safe code
- **Vite** - Lightning-fast build tool
- **Tailwind CSS** - Utility-first styling
- **Zustand** - Lightweight state management
- **React Router** - Client-side routing

### Backend
- **Supabase** - Backend-as-a-Service
  - PostgreSQL database with RLS
  - Real-time subscriptions
  - Authentication & authorization
  - File storage (replacing Google Drive)
  - Offline-first capabilities

### Legacy Components (Being Deprecated)
- Cloudflare Workers (to be replaced with Supabase Edge Functions)
- Google Sheets integration (migrated to Supabase PostgreSQL)
- Google Apps Script (no longer needed)

## 📁 Project Structure

```
stock-reconciliation/
├── src/
│   ├── components/          # Shared UI components
│   │   ├── ui/             # Base components (Button, Input, Card, Modal)
│   │   └── layout/         # Layout components (Header, Sidebar, Layout)
│   │
│   ├── features/           # Feature-based modules
│   │   ├── auth/          # Authentication
│   │   ├── dashboard/     # Dashboard & stocktake selection
│   │   ├── counting/      # Barcode scanning & counting
│   │   ├── variance/      # Variance analysis & reporting
│   │   ├── templates/     # Product templates
│   │   ├── batches/       # Recipe management
│   │   ├── kegs/          # Keg counting
│   │   └── admin/         # User & system administration
│   │
│   ├── stores/            # Zustand state management
│   │   ├── authStore.ts
│   │   ├── appStore.ts
│   │   ├── stocktakeStore.ts
│   │   └── scanStore.ts
│   │
│   ├── lib/              # Core utilities
│   │   ├── supabase.ts   # Supabase client configuration
│   │   └── types.ts      # TypeScript type definitions
│   │
│   ├── utils/            # Helper functions
│   │   ├── cn.ts         # Class name utilities
│   │   ├── excel.ts      # Excel import/export
│   │   └── calculations.ts
│   │
│   ├── App.tsx           # Root component with routing
│   ├── main.tsx          # Application entry point
│   └── index.css         # Global styles & Tailwind imports
│
├── public/               # Static assets
├── supabase-schema.sql   # Database schema & migrations
├── .env.example          # Environment variables template
└── package.json          # Dependencies & scripts
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Supabase account ([sign up free](https://supabase.com))

### 1. Clone & Install

```bash
git clone https://github.com/tmor104/stock-reconciliation.git
cd stock-reconciliation
npm install
```

### 2. Setup Supabase

1. Create a new Supabase project at [https://app.supabase.com](https://app.supabase.com)

2. Run the database schema:
   - Open your Supabase project
   - Go to SQL Editor
   - Copy and run the contents of `supabase-schema.sql`

3. Get your Supabase credentials:
   - Go to Project Settings → API
   - Copy the Project URL and anon/public key

4. Create `.env` file:

```bash
cp .env.example .env
```

Edit `.env` and add your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Create Admin User

In Supabase Dashboard:
1. Go to Authentication → Users
2. Create a new user (email + password)
3. Go to SQL Editor and run:

```sql
-- Replace 'USER_ID' with the actual user ID from auth.users
INSERT INTO profiles (id, username, role)
VALUES ('USER_ID', 'admin', 'admin');
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and login with your admin credentials.

### 5. Build for Production

```bash
npm run build
npm run preview  # Test production build locally
```

## 🔐 Authentication

The system uses Supabase Auth with email/password authentication. Row Level Security (RLS) policies ensure users can only access their own data, with additional permissions for admin users.

### User Roles
- **Admin**: Full access to all features, user management, and system settings
- **User**: Can create stocktakes, count items, and view variance reports

## 📊 Database Schema

The Supabase PostgreSQL database includes the following main tables:

- **profiles** - User profiles and roles
- **products** - Product database with barcodes and pricing
- **locations** - Physical location definitions
- **stocktakes** - Stocktake sessions (7-stage workflow)
- **scans** - Barcode scan entries
- **manual_entries** - Manual product entries
- **kegs** - Keg-specific counting
- **templates** - Product list templates
- **recipes** - Batch recipes with ingredients
- **batches** - Batch counting records
- **variance_data** - Calculated variance reports
- **theoretical_stock** - Uploaded theoretical stock data

See `supabase-schema.sql` for complete schema with RLS policies and triggers.

## 🎨 Features

### Dashboard
- View and select stocktakes
- Create new stocktakes
- Quick navigation to counting screens

### Counting Interface (In Development)
- Barcode scanning
- Manual product entry
- Location-based counting
- Keg counting mode
- Real-time item list with edit/delete

### Variance Analysis (In Development)
- Upload theoretical stock from Excel
- Automatic variance calculation
- Filter by stock group
- Export variance reports
- Dollar and quantity variance tracking

### Templates (In Development)
- Create location-specific product lists
- Set par levels
- Load templates into stocktakes
- Draft and live template status

### Batch Recipes (In Development)
- Define cocktail/food recipes
- Calculate ingredient usage
- Batch counting workflow
- Support for filler items

### Admin Panel (In Development)
- User management (add/remove users)
- Stocktake stage control
- System settings
- Activity monitoring

## 🔧 Development

### Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

### Tech Stack Details

- **React 18.2** - Component library
- **TypeScript 5.3** - Static typing
- **Vite 5.0** - Build tool
- **Tailwind CSS 3.4** - Styling
- **Zustand 4.5** - State management
- **React Router 6.21** - Routing
- **Supabase JS 2.39** - Backend client
- **XLSX 0.18** - Excel operations
- **date-fns 3.2** - Date utilities

### Code Style

- **ESLint** configured for React + TypeScript
- **Tailwind** for all styling (no CSS modules)
- **Feature-based** folder structure
- **Zustand** for global state, local state for UI

## 🚧 Migration Status

This is version 2.0 - a complete React rewrite with Supabase backend.

### ✅ Completed
- [x] Project setup (Vite + React + TypeScript)
- [x] Tailwind CSS configuration
- [x] Supabase integration
- [x] Authentication system
- [x] Core layout & navigation
- [x] State management (Zustand stores)
- [x] Database schema design

### 🔨 In Progress
- [ ] Barcode scanning interface
- [ ] Product database management
- [ ] Location management
- [ ] Variance calculation engine
- [ ] Template system
- [ ] Batch/recipe system
- [ ] Excel import/export
- [ ] Admin panel
- [ ] Offline-first capabilities

### 📝 To Do
- [ ] Complete all 7-stage workflow
- [ ] Real-time sync with Supabase
- [ ] PWA configuration
- [ ] Mobile-responsive optimizations
- [ ] Testing suite
- [ ] Deployment pipeline

## 📱 Offline Support

The application is designed to work offline using:
- Supabase local storage
- Service Workers (PWA)
- Optimistic UI updates
- Background sync when online

## 🤝 Contributing

This is a private project for bar/restaurant inventory management. If you have access and want to contribute:

1. Create a feature branch from `main`
2. Make your changes
3. Submit a pull request

## 📄 License

Proprietary - All Rights Reserved

## 🆘 Support

For issues or questions, please create an issue in the GitHub repository.

## 🎯 Roadmap

### Phase 1: Core Functionality (Current)
- Complete counting interface
- Variance calculation
- Basic reporting

### Phase 2: Advanced Features
- Template system
- Batch recipes
- Advanced filtering

### Phase 3: Polish & Optimization
- Offline optimization
- Performance tuning
- Mobile UX improvements

### Phase 4: Production Ready
- Full test coverage
- Documentation
- Deployment automation

---

**Version**: 2.0.0
**Last Updated**: January 2026
**Tech Stack**: React + TypeScript + Supabase + Tailwind CSS
