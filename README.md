# 🩺 Med Runner — Complete Beginner Guide
## Setup · GitHub · Vercel Deployment

---

## PART 1 — PROJECT FOLDER STRUCTURE

```
medrunner/
├── index.html       ← Game UI & structure
├── style.css        ← All visual styling & animations
├── game.js          ← All game logic
├── assets/          ← Put your images & sounds here
│   ├── friend_normal.png   (optional: running sprite)
│   ├── friend_hit.png      (optional: hit sprite)
│   ├── start.wav           (optional: start sound)
│   ├── catch.wav           (optional: collect sound)
│   ├── hit.wav             (optional: hit sound)
│   └── gameover.wav        (optional: game over sound)
└── README.md        (optional: description for GitHub)
```

> **Note:** The game works perfectly WITHOUT the assets/ files.
> The character uses an emoji (🧑‍⚕️) as a fallback.
> Add your own images and sounds whenever you're ready!

---

## PART 2 — ENVIRONMENT SETUP

### Step 1 — Install VS Code
1. Go to **https://code.visualstudio.com**
2. Click **Download** → choose your OS (Windows / Mac / Linux)
3. Run the installer, follow the prompts

### Step 2 — Install the Live Server extension
1. Open VS Code
2. Click the **Extensions icon** on the left sidebar (looks like 4 squares)
3. Search: `Live Server`
4. Click **Install** on the one by Ritwick Dey

### Step 3 — Open your project folder
1. Open VS Code
2. Go to **File → Open Folder**
3. Select your `medrunner/` folder
4. You should see all the files in the left panel

### Step 4 — Run the game locally
1. Right-click on `index.html` in the file explorer
2. Select **"Open with Live Server"**
3. Your browser opens automatically → the game is running! 🎉

> Any time you save a file (`Ctrl+S`), the browser auto-refreshes.

---

## PART 3 — GITHUB VERSION CONTROL

### Step 1 — Install Git
- **Windows:** https://git-scm.com/download/win (run installer, all defaults are fine)
- **Mac:** Open Terminal → type `git --version` → if not installed, it prompts you
- **Linux:** `sudo apt install git`

Verify installation:
```bash
git --version
# Should print: git version 2.x.x
```

### Step 2 — Configure Git (one-time setup)
Open Terminal (or Git Bash on Windows):
```bash
git config --global user.name "Your Name"
git config --global user.email "your@email.com"
```

### Step 3 — Initialize a local repository
In Terminal, navigate to your project folder:
```bash
cd path/to/medrunner
# Example on Windows: cd C:\Users\YourName\Documents\medrunner
# Example on Mac:     cd ~/Documents/medrunner

git init
# Output: Initialized empty Git repository in .../medrunner/.git/
```

### Step 4 — Create a .gitignore file
Create a file called `.gitignore` in your project root with this content:
```
.DS_Store
Thumbs.db
*.log
node_modules/
```
This prevents junk files from being uploaded.

### Step 5 — Stage and commit your files
```bash
git add .
git commit -m "Initial commit: Med Runner game"
```

### Step 6 — Create a repository on GitHub
1. Go to **https://github.com** and sign in (create a free account if needed)
2. Click the **+** icon (top right) → **New repository**
3. Name it: `med-runner`
4. Choose **Public** (required for free Vercel deployment)
5. ❌ Do NOT check "Add a README file" (you already have files)
6. Click **Create repository**

### Step 7 — Push your code to GitHub
GitHub shows you the exact commands. They look like this:
```bash
git remote add origin https://github.com/YOURUSERNAME/med-runner.git
git branch -M main
git push -u origin main
```

Replace `YOURUSERNAME` with your actual GitHub username.

✅ Refresh GitHub — your files should now appear online!

### Step 8 — Future updates (the daily workflow)
Every time you make changes:
```bash
git add .
git commit -m "Describe what you changed"
git push
```
Vercel will automatically redeploy when you push! 🚀

---

## PART 4 — VERCEL DEPLOYMENT (Free Hosting)

### Why Vercel? Why is it free?
Your game is a **static site**: pure HTML, CSS, and JavaScript.
- No server needed — the browser runs everything
- No database — localStorage handles scores
- No backend — zero compute costs for Vercel

