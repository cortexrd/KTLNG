# KTLNG - Knack Toolkit Library for Next-Gen

A JavaScript library that extends Knack's Next-Gen (React-based) platform with powerful features for building advanced applications.

## Overview

KTLNG is the Next-Gen version of [KTL (Knack Toolkit Library)](https://github.com/cortexrd/Knack-Toolkit-Library), adapted for Knack's new React-based platform. It provides:

- **Keyword System**: Configure views and fields using keywords in the Builder (no code changes needed)
- **CSS-First Approach**: Visual modifications that work with React's virtual DOM
- **Developer Tools**: Debug window, logging, version management

## Status

**Early Development** - Only local development mode works currently. CDN/production deployment not yet available.

## Architecture

KTL uses a two-phase loading pattern:
1. **KTL_Start.js** - Entry point that handles version switching and event queuing
2. **KTL.js** - Main library with all modules
3. **KTL.css** - Styles for popups, utilities, and page hiding during init

The page is hidden during initialization to prevent UI jitter while keywords are processed.

## Quick Start (Local Development)

### 1. Set Up Local Server

Start the local file server on port 3000:

```bash
node C:\code\Lib\KTLNG\NodeJS\NodeJS_FileServer.js
```

### 2. Add the Loader to Your App

In Knack Builder > Settings > API & Code > JavaScript:

```javascript
Knack.ready().then(async () => {
    await Knack.loadScript('http://localhost:3000/Lib/KTLNG/KTL_Start.js');
    loadKtl(typeof KnackApp === 'function' ? KnackApp : null);
});
```

### 3. Enable Local Mode

Use URL parameter: `?ktl=local`

Or in browser console:
```javascript
localStorage.setItem('YourAp_XXXX_ktlCode', 'local');
location.reload();
```
(Replace `YourAp_XXXX_` with your app's storage prefix)

### 4. Create Your App File (Optional)

```javascript
window.APP_VERSION = '1.0.0';

window.KnackApp = function(params) {
    document.addEventListener('ktl:ready', function(e) {
        const ktl = window.ktl;

        // Configure KTL
        ktl.core.setCfg({
            developerNames: ['Your Name'],
            showVersionInfo: true
        });

        // Your app code here
    });
};
```

## Development Mode

Switch modes via URL parameter (easiest):
- `?ktl=local` - Use localhost:3000
- `?ktl=prod` - Use production CDN
- `?ktl=dev` - Use dev version from CDN
- `?ktl=beta` - Use beta version from CDN

The mode is saved to localStorage and persists across sessions.

## Keywords

Keywords are added to view titles or field descriptions in the Knack Builder:

| Keyword | Description | Example |
|---------|-------------|---------|
| `_ar` | Auto-refresh view | `_ar=60` (refresh every 60s) |
| `_hc` | Hide columns | `_hc=field_1,field_2` |
| `_rc` | Remove columns | `_rc=field_3` |
| `_sth` | Sticky table header | `_sth` |

Example view title: `Active Orders _ar=30 _hc=field_45`

## Modules

| Module | Description |
|--------|-------------|
| `ktl.core` | Configuration, utilities, popups |
| `ktl.storage` | localStorage/sessionStorage with app prefix |
| `ktl.views` | View manipulation, auto-refresh |
| `ktl.log` | Console and persistent logging |

## API Reference

### ktl.core

```javascript
ktl.core.setCfg({ developerNames: ['Name'] });
ktl.core.getCfg();
ktl.core.timedPopup('Message', 'info', 3000);
await ktl.core.waitSelector('#element', 10000);
```

### ktl.storage

```javascript
ktl.storage.lsSetItem('key', { data: 'value' });
ktl.storage.lsGetItem('key', defaultValue);
ktl.storage.lsRemoveItem('key');
```

### ktl.views

```javascript
ktl.views.autoRefresh('view_123', 60);  // Refresh every 60s
ktl.views.stopAutoRefresh('view_123');
```

### ktl.log

```javascript
ktl.log.clog('Message', 'blue');        // Colored console log
ktl.log.addLog('INFO', 'User action');  // Persistent log
ktl.log.getLogs();                       // Get all logs
```

## Requirements

- Knack Next-Gen application
- Modern browser (Chrome, Firefox, Edge, Safari)

## License

MIT License - See [LICENSE](LICENSE)

## Author

Normand Defayette - [Cortex R&D Inc.](https://cortexrd.com)

## Related

- [KTL (Classic)](https://github.com/cortexrd/Knack-Toolkit-Library) - Original KTL for Classic Knack
- [KTL Wiki](https://github.com/cortexrd/Knack-Toolkit-Library/wiki) - Full documentation
