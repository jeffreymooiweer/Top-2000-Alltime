<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/16Fl-cmpcl4uaA03BHkxKfD7TZchnTQ9u

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set your Groq API key in `services/geminiService.ts` (replace `PLAATS_HIER_JE_GROQ_API_KEY`)
3. Create a `.env` file in the root directory and add your Spotify Client ID:
   ```
   VITE_SPOTIFY_CLIENT_ID=your_spotify_client_id_here
   ```
   To get a Spotify Client ID:
   - Go to https://developer.spotify.com/dashboard
   - Log in with your Spotify account
   - Click "Create app"
   - Fill in the app name and description
   - Set the Redirect URI to: `http://localhost:3000` (for local development)
     - For production, add your deployed URL as well (e.g., `https://yourusername.github.io/Top-2000-Alltime/`)
   - Copy the Client ID and add it to your `.env` file
4. Run the app:
   `npm run dev`
