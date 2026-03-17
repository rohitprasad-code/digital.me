# LinkedIn Integration

Connects Digital Me to LinkedIn via OAuth 2.0 to fetch your professional profile.

## Setup

1.  **Create a LinkedIn Application**:
    - Go to the [LinkedIn Developer Portal](https://www.linkedin.com/developers/).
    - Create a new app.
    - Add the **OpenID Connect** product to your app.
    - In the **Auth** tab, add `http://localhost:8080/callback` as a Redirect URL.

2.  **Configure Environment Variables**:
    Add the following to your `.env.local`:
    ```env
    LINKEDIN_CLIENT_ID=your_client_id
    LINKEDIN_CLIENT_SECRET=your_client_secret
    ```

3.  **Authenticate**:
    Run the following command to link your account:
    ```bash
    npm run cli linkedin:auth
    ```

## How It Works

### OAuth Flow
LinkedIn uses OAuth 2.0. The CLI starts a local server on port 8080 to capture the authorization code, which is then exchanged for an access token.

### Data Ingestion
The `ingestLinkedIn` function fetches your basic profile (name, headline, etc.) and embeds it into the vector store.
