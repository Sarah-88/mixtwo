const baseConfig =
    process.env.NODE_ENV === "production"
        ? // when running the Netify CLI or building on Netlify, we want to use
        {
            server: "./server.ts",
            serverBuildPath: ".netlify/functions-internal/server.js",
        }
        : // otherwise support running remix dev, i.e. no custom server
        undefined;
/** @type {import('@remix-run/dev').AppConfig} */
export default {
    ...baseConfig,
    ignoredRouteFiles: ["**/.*"],
    // This works out of the box with the Netlify adapter, but you can
    // add your own custom config here if you want to.
    //
    // See https://remix.run/file-conventions/remix-config
};