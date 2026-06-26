# Deploying YouTubeMax to Vercel

Complete step-by-step guide for deploying YouTubeMax to Vercel with transcript support.

---

## Quick Deploy (2 minutes)

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Deploy
vercel

# 3. Open your URL
vercel ls
```

Your app is live! If transcripts fail, follow the **Fixing Transcript Errors** section below.

---

## Dashboard Deploy (No CLI)

1. **Fork the repo** on GitHub
2. **Go to Vercel Dashboard** — https://vercel.com
3. **Click "Add New..."** → **Project**
4. **Select your forked repo**
5. **Framework:** Auto-detects as Vite
6. **Click Deploy**

URL appears in ~1 minute.

---

## Transcript Fetching - No Proxy Needed (Usually!)

YouTubeMax uses **browser-identity headers** to fetch transcripts, which works for most cases without a proxy.

**Status: Transcripts loading?**
- ✅ **Yes** → You're all set! No proxy needed.
- ❌ **No, seeing InnerTube/LOGIN_REQUIRED errors** → Optional: Add proxy (see below)

### Optional: Add a Proxy for Extra Resilience

If transcript fetching fails (rare), you can optionally configure a residential proxy as fallback:

### Step 1: Choose a Proxy Service (Optional)

**Only needed if browser headers don't work.** For most use cases, the browser identity approach is sufficient.

**Best residential proxy services for YouTube:**

#### **Option A: Oxylabs (Recommended)**
- €5/GB, YouTube-optimized
- Excellent uptime and support
- https://oxylabs.io

#### **Option B: BrightData**
- $5/GB, highly reliable
- Extensive YouTube support
- https://brightdata.com

#### **Option C: ScraperAPI**
- $9-99/month, affordable
- Simple setup
- https://www.scraperapi.com

**Avoid:** Simple CORS proxies (AllOrigins, CORS Anywhere, etc.) - they don't support YouTube's API properly.

### Step 2: Get Your Proxy URL

- **Oxylabs:** Sign up at https://oxylabs.io, get API endpoint from dashboard
- **BrightData:** Sign up, get residential proxy URL with auth
- **ScraperAPI:** Sign up, get API key, use `https://api.scraperapi.com?url=`

Check service's documentation for exact URL format.

### Step 3: Add to Vercel

#### **Option A: CLI**

```bash
# Run from project directory
vercel env add YOUTUBE_PROXY_URL

# Paste your proxy URL when prompted:
# Example (ScraperAPI): https://api.scraperapi.com?url=
# Example (Oxylabs): https://YOUR_KEY@YOUR_ENDPOINT.oxylabs.io:...

# Redeploy
vercel deploy --prod
```

#### **Option B: Vercel Dashboard**

1. Go to **Vercel Dashboard** → Your Project
2. **Settings** → **Environment Variables**
3. **Add New**
   - Name: `YOUTUBE_PROXY_URL`
   - Value: Your proxy service URL (with auth if needed)
   - Environments: **Production, Preview, Development** ✓
4. **Save**
5. **Deployments** → **Redeploy** (select latest) → **Redeploy**

#### **Option C: vercel.json**

```json
{
  "env": {
    "YOUTUBE_PROXY_URL": "https://YOUR_PROXY_URL_HERE"
  }
}
```

Then:
```bash
vercel deploy --prod
```

### Step 4: Test

1. Go to your Vercel URL
2. Paste a YouTube video
3. Wait for analysis
4. **Transcripts should now load!** ✓

If still failing:
- Try a different proxy service
- Check proxy URL format (should end with `?url=`)
- Verify environment variable is set (`Settings → Environment Variables`)
- Check Vercel function logs for errors

---

## Monitoring Transcript Issues

### View Function Logs

```bash
# SSH into Vercel and tail logs (if available)
vercel logs

# Or check dashboard
# Dashboard → Your Project → Deployments → [Latest] → Function Logs
```

### What Success Looks Like

```json
{
  "meta": { "videoId": "...", "title": "...", ... },
  "chapters": [ { "start": 0, "title": "...", "source": "description" }, ... ],
  "transcript": [
    { "start": 0, "duration": 5, "text": "..." },
    ...
  ],
  "keywords": [ ... ],
  "summary": "...",
  "warnings": []  // Empty if transcript loaded
}
```

### Common Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `InnerTube /player failed (522/500)` | Simple proxies don't work with YouTube's API | Use residential proxy: Oxylabs, BrightData, or ScraperAPI (see Step 1) |
| `Could not load oEmbed metadata (408)` | YouTube oEmbed API timeout from Vercel | This should auto-recover. Ensure you don't have proxy set for oEmbed. Verify by checking that YOUTUBE_PROXY_URL is **only for transcripts**, not metadata |
| `Transcript fetch failed even with proxy` | Proxy not configured correctly or YouTube is blocking it | Verify proxy service is working (test in curl). Try a different residential proxy service |
| `LOGIN_REQUIRED` in transcript | YouTube blocking datacenter IP | Add proxy URL (see above) |
| `In-app results unavailable` in search | Proxy misconfigured for search | Search should work without proxy. Remove `YOUTUBE_PROXY_URL` if search was working before |
| `403 Forbidden` | Proxy rate limited or blocked | Wait 1 min, try again, or upgrade proxy service plan |
| `Connection timeout` | Network issue or proxy endpoint down | Redeploy or try different proxy |

