# 2 κλικ — ολοκλήρωση deploy

Έχω ήδη ετοιμάσει τα αρχεία τοπικά. Μένουν **μόνο 2 πράγματα από εσένα** (δεν μπορώ να τα κάνω χωρίς login σου).

---

## Κλικ 1 — Push (GitHub Desktop)

1. Άνοιξε **GitHub Desktop**
2. Repo: **PoreiaGo** (όχι το nested «Booking Travel»)
3. Θα δεις **«2 ↑»** (2 commits προς push)
4. Πάτα **Push origin**

Αν ρωτήσει login → συνδέσου με τον λογαριασμό **iconagr-byte**.

Έλεγχος: https://github.com/iconagr-byte/PoreiaGo → πρέπει `cloudbuild.yaml`, `backend/`, `deploy/gcp/`

---

## Κλικ 2 — Cloud Build trigger

**Console** → project **poreiago** → **Cloud Build** → **Triggers** → **deploy-main** → **Edit**

| Πεδίο | Τιμή |
|--------|------|
| Repository | `iconagr-byte/PoreiaGo` |
| Branch | `^main$` |
| Configuration file | `cloudbuild.yaml` |

**Substitution variables** (αν λείπουν):

| Name | Value |
|------|--------|
| `_REGION` | `europe-west3` |
| `_SERVICE` | `poreiago-api` |
| `_AR_REPO` | `poreiago` |
| `_CLOUDSQL_INSTANCE` | `poreiago:europe-west3:poreiago-db` |
| `_VITE_API_BASE` | `https://api.poreiago.com` |
| `_DEPLOY_FRONTEND` | `false` |

**Save** → **RUN** → branch `main`

---

## Αν το trigger δείχνει `PoreiaGo-Project`

Άλλαξέ το σε **`PoreiaGo`** — αυτό είναι το σωστό repo.

---

## Εναλλακτικά — Cloud Shell (copy-paste)

```bash
gcloud config set project poreiago
bash deploy/gcp/fix-trigger.sh
```

(Μετά το push, ώστε να υπάρχει το `fix-trigger.sh` στο repo — ή τρέξε τα gcloud commands από το script χειροκίνητα.)

---

## Τι έκανα ήδη εγώ

- ✅ `cloudbuild.yaml` στη ρίζα του PoreiaGo
- ✅ Αγνόηση λάθος φακέλου `Booking Travel/` στο `.gitignore`
- ✅ Commit τοπικά (2 commits έτοιμα για push)

**Μην** κάνεις commit στο φάκελο «Booking Travel» — είναι λάθος nested copy.
