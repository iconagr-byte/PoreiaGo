# GitHub — PoreiaGo (ανέβασμα κώδικα)

Λογαριασμός GitHub ✅ → repo → σύνδεση με Cloud Build.

---

## Βήμα 1 — Εγκατάσταση Git (στον PC σου)

Δεν έχεις `git` εγκατεστημένο. Διάλεξε **ένα**:

### Επιλογή Α — GitHub Desktop (πιο εύκολο)

1. [desktop.github.com](https://desktop.github.com) → Download
2. Install → Sign in με GitHub account σου

### Επιλογή Β — Git CLI

1. [git-scm.com/download/win](https://git-scm.com/download/win) → Install (defaults OK)
2. Restart Cursor / PowerShell

---

## Βήμα 2 — Νέο repo στο GitHub

1. [github.com/new](https://github.com/new)
2. **Repository name:** `poreiago`
3. **Private** ✅ (κώδικας επιχείρησης)
4. **Add README:** ❌ OFF
5. **Create repository**

Σημείωσε το URL: `https://github.com/ΤΟ-USERNAME/poreiago.git`

---

## Βήμα 3Α — Με GitHub Desktop

1. **File** → **Add local repository**
2. Folder: `C:\Booking Travel`
3. Αν λέει «not a git repo» → **Create a repository**
4. **Publish repository** → όνομα `poreiago` → **Private** → Publish

---

## Βήμα 3Β — Με Git CLI (PowerShell)

```powershell
cd "C:\Booking Travel"

git init
git add .
git commit -m "Initial commit — PoreiaGo platform"

git branch -M main
git remote add origin https://github.com/ΤΟ-USERNAME/poreiago.git
git push -u origin main
```

(Αντικατέστησε `ΤΟ-USERNAME` — θα σου ζητήσει login GitHub.)

---

## Τι ΔΕΝ ανεβαίνει (ασφάλεια)

Το `.gitignore` μπλοκάρει:
- `.env`, `.env.local` (passwords, API keys)
- `node_modules/`
- `dist/`
- `deploy/gcp/domain-contact.yaml`

---

## Βήμα 4 — Σύνδεση με Google Cloud Build

**Project: `poreiago-prod`** (όχι GNPC CLOUD)

1. [Cloud Build → Repositories](https://console.cloud.google.com/cloud-build/repositories?project=poreiago-prod)
2. **Create host connection** → GitHub → Region `europe-west3`
3. **Authenticate** → Allow
4. **Link repository** → `poreiago`

### Trigger

1. **Triggers** → **Create**
2. Event: Push to branch `^main$`
3. Config: `deploy/gcp/cloudbuild.cheap.yaml`
4. Substitutions:

| Name | Value |
|------|--------|
| `_REGION` | `europe-west3` |
| `_SERVICE` | `poreiago-api` |
| `_AR_REPO` | `poreiago` |
| `_CLOUDSQL_INSTANCE` | `poreiago-prod:europe-west3:poreiago-db` |
| `_VITE_API_BASE` | `https://api.poreiago.com` |

---

## Βήμα 5 — Καθημερινά

```powershell
git add .
git commit -m "περιγραφή αλλαγής"
git push
```

→ Cloud Build τρέχει αυτόματα στο **poreiago-prod**.

---

## Checklist

- [ ] Git ή GitHub Desktop installed
- [ ] Repo `poreiago` created (private)
- [ ] Code pushed to `main`
- [ ] Cloud Build connected (poreiago-prod project)
- [ ] Trigger created

---

## Εναλλακτική χωρίς Git στο PC

1. Zip το folder `Booking Travel` (χωρίς `node_modules`)
2. Cloud Shell → Upload zip → unzip
3. `gh repo create poreiago --private --source=. --push`

(Χρειάζεται `gh auth login` στο Cloud Shell.)
