# Fix Netlify 404 + GitHub “file too large”

## Why you saw “Page not found”

Netlify had **no website files** to publish. Common causes:

1. Uploading the **whole project zip** (with `server/node_modules`) — too big / wrong folder
2. GitHub push **failed** because `node_modules` was committed (~50MB+)
3. Zip had `index.html` **inside a subfolder** instead of at the top level

## Fastest fix — drag & drop (no GitHub)

### Step 1 — Build the small site folder

In Terminal:

```bash
cd "/Users/siviweetenganii/Code_dev/Networks Meeting "
bash scripts/prepare-netlify-site.sh
```

This creates **`netlify-site/`** (~500 KB, not 50 MB).

### Step 2 — Clear wrong Netlify settings (important)

Open: **Site configuration → Build & deploy → Build settings → Edit settings**

| Field | Set to |
|-------|--------|
| **Build command** | *(leave completely empty)* |
| **Publish directory** | *(leave completely empty)* |

Save. (If these say `netlify-site` or a build command, manual uploads will 404.)

### Step 3 — Deploy on Netlify

1. **Deploys** tab (not Configuration)
2. Scroll to **“Need to deploy a new site without connecting to Git? Drag and drop your site output folder here”**
3. Drag the **`netlify-site`** folder (after running the script in Step 1)
4. Wait until the deploy row shows **Published** (green)

Open: https://animated-platypus-c73089.netlify.app/

You should see **Loveworld Networks Live**, not “Page not found”.

### Step 3 — Connect live video (optional)

The page works without this; broadcast needs a public API.

1. Run your broadcast server (see `start-server.sh`) on a VPS or use [ngrok](https://ngrok.com): `ngrok http 3001`
2. Netlify → **Site configuration** → **Environment variables**
3. Add: `BROADCAST_API_URL` = `https://YOUR-NGROK-OR-SERVER-URL` (no trailing slash)
4. **Deploys** → **Trigger deploy** → **Clear cache and deploy**

Rebuild locally with the URL baked in:

```bash
BROADCAST_API_URL=https://your-url.ngrok-free.app bash scripts/prepare-netlify-site.sh
```

Then drag `netlify-site` again.

---

## Fix GitHub (repo too large)

A `.gitignore` was added. Remove `node_modules` from Git tracking:

```bash
cd "/Users/siviweetenganii/Code_dev/Networks Meeting "
git rm -r --cached server/node_modules 2>/dev/null || true
git add .gitignore netlify.toml scripts/ DEPLOY-NETLIFY.md
git commit -m "Fix deploy: ignore node_modules, add Netlify site build"
git push origin main
```

Then in Netlify → **Build settings**:

| Setting | Value |
|---------|--------|
| Base directory | *(empty)* |
| Build command | `bash scripts/prepare-netlify-site.sh` |
| Publish directory | `netlify-site` |

**Clear cache and deploy.**

---

## Do NOT upload

- `server/node_modules/` (47 MB)
- Whole project as one zip
- Only the `server/` folder

## DO upload

- Contents of **`netlify-site/`** (has `index.html` at the top)
