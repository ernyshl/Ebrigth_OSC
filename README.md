# Ebright OSC — HRMS + CRM Platform

A multi-module platform including HRMS (manpower scheduling, attendance, HR) and a full **CRM module** for managing lead pipelines, omnichannel messaging (WhatsApp + Email), visual automation workflows, and external integrations across multiple branches.

---

## CRM Module — Quick Start

### Prerequisites
- **Node.js 20+** and **npm**
- **PostgreSQL 14+** (shared with HRMS — connection in `.env`)
- **Redis 7+** (for BullMQ background jobs)

### Setup

```bash
# 1. Install dependencies
npm install --legacy-peer-deps

# 2. Copy env file and fill in values
cp .env.example .env
# Edit .env — at minimum set: DATABASE_URL, REDIS_URL, BETTER_AUTH_SECRET, ENCRYPTION_KEY

# 3. Run database migrations (adds all crm_* tables)
npx prisma migrate dev --name crm-init

# 4. Seed demo data (16 pipeline stages, 3 branches, 80 contacts, users)
npm run db:seed

# 5. Start the Next.js app
npm run dev

# 6. Start the BullMQ worker process (separate terminal)
npm run worker
```

### Demo Credentials (after seeding)

| Role | Email | Password |
|---|---|---|
| Super Admin | admin@ebright.my | password123 |
| Agency Admin | agency@ebright.my | password123 |
| BM (KL) | bm.kl@ebright.my | password123 |
| BM (PJ) | bm.pj@ebright.my | password123 |
| BM (Subang) | bm.subang@ebright.my | password123 |
| Branch Staff | staff1@ebright.my | password123 |

Access the CRM at: `http://localhost:3000/crm`

### Key Commands

```bash
npm run dev          # Next.js development server
npm run worker       # BullMQ background workers
npm run build        # Production build
npm run test         # Vitest unit tests
npm run test:e2e     # Playwright end-to-end tests (requires running app)
npm run db:migrate   # Run Prisma migrations
npm run db:seed      # Seed demo data
npm run db:generate  # Regenerate Prisma client after schema changes
```

---

## CRM Features

- **Lead Pipeline Kanban** — 16-stage pipeline, drag-and-drop (@hello-pangea/dnd), color-coded by staleness
- **Contacts** — Malaysian phone normalization (E.164), duplicate detection, bulk actions, CSV export
- **Automation Engine** — React Flow visual editor, 12 trigger types, 13 action types, BullMQ workers
- **Omnichannel Messaging** — WhatsApp (Meta Cloud API + Twilio), Email (Resend), unified inbox
- **Dashboard** — 8 Tremor widgets, conversion funnel, leaderboard, trends, date range selector
- **Integrations** — Meta Lead Ads, TikTok, Wix, Google Forms/Sheets, Google Calendar, Website Form embed
- **Multi-tenancy** — Agency → Branch → User hierarchy, 4 RBAC roles
- **Web Push Notifications** — VAPID-based, with notification inbox
- **PDPA Compliance** — Every personal data access logged to `core_audit_logs`

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — tenancy model, BullMQ topology, automation engine design
- [Integrations](docs/INTEGRATIONS.md) — OAuth setup for Meta, TikTok, Google, Twilio, Resend
- [Automation](docs/AUTOMATION.md) — node reference, merge tag reference
- [API](docs/API.md) — public API endpoints, authentication, rate limits
- [Changelog](CHANGELOG.md) — deviations from spec, stubbed features

## Docker Deployment

```bash
# Build and run
docker-compose -f docker/docker-compose.yml up -d

# The app connects to the shared Postgres/Redis via DATABASE_URL + REDIS_URL env vars
```

See [nginx.conf.example](nginx.conf.example) for reverse proxy configuration.

---

## HRMS Module (existing)

## Tech Stack

- **React** (Vite)
- **React Query** - Server state management
- **React Router** - Client-side routing
- **Tailwind CSS** - Styling
- **React Hook Form + Zod** - Form validation

## Project Structure

