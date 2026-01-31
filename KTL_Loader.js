//KTL Loader for Next-Gen Knack
//Add this to Knack Builder > Settings > API & Code > JavaScript

Knack.ready().then(async () => {
    await Knack.loadScript('http://localhost:3000/Lib/KTLNG/KTL_Start.js');
    loadKtl(typeof KnackApp === 'function' ? KnackApp : null);
});
