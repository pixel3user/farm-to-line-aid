# Farm to LINE - Smart Agricultural Sales Platform

A professional web application connecting Taiwan's farms with markets through LINE integration, featuring AI-powered tools for demand prediction, marketing asset generation, and store discovery.

## Features

### For Farmers (Sellers)
- **Dashboard**: KPI tracking, quick actions, and activity feed
- **Product Management**: CRUD operations, inventory tracking, and bulk actions
- **Store Locator**: Find nearby markets with lead scoring and status tracking
- **Marketing Tools**: AI-powered flyer generation and message templates
- **Analytics**: Performance metrics and tiny-data forecasting
- **References**: Guidelines for respectful communication and LINE bot setup

### For Markets (Buyers)
- **Farm Discovery**: Search and filter local farms by location, category, and rating
- **Product Catalog**: Compare products across farms with pricing and availability
- **Delivery Schedule**: View and book delivery windows from multiple farms
- **Ratings & Reviews**: Read and submit reviews for farm experiences

### LINE Integration
- **Rich Menu Navigation**: Intuitive bot interface for farmers
- **LIFF Mini-Forms**: Quick data entry through LINE-integrated forms
- **Smart Notifications**: AI-powered reminders and insights
- **Safety Features**: Consent-based communication with quiet hours and frequency limits

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **UI**: Tailwind CSS, shadcn/ui components
- **State Management**: React Query, Zustand
- **Routing**: React Router v6
- **Authentication**: Firebase Auth with LINE LIFF integration
- **Database**: Firebase Firestore
- **Maps**: Mapbox integration (optional)
- **Icons**: Lucide React

## Project Structure

```
src/
├── components/
│   ├── layouts/          # App, Farmer, and Market layouts
│   └── ui/              # shadcn/ui components
├── pages/
│   ├── auth/            # Sign in/up pages
│   ├── farmer/          # Farmer dashboard and tools
│   ├── market/          # Market discovery and management
│   └── demo/            # LINE bot demo
├── types/               # TypeScript interfaces
├── lib/                 # Utilities and mock APIs
└── contexts/            # React contexts (Auth, etc.)
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Firebase project (for authentication and database)
- LINE Developer account (for bot integration)
- Mapbox account (optional, for map features)

### Installation

1. Clone the repository:
```bash
git clone <YOUR_GIT_URL>
cd farm-to-line-aid-1
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp env.example .env.local
# Edit .env.local with your actual API keys
```

4. Start the development server:
```bash
npm run dev
```

### Environment Variables

Key environment variables needed:

- `VITE_FIREBASE_*`: Firebase configuration
- `VITE_LIFF_ID`: LINE LIFF application ID
- `LINE_CHANNEL_ACCESS_TOKEN`: LINE bot channel access token
- `LINE_CHANNEL_SECRET`: LINE bot channel secret
- `VITE_MAPBOX_TOKEN`: Mapbox token (optional)

## Routes

### Public Routes
- `/` - Home page with role selection
- `/auth/signin` - Sign in page
- `/auth/signup` - Sign up page
- `/demo/line` - LINE bot demo

### Farmer Routes
- `/farmer` - Farmer dashboard
- `/farmer/products` - Product management
- `/farmer/stores` - Store locator
- `/farmer/marketing` - Marketing tools
- `/farmer/analytics` - Analytics and forecasting
- `/farmer/references` - Help and guidelines

### Market Routes
- `/market` - Market dashboard
- `/market/farms` - Farm discovery
- `/market/products` - Product catalog
- `/market/schedule` - Delivery schedule
- `/market/ratings` - Ratings and reviews

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/eab91867-619b-4d6e-8e8e-7848944d8ab1) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
