# 2048 RGB — PWA

A fully-featured 2048 game with an RGB neon color scheme, built as a Progressive Web App for Android.

## Features
- 🌈 Full RGB color-coded tiles (each power of 2 has its own neon color)
- 📱 Fullscreen PWA — hides the browser URL/search bar on Android
- 👆 Touch swipe controls (+ keyboard arrow keys on desktop)
- ➕ "Install" button to add directly to your Android home screen
- 💾 Best score saved locally
- ✈️ Works offline (service worker cache)

## Files
```
2048-rgb/
├── index.html      # Main app shell
├── style.css       # Styling & tile color scheme
├── game.js         # Full 2048 game logic
├── sw.js           # Service worker (offline / caching)
├── manifest.json   # PWA manifest (fullscreen, icons, theme)
├── icon.svg        # App icon (SVG, scales to any size)
└── README.md
```

## Deploy to GitHub Pages

1. Create a new GitHub repository (e.g. `2048-rgb`)
2. Upload all files in this folder to the **root** of the `main` branch
3. Go to **Settings → Pages → Source** and select `main` / `root`
4. Your game will be live at:
   ```
   https://<your-username>.github.io/2048-rgb/
   ```

## Installing on Android
1. Open the URL in **Chrome for Android**
2. Tap the **"＋ Install"** button in the game, OR
3. Tap the Chrome menu (⋮) → **"Add to Home screen"**

The app will open fullscreen with no browser UI.

## Icon sizes
The `icon.svg` scales perfectly to any size.
GitHub Pages serves SVG files correctly, so no PNG conversion is needed.
If you want PNG icons for older Android devices, convert `icon.svg` to
`icon-192.png` (192×192) and `icon-512.png` (512×512) using any image editor
or an online tool and place them alongside the other files.

## Tile Color Map
| Value  | Color         |
|--------|---------------|
| 2      | Hot pink      |
| 4      | Orange        |
| 8      | Yellow        |
| 16     | Neon green    |
| 32     | Cyan          |
| 64     | Blue          |
| 128    | Purple        |
| 256    | Red           |
| 512    | Deep orange   |
| 1024   | Emerald       |
| 2048   | Rainbow spin  |
| 4096+  | Animated RGB  |
