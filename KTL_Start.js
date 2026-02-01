//KTL Starter for Next-Gen Knack
//Handles version switching and loads KTL + app files
//Use ?ktl=local URL parameter to switch to local development mode

async function loadKtl(KnackApp) {
    const KTL_VERSION = '0.1.0';

    //Hide page immediately to prevent jitter during keyword processing
    document.documentElement.classList.add('ktlInitializing');

    //Queue events that fire before KTL.js loads
    const queuedPages = [];
    const queuedViews = [];
    window._ktlListenersActive = false;
    Knack.on('page:render', (data) => {
        if (!window._ktlListenersActive) {
            console.log('KTL_Start queued page:', data.pageKey);
            queuedPages.push(data);
        }
    });
    Knack.on('view:render', (data) => {
        if (!window._ktlListenersActive) {
            console.log('KTL_Start queued view:', data.viewKey);
            queuedViews.push(data);
        }
    });

    const appDetails = await Knack.getApplicationDetails();
    const appName = appDetails.name || 'App';
    const appId = appDetails.id || '';
    const lsShortName = appName.substr(0, 6).replace(/ /g, '') + '_' + appId.substr(-4, 4) + '_';

    //Check for ?ktl=local URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const urlKtl = urlParams.get('ktl');

    if (urlKtl) {
        localStorage.setItem(lsShortName + 'ktlCode', urlKtl);
        //Remove parameter from URL
        urlParams.delete('ktl');
        const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '') + window.location.hash;
        window.history.replaceState({}, '', newUrl);
    }

    const isLocal = localStorage.getItem(lsShortName + 'ktlCode') === 'local';

    //Bypass KTL if requested
    if (sessionStorage.getItem(lsShortName + 'bypassKtl') !== null) {
        console.log('KTL bypassed');
        return;
    }

    const baseUrl = isLocal
        ? 'http://localhost:3000/Lib/KTLNG/'
        : 'https://ctrnd.s3.amazonaws.com/Lib/KTLNG/Prod/';

    const cacheBust = isLocal ? '' : '?v=' + Date.now();

    try {
        await Knack.loadCSS(baseUrl + 'KTL.css' + cacheBust);
        await Knack.loadScript(baseUrl + 'KTL.js' + cacheBust);

        if (typeof Ktl === 'function') {
            window.ktl = new Ktl({ lsShortName, queuedPages, queuedViews });

            //Load app-specific file in local mode
            if (isLocal) {
                const appFile = 'http://localhost:3000/KnackApps/' + encodeURIComponent(appName) + '/' + encodeURIComponent(appName) + '.js';
                try {
                    await Knack.loadScript(appFile);
                } catch (e) {
                    console.warn('App file not found:', appFile);
                }

                const appCss = 'http://localhost:3000/KnackApps/' + encodeURIComponent(appName) + '/' + encodeURIComponent(appName) + '.css';
                try {
                    const cssCheck = await fetch(appCss, { method: 'HEAD' });
                    if (cssCheck.ok) await Knack.loadCSS(appCss);
                } catch (e) { }
            }

            //Call KnackApp - check window in case it was loaded dynamically
            const appCallback = KnackApp || window.KnackApp;
            if (typeof appCallback === 'function') {
                appCallback({ ktlVersion: KTL_VERSION, lsShortName });
            }

            console.log('KTL loaded: v' + KTL_VERSION + (isLocal ? ' (local)' : ''));
        } else {
            console.error('KTL failed to load');
        }
    } catch (error) {
        console.error('KTL load error:', error);
    }
}
