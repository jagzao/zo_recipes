# KitchenEye 🍳

**Smart Kitchen Monitoring System** - Monitor gas levels and fridge inventory with AI-powered recipe suggestions.

## Overview

KitchenEye is a multi-tenant SaaS platform that uses computer vision to:
- 📊 Monitor gas levels with visual indicators
- 🥕 Track fridge inventory automatically
- 📖 Suggest recipes based on available ingredients
- 🔔 Send alerts for low stock or critical levels
- 📱 Provide a Progressive Web App (PWA) for easy access

Built on **Cloudflare's free tier** (Workers, Pages, D1, KV, R2) for **zero-cost operation**.

## Architecture

```
┌─────────────────┐
│   Edge Devices  │  (Python + OpenCV + ONNX)
│  - Gas Camera   │
│  - Fridge Cam   │
└────────┬────────┘
         │ HTTP POST (results only)
         ▼
┌─────────────────────────────────────────┐
│        Cloudflare Workers (API)         │
│  - Multi-tenant isolation               │
│  - Authentication & RBAC                │
│  - Ingestion & rule engine              │
│  - Recipe matching                      │
└────────┬──────────────┬─────────────────┘
         │              │
    ┌────▼────┐    ┌────▼────┐
    │   D1    │    │   KV    │
    │(SQLite) │    │(Config) │
    └─────────┘    └─────────┘
                        │
                   ┌────▼────┐
                   │   R2    │
                   │(Images) │
                   └─────────┘
         │
    ┌────▼─────────┐
    │ Cloudflare   │
    │   Pages      │  (PWA Frontend)
    │   (PWA)      │
    └──────────────┘
```

## Features

### ✅ MVP (Implemented)

- **Multi-tenant SaaS**
  - Account and tenant management
  - Role-based access control (Owner, Admin, Ops, Viewer)
  - Usage metering and free tier limits
  - Team member invitations and management
  - Rate limiting at 3 levels (IP, tenant, camera)

- **Gas Monitoring**
  - Visual calibration with physical marker
  - Daily capture at 05:00 (configurable timezone)
  - Red/Yellow/Green status indicators
  - Automatic alerts for low levels

- **Fridge Inventory**
  - Object detection for common food items
  - Capture every 4 hours (configurable)
  - Smoothing with consecutive detection
  - Critical item tracking
  - Manual inventory management UI

- **Smart Recipe Matching**
  - Score recipes based on available ingredients
  - Personal profiles with allergies and preferences
  - Intent-based filtering (fresh, quick, protein, kids, etc.)
  - Substitute suggestions

- **Progressive Web App**
  - Installable on mobile devices
  - Offline support with service worker
  - Beautiful recipe cards with photos
  - Real-time alerts and status
  - Dark mode with system preference detection
  - 9 management pages (home, recipes, status, alerts, settings, cameras, profiles, inventory, reports)

- **Notifications**
  - Web push subscription support
  - Customizable notification preferences
  - Alert type filtering
  - Email and push toggle per user

- **Reports & Analytics**
  - CSV and JSON export formats
  - 4 report types (missing items, consumption, gas history, alerts summary)
  - Configurable date ranges
  - Download from PWA

- **Edge CV Application**
  - Python-based computer vision
  - Runs on Raspberry Pi or similar devices
  - Local processing with cloud sync
  - Automatic retry and health checks

- **Security & Validation**
  - Payload signing with HMAC-SHA256
  - Input sanitization (XSS prevention)
  - Schema validation
  - Audit logging for all sensitive actions

- **Performance Optimizations** ⭐NEW
  - Nanostores for lightweight state management (1KB)
  - Web Vitals monitoring (LCP, FID, CLS, FCP, TTFB)
  - Lazy image loading with Intersection Observer
  - Advanced Service Worker with 3 caching strategies
  - Native CSS animations + View Transitions API
  - Vite bundling with code splitting and tree shaking
  - **Result: ~35% smaller bundle, ~50% faster load times**

## Getting Started

### Prerequisites

- **Backend**: Cloudflare account (free tier)
- **Edge CV**: Python 3.11+, OpenCV, camera (USB or built-in)
- **Frontend**: Modern browser with PWA support

### 1. Setup Cloudflare Backend

```bash
# Install dependencies
npm install

# Create D1 database
npm run db:create

# Apply migrations
npm run db:migrate

# Deploy Workers
npm run deploy
```