The Vercel Hobby (free) tier includes:
- ✅ Unlimited static deployments
- ✅ Custom domain support
- ✅ HTTPS automatically
- ✅ Global CDN (fast worldwide)
- ✅ 100GB bandwidth/month (you'll never hit this)

### Step 1 — Sign up for Vercel
1. Go to **https://vercel.com**
2. Click **Sign Up**
3. Choose **"Continue with GitHub"** — this links your accounts automatically

### Step 2 — Import your project
1. On the Vercel dashboard, click **"Add New… → Project"**
2. Find your `med-runner` repository in the list
3. Click **Import**

### Step 3 — Configure the deployment
The settings screen will appear. For a static HTML site:
- **Framework Preset:** `Other` (or leave as "Other")
- **Root Directory:** `./` (leave default)
- **Build Command:** leave **empty** ← important! No build needed.
- **Output Directory:** leave **empty** ← Vercel serves your files directly

Click **Deploy**

### Step 4 — Done! 🎉
In about 30 seconds, Vercel shows:
```
🎉 Congratulations! Your project has been successfully deployed.
```
You get a URL like: `https://med-runner-abc123.vercel.app`

Share this link with your friend! It works on desktop and mobile.

### Step 5 — (Optional) Custom domain
1. In Vercel dashboard → your project → **Settings → Domains**
2. Add any domain you own
3. Vercel handles HTTPS automatically

---

## PART 5 — ADDING CUSTOM ASSETS (Optional)

### Character Sprites
Replace the emoji fallback with real images:
1. Put `friend_normal.png` and `friend_hit.png` in the `assets/` folder
2. In `game.js`, when the image loads, add the `has-image` class:

```javascript
// Add this after your image loads successfully
const img = new Image();
img.onload = () => { $playerSprite.classList.add('has-image'); };
img.src = 'assets/friend_normal.png';
$playerSprite.style.backgroundImage = "url('assets/friend_normal.png')";
```

### Sound Effects
Drop `.wav` or `.mp3` files into `assets/` matching these names:
- `start.wav` — plays when game begins
- `catch.wav` — plays when collecting items
- `hit.wav` — plays when hitting an obstacle
- `gameover.wav` — plays on game over

The game already loads these — just add the files!

### Recommended free sound sources
- **Freesound.org** — huge library, free with attribution
- **Mixkit.co** — free game sounds, no attribution needed
- **ZapSplat.com** — free with free account

---

## PART 6 — GAME CONTROLS SUMMARY

| Action | Desktop | Mobile |
|--------|---------|--------|
| Jump | `Space` or `↑` | ▲ JUMP button |
| Duck | `↓` (hold) | ▼ DUCK button (hold) |
| Start / Restart | `Space` or `Enter` | Tap START button |

---

## PART 7 — CUSTOMIZING THE GAME

All game settings are in the `CONFIG` object at the top of `game.js`:

```javascript
const CONFIG = {
  GRAVITY:        0.55,    // Higher = falls faster
  JUMP_FORCE:     -13.5,   // More negative = jumps higher
  BASE_SPEED:     4.5,     // Starting scroll speed
  MAX_SPEED:      14,      // Fastest the game gets
  MAX_LIVES:      3,       // Starting lives
  BOOST_DURATION_MS: 4000, // How long coffee boost lasts (ms)
  // ...
};
```

To add new obstacles or collectibles, add entries to the `ELEMENTS` array:
```javascript
{ id:'myitem', emoji:'🫁', type:'collectible', zone:'sky', label:'Lungs', points:3 },
```

---

## TROUBLESHOOTING

**Q: The game doesn't start when I open index.html directly**
A: You need Live Server (VS Code) or a local server. Double-clicking the HTML file
   won't work for some browsers due to security restrictions.

**Q: Sounds don't play**
A: Browsers block audio until the user interacts with the page. The sounds will work
   after the first click/tap. Make sure the files exist in assets/.

**Q: The character looks too big/small on mobile**
A: The game is responsive. Try rotating your phone to landscape mode for a better fit.

**Q: High score resets**
A: High score is saved in localStorage. Clearing browser data will reset it.
   For permanent saving, you'd need a backend (beyond this project's scope).
