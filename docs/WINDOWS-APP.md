# Installing as a Windows app

The platform is a Progressive Web App (PWA). It runs from the same Azure-hosted backend, but can be installed on Windows and gets its own window, Start menu entry, taskbar icon and jump-list shortcuts (My courses, Leaderboard, Kudos). There is no separate desktop build to maintain: every deploy updates the installed app too.

What makes it installable:

| Piece | Where |
| --- | --- |
| Web app manifest (name from `APP_NAME`, icons, shortcuts) | `src/app/manifest.ts` → `/manifest.webmanifest` |
| Service worker (offline page, caches build assets only) | `public/sw.js`, registered in production by `src/components/pwa.tsx` |
| Icons (any + maskable) | `public/icons/`, regenerate with `node scripts/make-icons.mjs` |
| "Install app" item in the avatar menu | Appears when the browser offers installation |

> Installation needs HTTPS (Azure Container Apps provides it) or `localhost`.

## Option 1: people install it themselves (simplest)

In Microsoft Edge or Chrome, open the site and do one of these:

- click the **Install** icon in the address bar,
- or choose **avatar menu → Install app**,
- or use **… → Apps → Install this site as an app**.

Sign-in uses the same Entra SSO. With Edge signed in to a work profile, it is usually silent.

## Option 2: push it to every device with Intune (recommended for companies)

Edge can force-install a PWA through policy, with no packaging needed.

1. Open Intune admin centre → **Devices → Configuration → Create → Windows 10 and later → Settings catalog**.
2. Add **Microsoft Edge → Extensions → Configure list of force-installed Web Apps** (`WebAppInstallForceList`).
3. Set the value (replace the URL):

   ```json
   [
     {
       "url": "https://training.example.com/",
       "default_launch_container": "window",
       "create_desktop_shortcut": true
     }
   ]
   ```

4. Assign it to a device or user group. The app appears in Start after the next policy sync.

The same setting is available as a Group Policy (ADMX) for on-premises management.

## Option 3: MSIX package (Microsoft Store or Intune line-of-business app)

Use this if you need a real Windows package, for example to publish to the Microsoft Store or the company portal.

1. Deploy the site, then go to <https://www.pwabuilder.com> and enter its URL. It reads the manifest and service worker added here.
2. Choose **Package for stores → Windows**. Fill in:
   - **Package ID / Publisher**: from your Partner Center account for the Store, or your code-signing certificate subject (for example `CN=Contoso Ltd`) for line-of-business distribution.
   - **Version**: bump it for each new package. The app content itself updates from the web without repackaging. Only icon, name or URL changes need a new package.
3. Download the zip. It contains an `.msixbundle` plus a test certificate.
4. Distribute it:
   - **Microsoft Store**: upload the bundle in Partner Center (private audience or public).
   - **Intune**: sign the bundle with your organisation's code-signing certificate (`signtool sign /fd SHA256 /a /f cert.pfx /p ... app.msixbundle`), then add it under **Apps → Windows → Line-of-business app**. Devices must trust the signing certificate.
   - **Testing on one machine**: install the included test certificate to *Trusted People*, then double-click the bundle.

The MSIX is a thin wrapper that hosts the site in Edge WebView2. It needs network access to the backend, just like the browser version.

## Notes

- **Updates**: the service worker is served with `no-cache`, so a new deploy is picked up on the next launch.
- **Offline**: pages always load from the server, because progress and scores must be live. Without a connection you get a friendly offline screen. Static assets are cached for faster starts.
- **Branding**: set `APP_NAME` to change the installed app's name. Replace `public/icons/icon.svg` and rerun `node scripts/make-icons.mjs` to change the icon.