Configure your `wrangler.toml` with the database ID and KV namespace ID from the Cloudflare dashboard.

### 2. Setup Edge CV

```bash
cd edge-cv

# Install Python dependencies
pip install -r requirements.txt

# Copy and configure environment
cp .env.example .env
# Edit .env with your camera ID and API URL

# Run the application
python main.py

# Or use Docker
docker-compose up -d
```

### 3. Deploy PWA Frontend

```bash
# Build frontend
cd frontend
npm run build

# Deploy to Cloudflare Pages
wrangler pages deploy ./public
```

## Project Structure

```
zo_recipes/
├── frontend/              # PWA Frontend
│   └── public/
│       ├── index.html
│       ├── app.js
│       ├── pages.js       # Management page renderers
│       ├── actions.js     # Form handlers & modals
│       ├── styles.css
│       ├── dark-mode.js   # Theme toggle logic
│       ├── manifest.json
│       └── sw.js
├── workers/               # Cloudflare Workers (API)
│   ├── api/
│   │   ├── index.ts       # Main worker entry
│   │   ├── cron.ts        # Scheduled jobs
│   │   ├── middleware/
│   │   │   ├── auth.ts    # Authentication & RBAC
│   │   │   └── ratelimit.ts  # Rate limiting
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── cameras.ts
│   │   │   ├── profiles.ts
│   │   │   ├── inventory.ts
│   │   │   ├── reports.ts
│   │   │   ├── tenants.ts
│   │   │   ├── notifications.ts
│   │   │   ├── ingest.ts
│   │   │   ├── recipes.ts
│   │   │   └── status.ts
│   │   └── __tests__/
│   │       └── api.test.ts  # Test suite
│   └── utils/
│       ├── jwt.ts
│       ├── db.ts
│       ├── response.ts
│       └── validation.ts  # Security & validation
├── edge-cv/               # Edge Computer Vision
│   ├── main.py            # Entry point
│   ├── camera.py          # Camera interface
│   ├── detectors/         # Detection algorithms
│   │   ├── gas.py
│   │   └── fridge.py
│   ├── api_client.py      # API communication
│   └── Dockerfile
├── shared/                # Shared TypeScript types
│   └── types.ts
├── migrations/            # D1 database migrations
│   ├── 0001_initial_schema.sql
│   └── 0002_notifications.sql
├── vitest.config.ts       # Test configuration
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Login
- `POST /api/auth/switch-tenant` - Switch tenant

### Ingestion (from Edge)
- `POST /api/ingest/result` - Send CV results
- `POST /api/ingest/health` - Health check

### Status
- `GET /api/status/gas` - Get gas levels
- `GET /api/status/inventory` - Get inventory
- `GET /api/status/cameras` - Get camera status

### Recipes
- `GET /api/recipes` - Search recipes
- `GET /api/recipes/:id` - Get recipe details

### Alerts
- `GET /api/alerts` - List alerts
- `POST /api/alerts/:id/ack` - Acknowledge alert

### Cameras
- `GET /api/cameras` - List cameras
- `POST /api/cameras` - Create camera
- `GET /api/cameras/:id` - Get camera
- `PATCH /api/cameras/:id` - Update camera
- `DELETE /api/cameras/:id` - Delete camera
- `POST /api/cameras/:id/calibrate` - Calibrate camera

### Profiles
- `GET /api/profiles` - List profiles
- `POST /api/profiles` - Create profile
- `GET /api/profiles/:id` - Get profile
- `PATCH /api/profiles/:id` - Update profile
- `DELETE /api/profiles/:id` - Delete profile

### Inventory
- `GET /api/inventory/items` - List inventory items
- `POST /api/inventory/items` - Create inventory item
- `GET /api/inventory/items/:id` - Get inventory item
- `PATCH /api/inventory/items/:id` - Update inventory item
- `DELETE /api/inventory/items/:id` - Delete inventory item
- `POST /api/inventory/items/:id/snapshot` - Create snapshot

### Reports
- `GET /api/reports/missing-items` - Missing items report
- `GET /api/reports/consumption` - Consumption report
- `GET /api/reports/gas-history` - Gas history report
- `GET /api/reports/alerts-summary` - Alerts summary report

### Tenants
- `GET /api/tenants/:id` - Get tenant
- `PATCH /api/tenants/:id` - Update tenant
- `GET /api/tenants/:id/members` - List members
- `POST /api/tenants/:id/invite` - Invite user
- `DELETE /api/tenants/:id/members/:userId` - Remove member
- `PATCH /api/tenants/:id/members/:userId/role` - Update member role
- `GET /api/tenants/:id/usage` - Get usage metrics

### Notifications
- `POST /api/notifications/subscribe` - Subscribe to push notifications
- `GET /api/notifications/preferences` - Get notification preferences
- `PATCH /api/notifications/preferences` - Update notification preferences

## Configuration

### Environment Variables (Edge CV)

See `edge-cv/.env.example` for all available options.

Key variables:
- `API_BASE_URL` - Backend API URL
- `CAMERA_ID` - Unique camera identifier
- `CAMERA_TYPE` - `gas` or `fridge`
- `GAS_SCHEDULE_TIME` - Daily capture time (HH:MM)
- `FRIDGE_SCHEDULE_INTERVAL` - Capture interval in hours

### Database Schema

See `migrations/0001_initial_schema.sql` for complete schema.

Main tables:
- `accounts`, `tenants`, `users` - Multi-tenancy
- `cameras`, `images` - Camera management
- `gas_levels`, `inventory_items`, `inventory_snapshots` - Detection data
- `recipes`, `recipe_ingredients`, `profiles` - Recipe system
- `alerts`, `usage_meters`, `audit_logs` - Monitoring

## Development

### Running Locally

```bash
# Backend (Workers)
npm run dev:worker