**Key:** Proxy is **only for transcripts**. Metadata and search work fine on Vercel without a proxy. Always use a residential proxy service (never simple CORS proxies).

---

## Advanced Configuration

### Using a Private Proxy

If you run your own proxy on a VPS:

```bash
# VPS proxy endpoint (HTTP/HTTPS)
vercel env add YOUTUBE_PROXY_URL http://your-vps.com:8080

# Or with authentication
vercel env add YOUTUBE_PROXY_URL http://user:pass@your-vps.com:8080
```

**Note:** HTTP proxies (traditional proxy:port) require Node.js `HttpProxyAgent`, which isn't available in Vercel Functions. Recommend using API-based proxies instead.

### Conditional Proxy (Different per Environment)

```bash
# Production proxy (residential, paid)
vercel env add YOUTUBE_PROXY_URL https://api.brightdata.com/request?key=... --environments production

# Preview proxy (free)
vercel env add YOUTUBE_PROXY_URL https://api.allorigins.win/raw?url= --environments preview

# Local development (direct fetch)
# Leave YOUTUBE_PROXY_URL unset in .env.local
```

### Rate Limiting

Most proxies have rate limits:

| Service | Limit | Cost to Increase |
|---------|-------|-----------------|
| AllOrigins | ~50/min | Free (generous) |
| CORS Anywhere | 200/hour | Free or paid tiers |
| BrightData | Based on plan | $5-100/GB |
| ScraperAPI | Based on plan | $9-99/month |

For production with many users, use a **paid residential proxy** (~$5-20/month for 100GB/month usage).

---

## Zero Downtime Deploy

To update your app without transcript errors during transition:

```bash
# 1. Test locally
npm run dev

# 2. Push to GitHub
git add .
git commit -m "Update"
git push

# 3. Vercel auto-deploys (stays live, no downtime)

# 4. Verify
curl https://your-app.vercel.app/api/analyze?videoId=dQw4w9WgXcQ
```

---

## Rollback

If something breaks:

```bash
# List deployments
vercel ls

# Promote a previous deployment to production
vercel promote [DEPLOYMENT_ID]

# Or use dashboard: Deployments → [Previous] → Promote to Production
```

---

## Custom Domain

```bash
# Add domain
vercel domains add yourdomain.com

# DNS records updated automatically (Vercel-managed)
# or manually configure CNAME → cname.vercel.com

# Verify
vercel domains ls
```

---

## Troubleshooting Vercel Deploys

### Build Fails

```bash
# View build logs
vercel logs --follow

# Rebuild locally first
npm run build
npm run preview

# Then deploy
vercel deploy --prod
```

### Transcripts Always Fail

1. **Confirm proxy URL is set:**
   ```bash
   vercel env ls
   ```
   Should show `YOUTUBE_PROXY_URL = https://...`

2. **Check URL format:**
   ```
   ❌ https://api.allorigins.win/raw  (missing ?url=)
   ✅ https://api.allorigins.win/raw?url=  (correct)
   ```

3. **Test proxy directly:**
   ```bash
   curl "https://api.allorigins.win/raw?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ"
   ```

4. **Check function logs:**
   - Dashboard → Deployments → [Latest] → Function Logs
   - Look for `Transcript fetch failed: ...`

### Environment Variables Not Applying

```bash
# Ensure you're in the project directory
cd youtubemax

# Re-add variable
vercel env rm YOUTUBE_PROXY_URL  # Remove old
vercel env add YOUTUBE_PROXY_URL  # Add new

# Redeploy
vercel deploy --prod
```

### Cold Start Delays

First request to `/api/analyze` may take 5-10 seconds on free tier. This is normal. Vercel keeps functions warm for 15 minutes of inactivity, then spins down.

To minimize: Use paid Vercel plan (~$20/month) for always-warm functions.

---

## Performance Monitoring

View analytics in Vercel Dashboard:

- **Deployments** — Build time, size
- **Analytics** — Page views, response times
- **Real Time** — Live request monitoring
- **Function Logs** — API errors and debug output

---

## Next Steps

After deploying:

1. ✅ Share your URL with friends
2. ✅ Add to your profile / portfolio
3. ✅ Open issues for bugs
4. ✅ Submit PRs for features
5. ✅ Star the repo! ⭐

---

**Need help?** Check [README.md](README.md#troubleshooting) or open a GitHub issue.
