//KTL and App Starter for Next-Gen Knack.
//Supports switching between Prod, Beta, Dev, Local, and numbered versions.

/* ktlVersion:
 *  - 'x.y.z' will use that specific Prod version.
 *  - if empty, will use the latest Prod version from KTL_LATEST_JS_VERSION.
 *  - if 'dev', will use /Prod/KTL-dev.js version (latest experimental code)
 *  - if 'beta', will use /Prod/KTL-beta.js version (candidate for next release)
 *
 * To switch to local mode from browser console (before page loads):
 *   KTL.setLocalMode()     // Enable local mode
 *   KTL.setProdMode()      // Back to production
 *   KTL.setMode('dev')     // Set any mode: 'prod', 'dev', 'beta', 'local', or version number
 */

//Global helper to switch modes BEFORE Knack loads (available immediately)
window.KTL = window.KTL || {
    _getPrefix: async function() {
        //Wait for Knack.ready if needed
        if (typeof Knack !== 'undefined' && Knack.ready) {
            await Knack.ready();
            const appDetails = await Knack.getApplicationDetails();
            const appName = appDetails.name || 'App';
            const appId = appDetails.id || '';
            return appName.substr(0, 6).replace(/ /g, '') + '_' + appId.substr(-4, 4) + '_';
        }
        return null;
    },
    setMode: async function(mode) {
        const prefix = await this._getPrefix();
        if (prefix) {
            if (mode === 'prod' || !mode) {
                localStorage.removeItem(prefix + 'ktlCode');
                console.log('KTL: Switched to PROD mode. Refresh to apply.');
            } else {
                localStorage.setItem(prefix + 'ktlCode', mode);
                console.log(`KTL: Switched to ${mode.toUpperCase()} mode. Refresh to apply.`);
            }
        } else {
            console.error('KTL: Could not determine app prefix. Try after page loads.');
        }
    },
    setLocalMode: function() { return this.setMode('local'); },
    setProdMode: function() { return this.setMode('prod'); },
    setDevMode: function() { return this.setMode('dev'); },
    setBetaMode: function() { return this.setMode('beta'); },
    getMode: async function() {
        const prefix = await this._getPrefix();
        if (prefix) {
            const mode = localStorage.getItem(prefix + 'ktlCode');
            console.log('KTL: Current mode is', mode || 'prod');
            return mode || 'prod';
        }
        return null;
    }
};

