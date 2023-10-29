import type { LinksFunction } from "@remix-run/node";
import {
    Links,
    LiveReload,
    Meta,
    Outlet,
    Scripts,
    ScrollRestoration,
} from "@remix-run/react";
import stylesheet from "~/tailwind.css";
import Loader from "./components/Loader";
import { useEffect } from "react"
import { configureAbly } from "@ably-labs/react-hooks"

export const links: LinksFunction = () => [
    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
    { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Grandstander:wght@300&family=Comfortaa:wght@600&family=Orbitron:wght@600&display=swap" },
    { rel: "stylesheet", href: stylesheet },
];

// configureAbly({ authUrl: "http://localhost:3000/ablyauth" })

export default function App() {
    useEffect(() => {
        // window.ablyRealtime.connect()
    }, [])
    return (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <Meta />
                <Links />
            </head>
            <body>
                <Outlet />
                <Loader />
                <ScrollRestoration />
                <Scripts />
                <LiveReload />
            </body>
        </html>
    );
}
