# Mobile App Path (PWA + TestFlight-Style Distribution)

This project now supports a PWA-style install path for phones and a wrapper path for TestFlight distribution.

## 1) Fast path: Home Screen PWA install

### iPhone (Safari)
1. Open the site URL.
2. Tap Share.
3. Tap Add to Home Screen.
4. Launch from the new app icon.

### Android (Chrome)
1. Open the site URL.
2. Tap menu.
3. Tap Install app or Add to Home screen.

What is now configured:
- Web app manifest (`public/manifest.webmanifest`)
- iOS touch icon (`public/apple-touch-icon.png`)
- Service worker registration (`public/sw.js`, wired in layout)
- Offline fallback page (`public/offline.html`) with cached shell behavior
- Apple web app metadata in Next layout

## 2) TestFlight-style distribution (native shell wrapper)

For true TestFlight distribution, package the website in a native iOS shell.

Recommended approach: Capacitor wrapper around the static web build.

### High-level flow
1. Build web app (`pnpm build`).
2. Export static output (`out/`).
3. Initialize Capacitor iOS wrapper.
4. Open in Xcode and archive.
5. Upload build to App Store Connect.
6. Add internal/external testers in TestFlight.

### Notes
- This keeps your web code as the product surface while enabling native distribution.
- Native capabilities (push, camera permissions, background tasks) can be added incrementally via Capacitor plugins.
- For local development before packaging, keep using LAN dev URL on phone.

## 3) Suggested release sequence
1. Stabilize mobile UX on LAN.
2. Add splash/icon asset pack (1024, 512, 192, 180).
3. Wrap with Capacitor.
4. Run TestFlight internal beta.
5. Iterate from tester feedback.
