# KitchenEye Deployment Guide

## Prerequisites

1. **Cloudflare Account** (free tier is sufficient)
   - Sign up at https://dash.cloudflare.com/sign-up
   - Verify your email

2. **Node.js** 18+ and npm
   ```bash
   node --version  # Should be 18+
   npm --version
   ```

3. **Wrangler CLI**
   ```bash
   npm install -g wrangler
   wrangler login
   ```

4. **Python 3.11+** (for edge CV)
   ```bash
   python --version  # Should be 3.11+
   ```

## Step 1: Clone and Setup

```bash
git clone https://github.com/your-org/kitcheneye.git
cd kitcheneye

# Install dependencies
make install

# Or manually:
npm install
cd edge-cv && pip install -r requirements.txt
```

## Step 2: Create Cloudflare Resources

### 2.1 Create D1 Database

```bash
wrangler d1 create kitcheneye-db
```

This will output something like:
```
Created database kitcheneye-db
database_id = "abcd1234-5678-90ef-ghij-klmnopqrstuv"
```

Copy the `database_id` and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "kitcheneye-db"
database_id = "abcd1234-5678-90ef-ghij-klmnopqrstuv"  # ← Paste here
```

### 2.2 Create KV Namespace

```bash
wrangler kv:namespace create "CONFIG_KV"
```

This will output:
```
Created namespace with id "1234567890abcdef"
```

Update `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "CONFIG_KV"
id = "1234567890abcdef"  # ← Paste here
```

### 2.3 Create R2 Bucket

```bash
wrangler r2 bucket create kitcheneye-images
```

This should already be configured in `wrangler.toml` as:

```toml
[[r2_buckets]]
binding = "IMAGES_R2"
bucket_name = "kitcheneye-images"
```

### 2.4 Run Database Migrations

```bash
wrangler d1 migrations apply kitcheneye-db
```

Verify the tables were created:

```bash
wrangler d1 execute kitcheneye-db --command "SELECT name FROM sqlite_master WHERE type='table'"
```

## Step 3: Deploy Backend (Workers)

### 3.1 Build the Worker

```bash
npm run build:worker
```

### 3.2 Deploy to Cloudflare

```bash
wrangler deploy
```

You should see:
```
Deployed kitcheneye-api to https://kitcheneye-api.your-subdomain.workers.dev
```

### 3.3 Test the API

```bash
curl https://kitcheneye-api.your-subdomain.workers.dev/api/health
```

Expected response:
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": 1234567890,
    "database": "connected"
  }
}
```

## Step 4: Deploy Frontend (PWA)

### 4.1 Build Frontend

```bash
npm run build:frontend
```

### 4.2 Deploy to Cloudflare Pages

```bash
wrangler pages deploy frontend/public --project-name kitcheneye
```

You should see:
```
✨ Deployment complete!
🌎  https://kitcheneye.pages.dev
```

### 4.3 Update API Base URL

Edit `frontend/public/app.js` and update the API base URL:

```javascript
const API_BASE = 'https://kitcheneye-api.your-subdomain.workers.dev';
```

Redeploy:
```bash
npm run build:frontend
wrangler pages deploy frontend/public --project-name kitcheneye
```

## Step 5: Setup Edge CV

### 5.1 Create Configuration

```bash
cd edge-cv
cp .env.example .env
```

### 5.2 Register Camera

First, create an account via the PWA:
1. Visit https://kitcheneye.pages.dev
2. Click "Crear Cuenta Nueva"
3. Fill in email and tenant name
4. Login and note your tenant ID

### 5.3 Configure .env

Edit `edge-cv/.env`:

```bash
API_BASE_URL=https://kitcheneye-api.your-subdomain.workers.dev
CAMERA_ID=gas-camera-001  # Generate unique ID
CAMERA_TYPE=gas  # or 'fridge'
DEVICE_ID=edge-rpi-001

# Camera settings
CAMERA_INDEX=0
CAPTURE_WIDTH=1280
CAPTURE_HEIGHT=720

# Schedule (gas: once daily, fridge: every 4h)
GAS_SCHEDULE_TIME=05:00
FRIDGE_SCHEDULE_INTERVAL=4

# Storage
STORE_IMAGES_LOCALLY=true
SEND_THUMBNAILS=true
```

