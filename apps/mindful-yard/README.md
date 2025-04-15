# The Mindful Yard

A modern web application built with Next.js and Payload CMS, designed to manage mindfulness and wellness services.

## Tech Stack

- [Next.js](https://nextjs.org/) (v15.2.4)
- [Payload CMS](https://payloadcms.com/)
- [PostgreSQL](https://www.postgresql.org/) for database
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)

## Features

- SEO optimization with `@payloadcms/plugin-seo`
- Email integration with Resend
- Authentication with Magic Link
- Role-based access control
- Booking system
- Payment processing
- Rich text editing with Lexical editor
- Timezone support (Default: Europe/Dublin)

## Prerequisites

- Node.js (^18.20.2 || >=20.9.0)
- pnpm package manager
- PostgreSQL database
- Docker (optional)

## Getting Started

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
PAYLOAD_SECRET=your_secret_here
DATABASE_URI=postgres://postgres:password@localhost:5432/database
NEXT_PUBLIC_SERVER_URL=http://localhost:3000
RESEND_API_KEY=your_resend_api_key
DEFAULT_FROM_ADDRESS=your_email@domain.com
DEFAULT_FROM_NAME=The Mindful Yard
```

### Installation

1. Install dependencies:
```bash
pnpm install
```

2. Start the development server:
```bash
pnpm dev
```

Or use the safer development command that clears the `.next` cache:
```bash
pnpm devsafe
```

### Docker Setup

The application includes Docker configuration for easy development. To start with Docker:

```bash
docker-compose up
```

This will start:
- The application server
- PostgreSQL database
- Required services

## Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build the application
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint
- `pnpm generate:types` - Generate Payload types
- `pnpm generate:importmap` - Generate import map
- `pnpm payload` - Run Payload CLI commands
- `pnpm ci` - Run CI tasks (database migration and build)

## Project Structure
