# Ashwin Rajakrishna — Portfolio

A clean, dark-themed personal portfolio with an admin panel for live editing.

---

## File Structure

```
portfolio/
├── index.html          ← Main HTML (open this in a browser)
├── serve.py            ← Python local server (optional, for live preview)
├── css/
│   └── style.css       ← All styles
├── js/
│   └── app.js          ← All JavaScript / app logic
└── data/
    └── portfolio.json  ← Your content (edit this to update everything)
```

---

## Quick Start

### Option A — Just double-click
Open `index.html` directly in your browser.  
> Note: Some browsers block local JSON fetch. Use Option B if content doesn't load.

### Option B — Python server (recommended)
```bash
python3 serve.py
```
Then visit: **http://localhost:8080**

---

## Admin Panel

Click **Admin** in the top-right navigation.

| Field | Value |
|-------|-------|
| Username | `admin.AshwinRajakrishna` |
| Password | `temp` ← change this! |

### What you can do as admin:
- **Skills** — Add new skills or remove existing ones
- **Projects** — Add / remove project cards
- **Resume** — Paste a Google Drive or direct download URL for your resume

> **To change your password:** Edit `data/portfolio.json` and update the `"password"` field under `"admin"`.

---

## Editing Content

All your personal content lives in **`data/portfolio.json`**. Open it in any text editor to update:

- `profile` — name, title, email, phone, LinkedIn URL, resume URL, about paragraphs
- `education` — your degrees
- `experience` — work history and bullet points
- `skills` — list of skill strings
- `projects` — project cards
- `admin` — login credentials

---

## Deploying Online (Free)

### Netlify (easiest)
1. Go to [netlify.com/drop](https://netlify.com/drop)
2. Drag the entire `portfolio/` folder onto the page
3. Done — you'll get a live URL instantly

### GitHub Pages
1. Push the `portfolio/` folder to a GitHub repo
2. Go to Settings → Pages → set source to `main` branch / root
3. Your site will be live at `https://yourusername.github.io/repo-name`

---

## Customisation Tips

- **Photo**: Replace the `AR` initials in `.about-avatar` with an `<img>` tag pointing to your photo
- **Accent colour**: Change `--accent: #c8a96e` in `css/style.css` to any colour you like
- **Fonts**: Swap `Playfair Display` / `DM Sans` in the Google Fonts import and CSS variables
