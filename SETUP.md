# Minimal Setup Guide

Super simple setup - just paste 2 cookie values from Amazon.com!

## Quick Setup (2 minutes)

1. **Login to amazon.com** in your browser

2. **Open DevTools** (F12) → Network tab

3. **Find any request** and copy these 2 cookie values:
   - `ubid-main=133-678-78910` 
   - `at-main=Atza|IwEBIA-fRecN...` (long token)

4. **Configure:**
   ```bash
   cp .env.example .env
   # Edit .env - just paste the 2 values!
   ```

5. **Deploy:**
   ```bash
   pnpm install && pnpm run deploy
   ```

**That's it!** The server automatically builds proper cookies with `csrf=1`

## What Works

| Feature | Amazon.com Cookies | Alexa App Cookies |
|---------|-------------------|-------------------|
| Account Info | ✅ | ✅ |
| Device Control | ✅ | ✅ |
| Smart Home | ✅ | ✅ |
| Music Info | ✅ | ✅ |
| Announcements | ❌ | ✅ |

## Authentication Details

The server automatically detects your cookie type and:

- **Amazon.com cookies**: Uses CSRF format for web APIs
- **Alexa app cookies**: Uses mobile authentication format  
- **Auto-discovery**: Dynamically finds your devices and account ID
- **Caching**: Reduces API calls with 5-minute cache

## Troubleshooting

- **403/401 errors**: Cookies expired, get fresh ones
- **Device not found**: Wait 1-2 minutes for discovery cache
- **Announcements fail**: Need Alexa app cookies (amazon.com limited)