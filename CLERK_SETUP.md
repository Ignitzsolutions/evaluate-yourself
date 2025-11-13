# Clerk Authentication Setup

## Environment Variables Required

### Frontend (.env or .env.local)
```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
```

### Backend (.env or environment)
```env
CLERK_SECRET_KEY=sk_test_your_secret_key_here
```

## Getting Clerk Keys

1. Sign up at https://clerk.com
2. Create a new application
3. Copy the **Publishable Key** (starts with `pk_test_` or `pk_live_`)
4. Copy the **Secret Key** (starts with `sk_test_` or `sk_live_`)

## Azure Realtime API Setup

For the interview feature to work, you also need Azure credentials:

```env
AZURE_REALTIME_SCOPE=https://ai.azure.com/.default
```

Or use a specific scope:
```env
AZURE_REALTIME_SCOPE=https://gpt-interactive-talk.services.ai.azure.com/.default
```

Make sure Azure CLI is installed and you've run `az login` for the `/api/token` endpoint to work.

## Clerk Theme Customization

The Clerk components are configured to match the application theme:
- Primary color: `#FF6B35` (orange accent)
- Font: `Avenir, sans-serif`

This is set in `src/App.tsx` for SignIn and SignUp components.

