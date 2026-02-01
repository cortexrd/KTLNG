/**
 * Knack Toolkit Library (KTL) - Next-Gen Javascript
 * For Knack's Next-Gen React-based platform.
 * See documentation: https://github.com/cortexrd/Knack-Toolkit-Library
 *
 * @author  Normand Defayette <nd@ctrnd.com>
 * @license MIT
 * 2025
 */

const IFRAME_WND_ID = 'iFrameWnd';
window.IFRAME_WND_ID = IFRAME_WND_ID;

const TEN_SECONDS_DELAY = 10000;
const ONE_MINUTE_DELAY = 60000;
const FIVE_MINUTES_DELAY = ONE_MINUTE_DELAY * 5;
const ONE_HOUR_DELAY = ONE_MINUTE_DELAY * 60;
const SUMMARY_WAIT_TIMEOUT = 10000;
const KNACK_RECORD_LENGTH = 24;
const NO_RESULTS = 'No results';

function Ktl(appInfo) {
    if (window.ktl)
        return window.ktl;

    //Use queued events from KTL_Start.js (captured before KTL.js loaded)
    let keywordsReady = false;
    let pageRevealed = false;
    let revealTimer = null;
    const REVEAL_DEBOUNCE_MS = 200;
    const pendingPages = appInfo.queuedPages || [];
    const pendingViews = appInfo.queuedViews || [];

    //Register listeners for events during/after init (disable KTL_Start.js listeners)
    window._ktlListenersActive = true;

    Knack.on('page:render', (data) => {
        if (keywordsReady) {
            ktl.log.clog(`Page rendered: ${data.pageKey}`, 'blue');
        } else {
            pendingPages.push(data);
        }
    });

    Knack.on('view:render', (data) => {
        if (keywordsReady) {
            ktl.log.clog(`View rendered: ${data.viewKey}`, 'blue');
            processViewKeywords(data.viewKey);
            scheduleReveal();
        } else {
            pendingViews.push(data);
        }
    });

    const KTL_VERSION = '0.1.0';
    const APP_KTL_VERSIONS = (window.APP_VERSION || '0.0.0') + ' - ' + KTL_VERSION;
    window.APP_KTL_VERSIONS = APP_KTL_VERSIONS;

    const APP_ROOT_NAME = appInfo.lsShortName;
    window.APP_ROOT_NAME = APP_ROOT_NAME;

    const LOCAL_SERVER_PORT = '3000';

    var ktl = this;

    const TEXT_DATA_TYPES = ['address', 'date_time', 'email', 'link', 'name', 'number', 'paragraph_text', 'phone', 'short_text', 'currency', 'timer'];

    //========================================
    // KEYWORD PARSER (Adapted for Next-Gen)
    //========================================

    const ktlKeywords = {};
    window.ktlKeywords = ktlKeywords;

    const ESCAPED_UNDERSCORE_PLACEHOLDER = '\uFFFEKTLESC\uFFFE';

    function escapeDoubleUnderscores(text = '') {
        return text.replace(/(^|\s|>)__/gm, '$1' + ESCAPED_UNDERSCORE_PLACEHOLDER);
    }

    function unescapeDoubleUnderscores(text = '') {
        return text.replace(new RegExp(ESCAPED_UNDERSCORE_PLACEHOLDER, 'g'), '_');
    }

    function getKeywordsStartIndex(text = '') {
        return text.toLowerCase().search(/(?:^|\s|>)(_[a-zA-Z0-9]\w*)/m);
    }

    function cleanUpKeywords(text = '') {
        const escaped = escapeDoubleUnderscores(text);
        const firstKeywordIndex = getKeywordsStartIndex(escaped);
        if (firstKeywordIndex >= 0) {
            return unescapeDoubleUnderscores(escaped.substring(0, firstKeywordIndex).trim());
        }
        return unescapeDoubleUnderscores(escaped);
    }

    function getKeywords(text = '') {
        const escaped = escapeDoubleUnderscores(text);
        const firstKeywordIndex = getKeywordsStartIndex(escaped);
        if (firstKeywordIndex >= 0) {
            return extractKeywords(escaped.substring(firstKeywordIndex).trim());
        }
        return {};
    }

    function getKeywordsFromContent(content = '') {
        const escaped = escapeDoubleUnderscores(content);
        const firstKeywordIndex = getKeywordsStartIndex(escaped);

        if (firstKeywordIndex >= 0) {
            let keywordsToParse = escaped.substring(firstKeywordIndex).trim();
            keywordsToParse = keywordsToParse.replace(/<\/?p>|<br\s*\/?>/gi, ' ').trim();

            //Decode HTML entities to plain text (vanilla JS replacement for jQuery)
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = keywordsToParse;
            keywordsToParse = tempDiv.textContent || tempDiv.innerText || '';

            return extractKeywords(keywordsToParse);
        }
        return {};
    }

    function isEmptyObject(obj) {
        return obj && Object.keys(obj).length === 0 && obj.constructor === Object;
    }

    function extractKeywords(strToParse = '', keywords = {}) {
        const cleanedStr = strToParse.replace(new RegExp('(^|\\s|>)' + ESCAPED_UNDERSCORE_PLACEHOLDER + '\\w*(?:=(?:(?!\\s_[a-zA-Z]).)*)?', 'gm'), '$1');
        const strSplit = cleanedStr.split(/(?:^|\s|>)(_[a-zA-Z0-9_]{2,})/gm);
        strSplit.splice(0, 1);

        for (let i = 0; i < strSplit.length; i++) {
            strSplit[i] = strSplit[i].trim().replace(/\u200B/g, '');
            if (strSplit[i].length >= 2 && strSplit[i].startsWith('_') && strSplit[i][1] !== '_') {
                const key = strSplit[i].toLowerCase();
                if (!keywords[key])
                    keywords[key] = [];

                if (i <= strSplit.length && strSplit[i + 1] && strSplit[i + 1].trim().startsWith('=')) {
                    const paramsStr = parseParameters(strSplit[i + 1].trim().slice(1).trim());
                    keywords[key].push(paramsStr);
                }
            }
        }
        return keywords;
    }

    function parseParameters(keywordString = '') {
        let paramStr = keywordString.replace(/(\/a>)[\s\S]*/, '$1');
        let params = [];
        let options = {};

        if (!paramStr.startsWith('['))
            paramStr = '[' + paramStr + ']';

        const paramGroups = parseKeywordParamGroups(paramStr) || [];
        extractParamsAndOptions(paramGroups, params, options);

        const parameters = { params: params };

        if (paramStr)
            parameters.paramStr = paramStr;

        if (!isEmptyObject(options))
            parameters.options = options;

        return parameters;
    }

    function parseKeywordParamGroups(kwGroups = '') {
        const cleanedStr = kwGroups.trim().replace(/\s*\[\s*/g, '[').replace(/\s*\]\s*/g, ']');
        const elements = cleanedStr.split('],[');

        return elements.map(element => {
            if (!element.includes('ktlTarget') && !/\$\(['"`]/.test(element)) {
                return element.replace('[', '').replace(']', '');
            }

            let insideDollarBrackets = false;
            let result = [];
            let startingQuote = null;

            for (let i = 0; i < element.length; i++) {
                const char = element[i];

                if (char === '$' && element[i + 1] === '(' && (element[i + 2] === '"' || element[i + 2] === "'" || element[i + 2] === '`')) {
                    insideDollarBrackets = true;
                    startingQuote = element[i + 2];
                }

                if (insideDollarBrackets && char === ')' && element[i - 1] === startingQuote) {
                    insideDollarBrackets = false;
                    startingQuote = null;
                }

                if ((char === '[' || char === ']') && !insideDollarBrackets) {
                    continue;
                }

                result.push(char);
            }

            return result.join('');
        });
    }

    function extractParamsAndOptions(paramGroups = [], params = [], options = {}) {
        paramGroups.forEach(group => {
            const firstParam = group.split(',')[0].trim();
            if (['ktlRoles', 'ktlRefVal', 'ktlTarget', 'ktlCond', 'ktlMsg'].includes(firstParam)) {
                const pattern = /[^,]*,\s*(.*)/;
                const groupParams = group.match(pattern);
                if (groupParams && groupParams.length >= 2)
                    options[firstParam] = groupParams[1].trim();
                else
                    console.error(`Error parsing keywords: Empty Parameter Configuration [${group}]`);
            } else {
                params.push(group.split(',').map(param => param.trim()));
            }
        });
    }

    const numericFieldTypes = ['number', 'currency', 'sum', 'min', 'max', 'average', 'equation', 'rating'];

    //========================================
    // KEYWORD PARSER INITIALIZATION
    //========================================

    async function initKeywordParser() {
        try {
            const pages = await Knack.getPages();

            for (const page of pages) {
                const views = await Knack.getViews(page.key);
                for (const view of views) {
                    extractKeywordsFromView(page, view);
                }
            }

            //Add field keywords
            const tables = await Knack.getTables();
            for (const table of tables) {
                const fields = await Knack.getFields(table.key);
                for (const field of fields) {
                    if (field.meta && field.meta.description) {
                        let fieldDesc = field.meta.description.replace(/(\r\n|\n|\r)|<[^>]*>/gm, ' ').replace(/ {2,}/g, ' ').trim();
                        const fieldKwObj = extractKeywords(fieldDesc);
                        if (!isEmptyObject(fieldKwObj))
                            ktlKeywords[field.key] = fieldKwObj;
                    }
                }
            }

            console.log('KTL keywords parsed:', Object.keys(ktlKeywords).length, 'entries');
        } catch (error) {
            console.error('KTL keyword parser error:', error);
        }
    }

    function extractKeywordsFromView(page, view) {
        const viewKwObj = {};

        if (view.type === 'rich_text') {
            const content = (view.content || '').replace(/<p>_(?!_)/g, ' _');
            const viewKeywords = getKeywordsFromContent(content);
            Object.assign(viewKwObj, viewKeywords);
        } else {
            const viewKeywords = getKeywords(view.title || '');
            let descriptionKeywords;
            if (view.description) {
                descriptionKeywords = getKeywords(view.description.replace(/<br \/>_/g, '_').replace(/<br \/>\n/g, '\n'));
            }
            Object.assign(viewKwObj, viewKeywords, descriptionKeywords);
        }

        //Log warning for low auto-refresh intervals
        if (viewKwObj._ar && viewKwObj._ar.length && viewKwObj._ar[0].params[0] && viewKwObj._ar[0].params[0].length) {
            let intervalDelay = parseInt(viewKwObj._ar[0].params[0]);
            if (intervalDelay < 5 /*TODO Put back to 60*/) {
                console.log(`KTL Warning: Low Auto-Refresh interval for view ${view.key}: ${intervalDelay}s. Capped to 60s.`);
            }
        }

        if (!isEmptyObject(viewKwObj)) {
            ktlKeywords[view.key] = viewKwObj;

            //Add page-level keywords
            if (viewKwObj._km || viewKwObj._kbs || viewKwObj._zoom || viewKwObj._nswd || viewKwObj._kn)
                ktlKeywords[page.key] = viewKwObj;
        }
    }

    //========================================
    // CONSTANTS
    //========================================

    this.const = {
        LS_USER_PREFS: 'USER_PREFS',
        LS_VIEW_DATES: 'VIEW_DATES',
        LS_AUTOCOMPLETES: 'AUTOCOMPLETE',

        LS_LOGIN: 'LOGIN',
        LS_ACTIVITY: 'ACTIVITY',
        LS_NAVIGATION: 'NAVIGATION',
        LS_INFO: 'INF',
        LS_DEBUG: 'DBG',
        LS_WRN: 'WRN',
        LS_APP_ERROR: 'APP_ERR',
        LS_SERVER_ERROR: 'SVR_ERR',
        LS_CRITICAL: 'CRI',

        LS_LAST_ERROR: 'LAST_ERROR',
        LS_SYSOP_MSG_UNREAD: 'SYSOP_MSG_UNREAD',

        WAIT_SEL_IGNORE: 0,
        WAIT_SEL_LOG_WARN: 1,
        WAIT_SEL_LOG_ERROR: 2,
        WAIT_SEL_ALERT: 3,
        WAIT_SELECTOR_SCAN_SPD: 100,

        MSG_APP: 'MSG_APP',
    };

    //========================================
    // KTL INTERNAL EVENTS
    //========================================

    this.events = (function () {
        return {
            trigger: function (eventName, data) {
                //Custom event dispatch for KTL internal events (e.g., ktl:ready, ktl:scene-change)
                const event = new CustomEvent('ktl:' + eventName, { detail: data });
                document.dispatchEvent(event);
                return this;
            }
        };
    })();

    //========================================
    // MODULE: CORE
    //========================================

    this.core = (function () {
        var cfg = {};

        return {
            setCfg: function (cfgObj = {}) {
                Object.assign(cfg, cfgObj);
                return cfg;
            },

            getCfg: function () {
                return cfg;
            },

            getVersion: function () {
                return KTL_VERSION;
            },

            //Utility: Wait for a selector to appear in the DOM
            waitSelector: function (selector, timeout = 10000) {
                return new Promise((resolve, reject) => {
                    const element = document.querySelector(selector);
                    if (element) {
                        resolve(element);
                        return;
                    }

                    const observer = new MutationObserver((mutations, obs) => {
                        const el = document.querySelector(selector);
                        if (el) {
                            obs.disconnect();
                            resolve(el);
                        }
                    });

                    observer.observe(document.body, { childList: true, subtree: true });

                    setTimeout(() => {
                        observer.disconnect();
                        reject(new Error(`Timeout waiting for selector: ${selector}`));
                    }, timeout);
                });
            },

            //Utility: Hide elements by selector
            hideSelector: function (selector) {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => el.style.display = 'none');
                return elements.length;
            },

            //Utility: Show elements by selector
            showSelector: function (selector) {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => el.style.display = '');
                return elements.length;
            },

            //Utility: Timed popup notification
            timedPopup: function (message, type = 'info', duration = 3000) {
                const popup = document.createElement('div');
                popup.className = `ktl-popup ktl-popup-${type}`;
                popup.textContent = message;
                popup.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 12px 20px;
                    border-radius: 4px;
                    background: ${type === 'error' ? '#f44336' : type === 'warning' ? '#ff9800' : '#2196f3'};
                    color: white;
                    z-index: 10000;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                `;
                document.body.appendChild(popup);

                setTimeout(() => {
                    popup.remove();
                }, duration);

                return popup;
            },

            //Utility: Inject CSS dynamically
            injectCSS: function (cssText, id) {
                let style = id ? document.getElementById(id) : null;
                if (!style) {
                    style = document.createElement('style');
                    if (id) style.id = id;
                    document.head.appendChild(style);
                }
                style.textContent = cssText;
                return style;
            }
        };
    })();

    //========================================
    // MODULE: STORAGE
    //========================================

    this.storage = (function () {
        function getPrefix() {
            return APP_ROOT_NAME;
        }

        return {
            lsSetItem: function (key, value) {
                try {
                    localStorage.setItem(getPrefix() + key, JSON.stringify(value));
                    return true;
                } catch (e) {
                    console.error('KTL storage error:', e);
                    return false;
                }
            },

            lsGetItem: function (key, defaultValue = null) {
                try {
                    const item = localStorage.getItem(getPrefix() + key);
                    return item ? JSON.parse(item) : defaultValue;
                } catch (e) {
                    return defaultValue;
                }
            },

            lsRemoveItem: function (key) {
                localStorage.removeItem(getPrefix() + key);
            },

            ssSetItem: function (key, value) {
                try {
                    sessionStorage.setItem(getPrefix() + key, JSON.stringify(value));
                    return true;
                } catch (e) {
                    return false;
                }
            },

            ssGetItem: function (key, defaultValue = null) {
                try {
                    const item = sessionStorage.getItem(getPrefix() + key);
                    return item ? JSON.parse(item) : defaultValue;
                } catch (e) {
                    return defaultValue;
                }
            },

            ssRemoveItem: function (key) {
                sessionStorage.removeItem(getPrefix() + key);
            },

            hasLocalStorage: function () {
                try {
                    const test = '__ktl_test__';
                    localStorage.setItem(test, test);
                    localStorage.removeItem(test);
                    return true;
                } catch (e) {
                    return false;
                }
            }
        };
    })();

    //========================================
    // MODULE: FIELDS (Stub)
    //========================================

    this.fields = (function () {
        return {
            getFieldType: function (fieldId) {
                //TODO: Implement for Next-Gen
                return null;
            },

            getFieldValue: function (fieldId, viewId) {
                //TODO: Implement for Next-Gen
                return null;
            },

            setFieldValue: function (fieldId, value, viewId) {
                //TODO: Implement for Next-Gen
                return false;
            }
        };
    })();

    //========================================
    // MODULE: PERSISTENT FORM (Stub)
    //========================================

    this.persistentForm = (function () {
        return {
            enable: function (viewId) {
                //TODO: Implement for Next-Gen
            },

            disable: function (viewId) {
                //TODO: Implement for Next-Gen
            },

            clearSavedData: function (viewId) {
                //TODO: Implement for Next-Gen
            }
        };
    })();

    //========================================
    // MODULE: USER FILTERS (Stub)
    //========================================

    this.userFilters = (function () {
        return {
            enable: function (viewId) {
                //TODO: Implement for Next-Gen
            },

            saveFilter: function (viewId, filterName, filterData) {
                //TODO: Implement for Next-Gen
            },

            loadFilter: function (viewId, filterName) {
                //TODO: Implement for Next-Gen
            },

            deleteFilter: function (viewId, filterName) {
                //TODO: Implement for Next-Gen
            }
        };
    })();

    //========================================
    // MODULE: VIEWS
    //========================================

    this.views = (function () {
        const autoRefreshTimers = {};
        const summaryObservers = {}; // viewId -> [callbacks]
        const summaryMutationObservers = {}; // viewId -> MutationObserver

        return {
            refreshView: async function (viewId) {
                try {
                    //Next-Gen Knack API for refreshing views
                    if (typeof Knack.views?.refresh === 'function') {
                        await Knack.views.refresh(viewId);
                    } else if (typeof Knack.refreshView === 'function') {
                        await Knack.refreshView(viewId);
                    } else {
                        //Fallback: trigger a re-render by dispatching custom event
                        console.warn('KTL: No native refresh API found, trying alternative for', viewId);
                        const viewEl = document.getElementById(viewId);
                        if (viewEl) {
                            viewEl.dispatchEvent(new CustomEvent('knack-view-refresh', { bubbles: true }));
                        }
                    }
                    ktl.log.clog(`View refreshed: ${viewId}`, 'gray');
                } catch (error) {
                    console.error('KTL: Error refreshing view', viewId, error);
                }
            },

            refreshViewArray: function (viewIds) {
                viewIds.forEach(id => this.refreshView(id));
            },

            autoRefresh: function (viewId, intervalSeconds) {
                if (autoRefreshTimers[viewId]) {
                    clearInterval(autoRefreshTimers[viewId]);
                }

                if (intervalSeconds && intervalSeconds >= 5) { //TODO: Put back to 60
                    autoRefreshTimers[viewId] = setInterval(() => {
                        this.refreshView(viewId);
                    }, intervalSeconds * 1000);
                }
            },

            stopAutoRefresh: function (viewId) {
                if (autoRefreshTimers[viewId]) {
                    clearInterval(autoRefreshTimers[viewId]);
                    delete autoRefreshTimers[viewId];
                }
            },

            //Summary rendered detection (KTL-specific, not native to Knack)
            onSummaryRendered: function (viewId, callback) {
                if (typeof callback !== 'function') return this;

                if (!summaryObservers[viewId]) {
                    summaryObservers[viewId] = [];

                    //Set up MutationObserver to watch for summary row
                    const setupObserver = () => {
                        const viewEl = document.getElementById(viewId);
                        if (!viewEl) return;

                        const observer = new MutationObserver((mutations) => {
                            //Check for summary elements (adjust selector for NG)
                            const summaryEl = viewEl.querySelector('.kn-table-totals, .kn-records-summary, tfoot');
                            if (summaryEl && summaryEl.textContent.trim()) {
                                //Summary is rendered, notify observers
                                summaryObservers[viewId]?.forEach(cb => {
                                    try {
                                        cb({ viewId, summaryElement: summaryEl });
                                    } catch (e) {
                                        console.error('Summary observer error:', e);
                                    }
                                });
                            }
                        });

                        observer.observe(viewEl, { childList: true, subtree: true });
                        summaryMutationObservers[viewId] = observer;
                    };

                    //Try immediately or wait for view to render
                    if (document.getElementById(viewId)) {
                        setupObserver();
                    } else {
                        ktl.core.waitSelector(`#${viewId}`).then(setupObserver).catch(() => {});
                    }
                }

                summaryObservers[viewId].push(callback);
                return this;
            },

            offSummaryRendered: function (viewId, callback) {
                if (!summaryObservers[viewId]) return this;

                if (callback) {
                    const index = summaryObservers[viewId].indexOf(callback);
                    if (index > -1) summaryObservers[viewId].splice(index, 1);
                } else {
                    //Remove all observers for this view
                    summaryObservers[viewId] = [];
                }

                //Clean up MutationObserver if no more callbacks
                if (summaryObservers[viewId].length === 0 && summaryMutationObservers[viewId]) {
                    summaryMutationObservers[viewId].disconnect();
                    delete summaryMutationObservers[viewId];
                }

                return this;
            },

            hideColumn: function (viewId, columnIndex) {
                const css = `#${viewId} th:nth-child(${columnIndex + 1}), #${viewId} td:nth-child(${columnIndex + 1}) { display: none; }`;
                ktl.core.injectCSS(css, `ktl-hide-col-${viewId}-${columnIndex}`);
            },

            showColumn: function (viewId, columnIndex) {
                const style = document.getElementById(`ktl-hide-col-${viewId}-${columnIndex}`);
                if (style) style.remove();
            }
        };
    })();

    //========================================
    // MODULE: SCENES
    //========================================

    this.scenes = (function () {
        let idleTimer = null;
        let spinnerTimer = null;
        let currentSceneKey = null;
        const sceneChangeObservers = [];

        //Scene change detection via URL/hash monitoring
        let lastUrl = window.location.href;

        function checkForSceneChange() {
            const currentUrl = window.location.href;
            if (currentUrl !== lastUrl) {
                const previousScene = currentSceneKey;
                lastUrl = currentUrl;

                //Extract scene key from URL hash (e.g., #page/page_2 or #scene_123)
                const hash = window.location.hash;
                const match = hash.match(/scene_\d+|page_\d+/);
                currentSceneKey = match ? match[0] : null;

                //Notify all observers
                sceneChangeObservers.forEach(callback => {
                    try {
                        callback({ previousScene, currentScene: currentSceneKey, url: currentUrl });
                    } catch (e) {
                        console.error('Scene change observer error:', e);
                    }
                });

                ktl.events.trigger('scene-change', { previousScene, currentScene: currentSceneKey });
            }
        }

        //Monitor for URL changes (handles both pushState and hashchange)
        window.addEventListener('hashchange', checkForSceneChange);
        window.addEventListener('popstate', checkForSceneChange);

        //Also use MutationObserver as backup for SPA navigation
        const pageObserver = new MutationObserver(() => {
            checkForSceneChange();
        });

        //Start observing once DOM is ready
        if (document.body) {
            pageObserver.observe(document.body, { childList: true, subtree: true });
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                pageObserver.observe(document.body, { childList: true, subtree: true });
            });
        }

        return {
            getCurrentSceneKey: async function () {
                if (currentSceneKey) return currentSceneKey;
                const hash = window.location.hash;
                const match = hash.match(/scene_\d+|page_\d+/);
                return match ? match[0] : null;
            },

            //Scene change notification system (KTL-specific, not native to Knack)
            onSceneChange: function (callback) {
                if (typeof callback === 'function' && !sceneChangeObservers.includes(callback)) {
                    sceneChangeObservers.push(callback);
                }
                return this;
            },

            offSceneChange: function (callback) {
                const index = sceneChangeObservers.indexOf(callback);
                if (index > -1) {
                    sceneChangeObservers.splice(index, 1);
                }
                return this;
            },

            getSceneChangeObservers: function () {
                return [...sceneChangeObservers];
            },

            resetIdleWatchdog: function (timeout = 300000) {
                if (idleTimer) clearTimeout(idleTimer);
                idleTimer = setTimeout(() => {
                    ktl.events.trigger('idle-timeout');
                }, timeout);
            },

            spinnerWatchdog: function (timeout = 30000) {
                if (spinnerTimer) clearTimeout(spinnerTimer);
                spinnerTimer = setTimeout(() => {
                    ktl.events.trigger('spinner-timeout');
                }, timeout);
            },

            clearSpinnerWatchdog: function () {
                if (spinnerTimer) {
                    clearTimeout(spinnerTimer);
                    spinnerTimer = null;
                }
            }
        };
    })();

    //========================================
    // MODULE: LOG
    //========================================

    this.log = (function () {
        const LOG_KEY = 'KTL_LOG';

        return {
            clog: function (message, color = 'black') {
                console.log(`%c${message}`, `color: ${color}`);
            },

            addLog: function (category, message, data = {}) {
                const logs = ktl.storage.lsGetItem(LOG_KEY, []);
                logs.push({
                    timestamp: new Date().toISOString(),
                    category,
                    message,
                    data
                });

                //Keep only last 100 entries
                if (logs.length > 100) logs.shift();

                ktl.storage.lsSetItem(LOG_KEY, logs);
            },

            getLogs: function (category = null) {
                const logs = ktl.storage.lsGetItem(LOG_KEY, []);
                if (category) {
                    return logs.filter(log => log.category === category);
                }
                return logs;
            },

            clearLogs: function () {
                ktl.storage.lsRemoveItem(LOG_KEY);
            }
        };
    })();

    //========================================
    // MODULE: USER PREFS (Stub)
    //========================================

    this.userPrefs = (function () {
        const PREFS_KEY = 'USER_PREFS';

        return {
            get: function (key, defaultValue = null) {
                const prefs = ktl.storage.lsGetItem(PREFS_KEY, {});
                return prefs[key] !== undefined ? prefs[key] : defaultValue;
            },

            set: function (key, value) {
                const prefs = ktl.storage.lsGetItem(PREFS_KEY, {});
                prefs[key] = value;
                ktl.storage.lsSetItem(PREFS_KEY, prefs);
            },

            remove: function (key) {
                const prefs = ktl.storage.lsGetItem(PREFS_KEY, {});
                delete prefs[key];
                ktl.storage.lsSetItem(PREFS_KEY, prefs);
            }
        };
    })();

    //========================================
    // MODULE: ACCOUNT
    //========================================

    this.account = (function () {
        let cachedUser = null;

        return {
            getUser: async function () {
                if (cachedUser) return cachedUser;
                cachedUser = await Knack.getUser();
                return cachedUser;
            },

            isLoggedIn: async function () {
                const user = await this.getUser();
                return user !== null && user !== undefined;
            },

            getUserId: async function () {
                const user = await this.getUser();
                return user ? user.id : null;
            },

            getUserEmail: async function () {
                const user = await this.getUser();
                return user ? user.email : null;
            },

            getToken: async function () {
                const user = await this.getUser();
                return user ? user.token : null;
            },

            clearCache: function () {
                cachedUser = null;
            }
        };
    })();

    //========================================
    // MODULE: IFRAME WINDOW (Stub)
    //========================================

    this.iFrameWnd = (function () {
        return {
            open: function (url, options = {}) {
                //TODO: Implement for Next-Gen
            },

            close: function () {
                //TODO: Implement for Next-Gen
            },

            sendMessage: function (message) {
                //TODO: Implement for Next-Gen
            }
        };
    })();

    //========================================
    // MODULE: WINDOW MESSAGING (Stub)
    //========================================

    this.wndMsg = (function () {
        return {
            send: function (targetWindow, message, origin = '*') {
                targetWindow.postMessage(message, origin);
            },

            onMessage: function (callback) {
                window.addEventListener('message', (event) => {
                    callback(event.data, event.origin, event.source);
                });
            }
        };
    })();

    //========================================
    // MODULE: BULK OPERATIONS (Stub)
    //========================================

    this.bulkOps = (function () {
        return {
            bulkEdit: function (viewId, recordIds, fieldValues) {
                //TODO: Implement for Next-Gen
            },

            bulkDelete: function (viewId, recordIds) {
                //TODO: Implement for Next-Gen
            },

            bulkCopy: function (viewId, recordIds) {
                //TODO: Implement for Next-Gen
            }
        };
    })();

    //========================================
    // MODULE: SYSTEM INFO (Stub)
    //========================================

    this.sysInfo = (function () {
        return {
            getAppVersion: function () {
                return APP_KTL_VERSIONS;
            },

            getKtlVersion: function () {
                return KTL_VERSION;
            },

            getBrowserInfo: function () {
                return {
                    userAgent: navigator.userAgent,
                    language: navigator.language,
                    platform: navigator.platform
                };
            }
        };
    })();

    //========================================
    // INITIALIZATION
    //========================================

    function processViewKeywords(viewKey) {
        const viewKeywords = ktlKeywords[viewKey];
        if (viewKeywords) {
            if (viewKeywords._ar) {
                const interval = parseInt(viewKeywords._ar[0]?.params?.[0]?.[0] || 0);
                if (interval >= 5) { //TODO: Put back to 60
                    ktl.views.autoRefresh(viewKey, interval);
                    ktl.log.clog(`Auto-refresh enabled for ${viewKey}: ${interval}s`, 'purple');
                }
            }
        }
    }

    function revealPage() {
        if (pageRevealed) return;
        pageRevealed = true;
        document.documentElement.classList.remove('ktlInitializing');
        ktl.log.clog('Page revealed', 'green');
    }

    function scheduleReveal() {
        if (pageRevealed) return;
        if (revealTimer) clearTimeout(revealTimer);
        revealTimer = setTimeout(revealPage, REVEAL_DEBOUNCE_MS);
    }

    async function init() {
        console.log('KTL initializing v' + KTL_VERSION);

        //Parse keywords from schema
        await initKeywordParser();
        keywordsReady = true;

        //Process pages captured by early listeners
        if (pendingPages.length > 0) {
            pendingPages.forEach(data => {
                ktl.log.clog(`Page rendered: ${data.pageKey}`, 'blue');
            });
            pendingPages.length = 0;
        }

        //Process views captured by early listeners
        if (pendingViews.length > 0) {
            ktl.log.clog(`Processing ${pendingViews.length} pending view(s)`, 'gray');
            pendingViews.forEach(data => {
                ktl.log.clog(`View rendered: ${data.viewKey}`, 'blue');
                processViewKeywords(data.viewKey);
            });
            pendingViews.length = 0;
        }

        //Schedule reveal (will fire after views stop rendering)
        scheduleReveal();

        //Dispatch ready event
        ktl.events.trigger('ready', { version: KTL_VERSION });

        console.log('KTL ready');
    }

    //Run initialization
    init().catch(err => console.error('KTL init error:', err));

    return this;
}

//Expose globally
window.Ktl = Ktl;
