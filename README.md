# FBR Integration - Turbo Repo

This is a monorepo using Turbo for the FBR (Federal Board of Revenue) Integration project. The project consists of a React frontend and Node.js backend.

## Project Structure

```
fbr-integration/
├── apps/
│   ├── frontend/          # React + Vite frontend application
│   └── backend/           # Node.js + Express backend application
├── packages/
│   └── shared/            # Shared utilities and constants
├── package.json           # Root package.json with workspace configuration
├── turbo.json            # Turbo configuration
└── README.md             # This file
```

## Prerequisites

- Node.js 18+
- npm 10+

## Getting Started

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create `.env` files in both `apps/frontend` and `apps/backend` directories with your configuration.

3. **Start development servers:**

   ```bash
   # Start both frontend and backend in development mode
   npm run dev

   # Or start them individually
   npm run dev --workspace=frontend
   npm run dev --workspace=backend
   ```

## Available Scripts

### Root Level (Turbo Commands)

- `npm run dev` - Start all applications in development mode
- `npm run build` - Build all applications
- `npm run lint` - Lint all applications
- `npm run test` - Run tests for all applications
- `npm run clean` - Clean build artifacts

### Frontend (apps/frontend)

- `npm run dev` - Start Vite development server (port 3000)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Backend (apps/backend)

- `npm run dev` - Start development server with nodemon (port 5000)
- `npm run start` - Start production server
- `npm run build` - Build backend (placeholder)

## Development

### Frontend

The frontend is built with:

- React 19
- Vite
- Material-UI
- Tailwind CSS
- React Router

### Backend

The backend is built with:

- Node.js
- Express.js
- MySQL
- Sequelize ORM
- JWT Authentication

### Shared Package

The shared package contains common utilities and constants used by both frontend and backend.

## Environment Variables

### Frontend (.env)

```env
VITE_API_BASE_URL=http://157.245.150.54:5000
VITE_FBR_API_URL=https://gw.fbr.gov.pk
```

### Backend (.env)

```env
PORT=5000
DB_HOST=157.245.150.54
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=your_db_name
JWT_SECRET=your_jwt_secret
```

## Deployment

### Build for Production

```bash
npm run build
```

### Deploy Individual Apps

```bash
# Deploy frontend
npm run build --workspace=frontend

# Deploy backend
npm run build --workspace=backend
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests and linting
4. Submit a pull request

## License

This project is licensed under the ISC License.