### 5.4 Run Edge CV

#### Option A: Direct Python
```bash
python main.py
```

#### Option B: Docker
```bash
docker-compose up -d
docker-compose logs -f
```

## Step 6: Seed Sample Data

### 6.1 Get Tenant ID

Login to the PWA and check the browser console or local storage for your tenant ID.

### 6.2 Run Seed Script

Edit `scripts/seed-recipes.sql` and replace `TENANT_ID` with your actual tenant ID.

```bash
wrangler d1 execute kitcheneye-db --file scripts/seed-recipes.sql
```

## Step 7: Configure Cron Triggers

The cron triggers are defined in `wrangler.toml`:

```toml
[triggers]
crons = [
  "0 5 * * *",     # Gas monitoring at 05:00 daily
  "0 */4 * * *"    # Fridge monitoring every 4 hours
]
```

After deployment, verify they're active in the Cloudflare dashboard:
- Go to Workers & Pages → kitcheneye-api → Triggers → Cron Triggers

## Step 8: Verify Deployment

### 8.1 Check API Health
```bash
curl https://kitcheneye-api.your-subdomain.workers.dev/api/health
```

### 8.2 Create Test Account
1. Visit https://kitcheneye.pages.dev
2. Sign up with an email
3. Login and explore the dashboard

### 8.3 Send Test Data from Edge

The edge CV will automatically send data according to the schedule. To test immediately:

1. Edit `edge-cv/main.py` and add at the end of `run()` method:
   ```python
   # Run one capture immediately for testing
   self.capture_and_process()
   ```

2. Run the edge CV:
   ```bash
   python main.py
   ```

3. Check the PWA dashboard for the new data.

## Troubleshooting

### Database Not Found
```bash
wrangler d1 list
```
Verify your database exists and the ID matches `wrangler.toml`.

### API Returns 500 Errors
Check logs:
```bash
wrangler tail
```

### Edge CV Can't Connect
- Verify API_BASE_URL is correct
- Check firewall/network settings
- Ensure camera is accessible (`ls /dev/video*`)

### PWA Not Loading
- Clear browser cache
- Check browser console for errors
- Verify API base URL is correct

## Production Checklist

- [ ] Change JWT_SECRET_KEY to a secure random string
- [ ] Configure custom domain in Cloudflare
- [ ] Set up SSL/TLS (auto with Cloudflare)
- [ ] Configure rate limiting in Workers
- [ ] Set up monitoring and alerts
- [ ] Review RBAC permissions
- [ ] Test multi-tenant isolation
- [ ] Backup D1 database regularly
- [ ] Review and adjust free tier limits
- [ ] Perform security audit
- [ ] Test offline PWA functionality
- [ ] Verify cron jobs are running

## Custom Domain (Optional)

### For Workers API

1. Go to Workers & Pages → kitcheneye-api → Settings → Triggers
2. Add custom domain: `api.yourdomain.com`
3. Update DNS records as instructed

### For Pages (PWA)

1. Go to Workers & Pages → kitcheneye → Custom domains
2. Add custom domain: `app.yourdomain.com`
3. Update DNS records as instructed

## Monitoring

### View Logs

```bash
# Real-time logs
wrangler tail

# Specific deployment
wrangler tail --env production
```

### Check Usage

Go to Cloudflare Dashboard:
- Workers & Pages → Analytics
- R2 → Metrics
- D1 → Usage

## Backup Strategy

### D1 Database Backup

```bash
# Export to SQL
wrangler d1 execute kitcheneye-db --command "SELECT * FROM tenants" --json > backup.json

# Or full backup (requires sqlite3)
wrangler d1 export kitcheneye-db --output backup.sql
```

Schedule regular backups using cron or GitHub Actions.

## Next Steps

1. **Configure cameras**: Set up physical markers for gas detection
2. **Add recipes**: Use the PWA or seed more recipes
3. **Invite users**: Add team members with appropriate roles
4. **Monitor usage**: Keep an eye on free tier limits
5. **Fine-tune CV**: Calibrate gas detection and train fridge model

---

**Need help?** Open an issue on GitHub or contact support@kitcheneye.com