# Frontend (Vite dev server with HMR)
npm run dev

# Frontend (Cloudflare Pages)
npm run dev:pages

# Edge CV
cd edge-cv && python main.py
```

### Testing

```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage

# Lint
npm run lint
```

### Performance Monitoring

See [PERFORMANCE.md](./PERFORMANCE.md) for detailed guide on all optimizations.

```bash
# Build optimized bundle
npm run build:frontend

# Preview production build
npm run preview

# Analyze bundle size
npm run build:frontend -- --mode analyze
```

**Key Features**:
- **Nanostores**: 1KB state management (replaces Redux/Zustand)
- **Web Vitals**: Real-time performance metrics
- **Lazy Loading**: Images load on-demand
- **Smart Caching**: 3 Service Worker strategies
- **Code Splitting**: Automatic chunk optimization

## Deployment

### Production Checklist

- [ ] Change `JWT_SECRET_KEY` to a secure random value
- [ ] Configure custom domain in Cloudflare
- [ ] Set up proper SSL/TLS
- [ ] Configure rate limits in KV
- [ ] Set up monitoring and alerting
- [ ] Review and adjust free tier limits
- [ ] Test multi-tenant isolation
- [ ] Perform security audit
- [ ] Set up backup strategy for D1

## Free Tier Limits (Cloudflare)

- **Workers**: 100,000 requests/day
- **D1**: 5 GB storage, 5M reads/day
- **KV**: 100,000 reads/day, 1,000 writes/day
- **R2**: 10 GB storage, 10M Class A ops/month
- **Pages**: Unlimited requests

**Recommended limits per tenant (free plan):**
- 3 cameras max
- 1,000 captures/month
- 100 alerts/month
- 7 days retention
- 100 MB storage

## Roadmap

### Phase 1: MVP (Current)
- ✅ Multi-tenant SaaS core
- ✅ Gas and fridge monitoring
- ✅ Basic recipe matching
- ✅ PWA frontend

### Phase 2: Enhanced Features
- [ ] OCR for expiration dates
- [ ] Price tracking per store
- [ ] Auto-reorder suggestions
- [ ] Advanced recipe filters
- [ ] Meal planning calendar

### Phase 3: Scale & Polish
- [ ] Mobile native apps (iOS/Android)
- [ ] SSO (Google, Apple)
- [ ] Advanced analytics dashboard
- [ ] API for third-party integrations
- [ ] Improved CV models (fine-tuned)

## Contributing

This is a PRD implementation project. For production use, please:
1. Review security practices
2. Add comprehensive tests
3. Implement proper error handling
4. Add monitoring and logging
5. Conduct security audit

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- GitHub Issues: [link]
- Documentation: [link]
- Email: support@kitcheneye.com

---

**Built with ❤️ for smart kitchens everywhere**