Knack.ready().then(async () => {
    const KTL_LATEST_JS_VERSION = '0.1.0';
    const KTL_LATEST_CSS_VERSION = '0.1.0';

    const appDetails = await Knack.getApplicationDetails();
    const appName = appDetails.name || 'App';
    const appId = appDetails.id || '';
    const lsShortName = appName.substr(0, 6).replace(/ /g, '') + '_' + appId.substr(-4, 4) + '_';

    console.log('KTL: Storage prefix is', lsShortName);

    //Check for URL parameter to switch modes: ?ktl=local or ?ktl=dev or ?ktl=prod
    const urlParams = new URLSearchParams(window.location.search);
    const urlKtlMode = urlParams.get('ktl');
    if (urlKtlMode) {
        if (urlKtlMode === 'prod') {
            localStorage.removeItem(lsShortName + 'ktlCode');
            console.log('KTL: Switched to PROD mode via URL parameter');
        } else {
            localStorage.setItem(lsShortName + 'ktlCode', urlKtlMode);
            console.log(`KTL: Switched to ${urlKtlMode.toUpperCase()} mode via URL parameter`);
        }
        //Remove the parameter from URL to avoid re-setting on refresh
        urlParams.delete('ktl');
        const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '') + window.location.hash;
        window.history.replaceState({}, '', newUrl);
    }

    //Used to bypass KTL completely, typically to troubleshoot and isolate an issue.
    const bypassKtl = sessionStorage.getItem(lsShortName + 'bypassKtl') !== null;
    if (bypassKtl) {
        console.log('KTL bypassed');
        return;
    }

    let ktlCode = localStorage.getItem(lsShortName + 'ktlCode');
    let ktlVersion = '';
    let cssVersion = KTL_LATEST_CSS_VERSION;
    let prodFolder = 'Prod/';
    let ktlSvr = 'https://ctrnd.s3.amazonaws.com/'; //CDN - Cortex R&D Inc server
    let fullCode = 'min';

    //Determine version based on localStorage setting
    if (ktlCode === null || ktlCode === 'prod') {
        ktlVersion = KTL_LATEST_JS_VERSION;
    } else if (['dev', 'beta'].includes(ktlCode) || /^\d.*\./.test(ktlCode)) {
        ktlVersion = ktlCode; //Use 'dev', 'beta', or specific version
    }

    if (ktlCode === 'local') {
        ktlVersion = '';
        cssVersion = '';
        prodFolder = '';
        fullCode = 'forcefull';
        ktlSvr = 'http://localhost:3000/';

        //Load app-specific files from local server
        let fileName = localStorage.getItem(lsShortName + 'fileName');
        if (fileName !== 'NO_APP_FILE') {
            !fileName && (fileName = appName);
            const appJsFile = encodeURI(ktlSvr + 'KnackApps/' + fileName + '/' + fileName + '.js');
            const appCssFile = encodeURI(ktlSvr + 'KnackApps/' + fileName + '/' + fileName + '.css');

            //Check if local CSS file exists and load it
            try {
                const cssResponse = await fetch(appCssFile, { method: 'HEAD' });
                if (cssResponse.ok) {
                    //Disable Builder CSS if we're using local file
                    const cssText = document.querySelector('#kn-custom-css');
                    if (cssText) cssText.textContent = '';
                    await Knack.loadCSS(appCssFile);
                }
            } catch (e) {
                console.log('No local CSS file found, using Builder CSS');
            }

            //Load local app JS file
            try {
                await Knack.loadScript(appJsFile);
            } catch (e) {
                console.error('Failed to load local app file:', appJsFile);
                const srcFileName = prompt(
                    `Can't find source file:\n\n${appJsFile}\n\nWhat is file name (without .js)?\n\nLeave empty for none.`,
                    appName
                );
                if (srcFileName === null) {
                    localStorage.removeItem(lsShortName + 'ktlCode');
                    alert('Reverting to Prod mode.');
                    location.reload(true);
                    return;
                } else if (srcFileName !== '') {
                    localStorage.setItem(lsShortName + 'fileName', srcFileName);
                    location.reload(true);
                    return;
                } else {
                    localStorage.setItem(lsShortName + 'fileName', 'NO_APP_FILE');
                }
            }
        }
    }

    if (ktlVersion === 'dev' || ktlVersion === 'beta') {
        fullCode = 'forcefull';
        cssVersion = ktlVersion;
    }

    async function loadFilesAndRunApp() {
        //Cache-busting suffix to force loading new code without Ctrl+F5
        const bypassCacheSuffix = ktlCode !== 'local' ? `?v=${new Date().getTime()}` : '';

        const cssFile = ktlSvr + 'Lib/KTLNG/' + prodFolder +
            (cssVersion ? 'KTL-' + cssVersion : 'KTL') + '.css' + bypassCacheSuffix;

        const ktlFile = ktlSvr + 'Lib/KTLNG/' + prodFolder +
            (ktlVersion ? 'KTL-' + ktlVersion : 'KTL') +
            (fullCode === 'forcefull' ? '' : '.min') + '.js' + bypassCacheSuffix;

        try {
            await Knack.loadCSS(cssFile);
            await Knack.loadScript(ktlFile);

            if (typeof Ktl === 'function') {
                //Instantiate KTL - this runs init() and parses keywords
                window.ktl = new Ktl({ lsShortName: lsShortName });

                if (typeof window?.KnackApp === 'function') {
                    window.KnackApp({ ktlVersion: ktlVersion || KTL_LATEST_JS_VERSION, lsShortName: lsShortName });
                } else {
                    console.warn('KnackApp function not found. KTL loaded without app configuration.');
                }

                console.log('KTL loaded: v' + (ktlVersion || KTL_LATEST_JS_VERSION));
            } else {
                if (ktlCode === 'local') {
                    console.error('KTL not found at:', ktlFile);
                } else {
                    //Version doesn't exist - retry with latest prod version
                    console.warn('KTL version not found, retrying with latest...');
                    ktlVersion = KTL_LATEST_JS_VERSION;
                    await loadFilesAndRunApp();
                }
            }
        } catch (error) {
            console.error('Failed to load KTL:', error);
        }
    }

    await loadFilesAndRunApp();
});
