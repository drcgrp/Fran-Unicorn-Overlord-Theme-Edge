# Fran, Sky Blue

A theme dedicated to Fran from Unicorn Overlord, with translucent-style tabs, a light blue toolbar, and support for 4K displays.

Fran and the landscape extend across the browser header. The open area beside the tabs keeps the original artwork, while the tabs and toolbar use a blue wash for readability. The wash strengthens behind the bookmarks bar. The new-tab wallpaper shows Fran riding a griffon through a forest.

## Install in Microsoft Edge

1. Download `fran-sky-blue.zip` from the [latest release](https://github.com/drcgrp/Fran-Unicorn-Overlord-Theme-Edge/releases/latest).
2. Extract it into a folder you will keep on your computer.
3. Open `edge://extensions` and turn on **Developer mode**.
4. Choose **Load unpacked** and select the extracted folder containing `manifest.json`.

You can also load the `theme/` folder from this repository directly. After replacing files with a newer release, reload the theme on the extensions page or load the folder again.

This is a native static theme. The installed package contains only a manifest and six images: no executable scripts, requested permissions, website access, or data collection. Microsoft Edge Add-ons rejected the theme manifest, so this repository distributes it for local installation.

## Supported layout and limits

- The artwork is tuned for Edge's horizontal tabs on Windows, using the 150% display-scaling setup it was developed with. Other scaling settings and browser layouts may align differently. Chrome is not a supported target.
- Header images are 4095 pixels wide and stay anchored on the left. Browser theme images have a fixed size; Edge may repeat the header beyond that width.
- The wallpaper is exported at 2560 × 1440 from a 3840 × 2160 source. Display support does not mean every packaged image is native 4K.
- The theme supplies a new-tab background, but Edge's new-tab settings can override it. Search-box position and other new-tab widgets are controlled by Edge.
- The translucent appearance is baked into the images. A theme cannot add live blur, custom tab borders or shadows, change native fonts or tab heights, or style websites.

## Build and package

Use Node.js 22 or newer:

```sh
npm ci
npm run build
npm run validate
npm run package
```

`assets/header.png` and `assets/wallpaper.jpg` are the source artwork. The build produces the six images in `theme/images/`; the manifest is maintained in `theme/manifest.json`.

Validation checks the package allowlist, manifest, image dimensions, and PNG metadata. Packaging writes `dist/fran-sky-blue.zip` and its SHA-256 checksum. The ZIP contains only the seven installable theme files, with fixed archive timestamps and no build tools or source artwork.

## Releases

Release tags and titles use the source commit's short hash. The numeric version in the theme manifest is kept separately because browser manifests require a numeric version. It does not need to change for documentation or packaging-only commits.

This is an unofficial fan theme based on Fran from Unicorn Overlord. No blanket license to the character or artwork is granted by this repository.
