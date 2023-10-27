/** @type {import('@remix-run/dev').AppConfig} */
const baseConfig =
    process.env.NODE_ENV === "production"
        ? // when running the Netify CLI or building on Netlify, we want to use
        {
            server: "./server.js",
            serverBuildPath: ".netlify/functions-internal/server.js",
        }
        : // otherwise support running remix dev, i.e. no custom server
        undefined;
export default {
    ...baseConfig,
    ignoredRouteFiles: ["**/.*"],
    // appDirectory: "app",
    // assetsBuildDirectory: "public/build",
    // publicPath: "/build/",
    // serverBuildPath: "build/index.js",
};
