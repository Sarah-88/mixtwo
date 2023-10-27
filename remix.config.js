const { config } = require("@netlify/remix-edge-adapter");

/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
    ...config,
    serverPlatform: 'node'
    // This works out of the box with the Netlify adapter, but you can
    // add your own custom config here if you want to.
    //
    // See https://remix.run/file-conventions/remix-config
};