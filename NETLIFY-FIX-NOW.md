# Fix animated-platypus 404 — do this exactly

## Why it broke

The uploaded `netlify.toml` said **`publish = "netlify-site"`** inside a folder that *already was* the site. Netlify looked for `netlify-site/netlify-site/index.html` → **404**.

That is fixed in the new `netlify-site/` folder.

---

## Part 1 — Netlify settings (you are on Configuration now)

1. Open **Build & deploy** → **Continuous deployment** → **Build settings** → **Edit settings**
2. Set:
   - **Build command:** leave **empty**
   - **Publish directory:** `netlify-site`
3. **Save**

(If Build command is `bash scripts/...` and the repo is not on GitHub, every deploy fails.)

---

## Part 2 — Upload the site (required)

Configuration alone does not deploy files. You must upload once:

### On your Mac — Terminal

```bash
cd "/Users/siviweetenganii/Code_dev/Networks Meeting "
bash scripts/prepare-netlify-site.sh
```

### On Netlify

1. Go to **Deploys** (top tab — not Configuration)
2. Find **“Drag and drop your site output folder here”**
3. Open Finder → `Code_dev` → `Networks Meeting ` → **`netlify-site`**
4. Drag that **folder** onto Netlify
5. Wait for **Published**

Then open: **https://animated-platypus-c73089.netlify.app/**

---

## Or use the zip (56 KB)

Upload **`Loveworld-Netlify-Upload.zip`** from your project folder on the same Deploys drag-and-drop area.

---

## Check it worked

In **Deploys**, the latest deploy should list files like:

- `index.html`
- `css/main.css`
- `js/app.js`

If it shows **0 files** or only `netlify.toml`, the wrong folder was uploaded.

---

## GitHub still too big?

Push only after removing node_modules from git:

```bash
cd "/Users/siviweetenganii/Code_dev/Networks Meeting "
git rm -r --cached server/node_modules
git add netlify-site .gitignore netlify.toml NETLIFY-FIX-NOW.md
git commit -m "Fix Netlify: prebuilt netlify-site, remove node_modules"
git push
```

Then Netlify can auto-deploy from Git with **Publish directory = `netlify-site`**.
