import { json, type LoaderFunctionArgs, redirect } from "@remix-run/node";
import { Outlet, useLoaderData } from "@remix-run/react";
import { useState } from "react";
import { destroySession, getSession } from "session.server";
import Updater from "~/components/Updater";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
    const session = await getSession(request.headers.get("Cookie"))
    if (session.data.gameId !== params.id && !request.url.includes(`game/${params.id}/results`)) {
        return redirect("/", {
            headers: {
                "Set-Cookie": await destroySession(session),
            },
        })
    } else {
        return json({ gameId: params.id })
    }
}

export type PlayIndexLoader = typeof loader

export default function MainGame() {
    const loaderData = useLoaderData<typeof loader>()
    const [latestUpdate, setLatestUpdate] = useState<{ [key: string]: any }>({})

    return (
        <main className="max-w-7xl m-auto py-5">
            <h1 className="font-orbitron text-5xl uppercase text-center tracking-widest">
                <span className="text-blue-600">Mix</span>
                <span className="text-blue-300 animate-pulse inline-block">Two</span>
            </h1>
            <h3 className="font orbitron text-xl uppercase text-center text-blue-800 tracking-wider">Game #{loaderData.gameId}</h3>
            <Outlet context={latestUpdate} />
            <Updater receiveUpdate={setLatestUpdate} gameId={loaderData.gameId!} />
        </main>
    );
}