```
ebright_ticketing_system/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── hooks/         # Custom hooks (useAuth)
│   │   ├── pages/         # Page components
│   │   ├── services/      # API services
│   │   ├── App.tsx        # Main app component
│   │   └── main.tsx       # Entry point
│   ├── package.json
│   └── vite.config.ts
│
├── server/                 # Express backend
│   ├── src/
│   │   ├── config/        # Database configuration
│   │   ├── controllers/   # Route controllers
│   │   ├── middleware/    # Auth middleware
│   │   ├── routes/        # API routes
│   │   ├── schemas/       # Zod validation schemas
│   │   ├── services/      # Business logic
│   │   ├── scripts/       # Database initialization
│   │   ├── utils/         # JWT utilities
│   │   └── index.ts       # Server entry point
│   ├── package.json
│   └── .env               # Environment variables
│
└── README.md
```

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 14+

### Database Setup

1. Create a PostgreSQL database:
```sql
CREATE DATABASE ebright_ticketing;
```

2. Update the `.env` file in `server/` with your database credentials:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ebright_ticketing
DB_USER=postgres
DB_PASSWORD=your_password
```

3. Initialize the database:
```bash
cd server
npm run db:init
```

### Backend Setup

```bash
cd server
npm install
npm run dev
```

The server will start on http://localhost:5000

### Frontend Setup

```bash
cd client
npm install
npm run dev
```

The client will start on http://localhost:5173

### Default Login

After running the database initialization script, you can login with:
- Email: admin@ebright.com
- Password: admin123

## Features

### Issue Contexts

The system supports the following issue contexts with conditional fields:

**Aone:**
- Freeze Student: Student Name, Start Date, End Date, Reason
- Archive Student: Student Name, Reason
- Delete Invoice: Student Name, Invoice Number, Reason
- Login Issue: Remarks
- Others: Remarks

**ClickUp:**
- Missing, Duplicate, Linkage, Others → Remarks

**GHL:**
- Leads, Tally, Organizing Leads, Booking, Workflow, Others → Remarks

**Process Street:**
- Extend, Others → Remarks

**Other:**
- State Your Issue (free text)

### Branches

The following branches are available (sorted alphabetically):
- Ampang (AMP)
- Bandar Baru Bangi (BBB)
- Bandar Seri Putra (BSP)
- Bandar Tun Hussein Onn (BTHO)
- Cyberjaya (CJY)
- Denai Alam (DA)
- Danau Kota (DK)
- Dataran Puchong Utama (DPU)
- Eco Grandeur (EGR)
- Kota Damansara (KD)
- Klang (KLG)
- Kajang TTDI Grove (KTG)
- Kota Warisan (KW)
- Online (ONL)
- Putrajaya (PJY)
- Rimbayu (RBY)
- Setia Alam (SA)
- Shah Alam (SHA)
- Sri Petaling (SP)
- Subang Taipan (ST)
- Taman Sri Gombak (TSG)

### Dashboard

The dashboard displays:
- Total tickets count
- Open tickets count
- In Progress tickets count
- Resolved tickets count
- Recent tickets table

### Ticket Management

- Create new tickets with conditional form fields
- Filter tickets by status, branch, and issue context
- Pagination support
- Ticket history tracking

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/profile` - Get current user profile (requires auth)
- `GET /api/auth/users` - Get all users (admin only)

### Tickets
- `POST /api/tickets` - Create new ticket (requires auth)
- `GET /api/tickets` - Get all tickets (requires auth)
- `GET /api/tickets/stats` - Get ticket statistics (requires auth)
- `GET /api/tickets/:id` - Get ticket by ID (requires auth)
- `PATCH /api/tickets/:id/status` - Update ticket status (admin only)
- `GET /api/tickets/:id/history` - Get ticket history (requires auth)

### Branches
- `GET /api/branches` - Get all branches (requires auth)
- `GET /api/branches/:id` - Get branch by ID (requires auth)

## Environment Variables

### Server (.env)
```
PORT=5000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ebright_ticketing
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
```

## License

MIT