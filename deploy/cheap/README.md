# Φθηνό deploy — poreiago.com (~5–25€/μήνα)

Το πλήρες GCP cloud-native κοστίζει ~100–150€/μήνα.  
Για **ξεκίνημα / staging / λίγους οδηγούς** αρκούν οι επιλογές παρακάτω.

Το domain **`poreiago.com`** (Google Cloud DNS) **μένει όπως είναι** — απλά αλλάζεις τα A records.

---

## Σύγκριση

| Επιλογή | ~€/μήνα | Δυσκολία | Driver GPS / WebSocket |
|---------|---------|----------|------------------------|
| **A — Hetzner VPS** ⭐ | **5–7** | Μέτρια | ✅ Καλά |
| **B — GCP minimal** | **15–30** | Υψηλή | ⚠️ Cold start αν scale-to-zero |
| C — GCP full (παλιά πρόταση) | 100–150 | Υψηλή | ✅ |

**Πρόταση:** Ξεκίνα με **Hetzner** — ίδιο app, 10× φθηνότερα.

---

# Επιλογή A — Hetzner VPS (προτείνεται)

### Κόστος
| | |
|--|--|
| Hetzner CX22 (2 vCPU, 4GB) | **~4.15€/μήνα** |
| Domain poreiago.com | ~1€/μήνα (ήδη πληρωμένο) |
| **Σύνολο** | **~5€/μήνα** |

### 1. VPS
1. [hetzner.com/cloud](https://www.hetzner.com/cloud) → λογαριασμός
2. **Create Server** → Location **Falkenstein** ή **Helsinki**
3. **Ubuntu 24.04**, type **CX22**
4. SSH key → Create
5. Σημείωσε την **IPv4** (π.χ. `95.xxx.xxx.xxx`)

### 2. DNS (Cloud DNS — ήδη έχεις)
[Cloud DNS](https://console.cloud.google.com/net-dns/zones) → zone `poreiago.com`:

| Name | Type | Value |
|------|------|-------|
| `api` | A | IP του Hetzner |
| `www` | A | IP του Hetzner |
| `@` (apex) | A | IP του Hetzner |

(Ή μόνο `api` + `www` αν θες apex redirect αργότερα.)

### 3. Server setup (SSH)

```bash
ssh root@95.xxx.xxx.xxx

apt update && apt upgrade -y
apt install -y docker.io docker-compose-plugin git
systemctl enable docker

git clone https://github.com/USER/booking-travel.git /opt/poreiago
cd /opt/poreiago
```

### 4. Env αρχείο

```bash
cp deploy/.env.prod.example deploy/.env.prod
nano deploy/.env.prod
```

Βασικά:
```env
API_HOST=api.poreiago.com
APP_HOST=www.poreiago.com
PUBLIC_APP_URL=https://www.poreiago.com
DATABASE_URL=postgresql+asyncpg://app_user:STRONG_PASS@postgres:5432/aerostride
POSTGRES_USER=app_user
POSTGRES_PASSWORD=STRONG_PASS
POSTGRES_DB=aerostride
TICKET_JWT_SECRET=τουλάχιστον-32-χαρακτήρες
AUTH_JWT_SECRET=άλλο-32chars-secret
REDIS_URL=redis://redis:6379/0
```

### 5. Build frontend + start

```bash
# Στον server ή τοπικά και scp dist/
cd /opt/poreiago
npm ci && VITE_API_BASE=https://api.poreiago.com npm run build

docker compose --env-file deploy/.env.prod \
  -f deploy/docker-compose.prod.yml \
  --profile bundled-db \
  up -d
```

Traefik βγάζει **Let's Encrypt SSL** αυτόματα για `api.` και `www.`

### 6. GitHub auto-deploy (φθηνό CI)

Χρησιμοποίησε SSH deploy — **δωρεάν** στο GitHub Actions.

Secrets στο repo (Settings → Secrets):
- `SSH_HOST` = IP Hetzner
- `SSH_USER` = root
- `SSH_PRIVATE_KEY` = το private key σου

Workflow: `.github/workflows/deploy-vps.yml` (δες παρακάτω)

Κάθε `git push main` → tests → SSH → pull → rebuild → restart.

---

# Επιλογή B — GCP minimal (~15–30€)

Αν θες **μόνο Google**, μείωσε κόστος:

| Αλλαγή | Εξοικονόμηση |
|--------|--------------|
| Cloud Run `min-instances=0` | -25€+ (cold start στο GPS) |
| Cloud SQL **db-f1-micro** | -30€ |
| **Upstash Redis** free αντί Memorystore | -25€ |
| Firebase Hosting free | ήδη φθηνό |

```bash
# Μην τρέξεις setup-infrastructure.sh (Memorystore + μεγάλο SQL)
# Χρησιμοποίησε deploy/gcp/cloudbuild.cheap.yaml
```

Env:
```env
REDIS_URL=rediss://default:xxx@xxx.upstash.io:6379
DATABASE_URL=...  # Cloud SQL db-f1-micro
```

⚠️ **Driver GPS:** με `min-instances=0` το Cloud Run «κοιμάται» — πρώτο ping καθυστερεί 10–30 sec.

---

# Τι κρατάς από poreiago.com

- Domain + Cloud DNS στο Google ✅
- Μόνο αλλάζεις **A records** → IP server (Hetzner) ή Cloud Run (GCP)

---

# Checklist Hetzner (γρήγορο)

- [ ] Hetzner CX22 server
- [ ] Cloud DNS: `api`, `www` → IP
- [ ] `deploy/.env.prod` με secrets
- [ ] `npm run build` με `VITE_API_BASE=https://api.poreiago.com`
- [ ] `docker compose up -d`
- [ ] `https://api.poreiago.com/health`
- [ ] `https://www.poreiago.com/driver`
- [ ] GitHub secrets → auto deploy

---

# Σχετικά αρχεία

- `deploy/docker-compose.prod.yml` — VPS stack
- `deploy/gcp/domain-poreiago.com.md` — DNS URLs
- `.github/workflows/deploy-vps.yml` — φθηνό auto-deploy
