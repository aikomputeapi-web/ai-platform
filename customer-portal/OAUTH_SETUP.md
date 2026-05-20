# OAuth Configuration Guide

This guide explains how to set up OAuth authentication for Google, GitHub, and Apple sign-in.

## Environment Variables

Add the following environment variables to your `.env` file:

```bash
# NextAuth.js Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret-here

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# GitHub OAuth
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Apple OAuth
APPLE_CLIENT_ID=your-apple-client-id
APPLE_CLIENT_SECRET=your-apple-client-secret
```

## Setup Instructions

### 1. Generate NextAuth Secret

```bash
openssl rand -base64 32
```

Add the output to `NEXTAUTH_SECRET` in your `.env` file.

### 2. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Navigate to "APIs & Services" > "Credentials"
4. Click "Create Credentials" > "OAuth 2.0 Client ID"
5. Configure OAuth consent screen if prompted
6. Application type: "Web application"
7. Add authorized redirect URIs:
   - Development: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://yourdomain.com/api/auth/callback/google`
8. Copy Client ID and Client Secret to your `.env` file

### 3. GitHub OAuth Setup

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in application details:
   - Application name: Your app name
   - Homepage URL: `http://localhost:3000` (dev) or your production URL
   - Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
4. Click "Register application"
5. Generate a new client secret
6. Copy Client ID and Client Secret to your `.env` file

### 4. Apple OAuth Setup

1. Go to [Apple Developer Portal](https://developer.apple.com/account/)
2. Navigate to "Certificates, Identifiers & Profiles"
3. Create a new App ID:
   - Select "App IDs" > Click "+"
   - Description: Your app name
   - Bundle ID: com.yourcompany.yourapp
   - Enable "Sign In with Apple"
4. Create a Services ID:
   - Select "Services IDs" > Click "+"
   - Description: Your app name
   - Identifier: com.yourcompany.yourapp.service
   - Enable "Sign In with Apple"
   - Configure:
     - Primary App ID: Select the App ID created above
     - Web Domain: yourdomain.com
     - Return URLs: `https://yourdomain.com/api/auth/callback/apple`
5. Create a Key:
   - Select "Keys" > Click "+"
   - Key Name: Your key name
   - Enable "Sign In with Apple"
   - Configure: Select your App ID
   - Download the key file (.p8)
6. Generate Client Secret:
   - Apple requires a JWT token as the client secret
   - Use the downloaded key file to generate the JWT
   - See [NextAuth Apple Provider docs](https://next-auth.js.org/providers/apple) for details

### 5. Database Migration

Run the database migration to add OAuth support tables:

```bash
cd ai-platform/customer-portal
npx prisma migrate deploy
```

Or for development:

```bash
npx prisma migrate dev
```

## Testing OAuth Integration

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Navigate to `/login` or `/signup`

3. Click on any OAuth provider button (Google, GitHub, or Apple)

4. Complete the OAuth flow

5. You should be redirected to `/dashboard` upon successful authentication

## Production Deployment

1. Update `NEXTAUTH_URL` to your production domain
2. Update OAuth redirect URIs in each provider's console to use your production domain
3. Ensure all environment variables are set in your production environment
4. Run database migrations in production

## Troubleshooting

### "Configuration error" on OAuth callback

- Verify `NEXTAUTH_URL` matches your current domain
- Check that redirect URIs in provider consoles match exactly
- Ensure `NEXTAUTH_SECRET` is set

### "Email already exists" error

- The system uses `allowDangerousEmailAccountLinking: true` to link OAuth accounts with existing email/password accounts
- Users can sign in with either method once linked

### OAuth provider not working

- Verify client ID and secret are correct
- Check that the provider is enabled in the OAuth console
- Ensure redirect URIs are whitelisted
- Check browser console for detailed error messages

## Security Notes

- Never commit `.env` files to version control
- Use different OAuth credentials for development and production
- Rotate secrets regularly
- Monitor OAuth provider dashboards for suspicious activity
- The `allowDangerousEmailAccountLinking` setting allows automatic account linking - consider the security implications for your use case

## Additional Resources

- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
- [GitHub OAuth Documentation](https://docs.github.com/en/developers/apps/building-oauth-apps)
- [Apple Sign In Documentation](https://developer.apple.com/sign-in-with-apple/)
