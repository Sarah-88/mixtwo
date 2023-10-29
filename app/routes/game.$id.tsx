import { json, type LoaderFunctionArgs, redirect } from "@remix-run/node";
import { Outlet, useLoaderData } from "@remix-run/react";
import { useState, lazy, Suspense } from "react";
import { destroySession, getSession } from "session.server";

const Updater = lazy(async () => {
    const comp = await import('../components/Updater')
    if (typeof document !== 'undefined') {
        //@ts-ignore
        let isLoaded = !!window._ablyjs_jsonp
        while (!isLoaded) {
            await new Promise(resolve => setTimeout(resolve, 500))
            //@ts-ignore
            isLoaded = !!window._ablyjs_jsonp
        }
        return comp
    } else {
        return comp
    }
})

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
    const session = await getSession(request.headers.get("Cookie"))
    if (session.data.gameId !== params.id && !request.url.includes(`game/${params.id}/results`)) {
        return redirect("/", {
            headers: {
                "Set-Cookie": await destroySession(session),
            },
        })
    } else {
        return json({ gameId: params.id, player: session.get("player") })
    }
}

export type PlayIndexLoader = typeof loader

export default function MainGame() {
    const loaderData = useLoaderData<typeof loader>()
    const [latestUpdate, setLatestUpdate] = useState<{ [key: string]: any }>({})
    const [playerList, setPlayerList] = useState<{ data: string }[]>([])

    return (
        <main className="max-w-7xl m-auto py-5">
            <h1 className="font-orbitron text-5xl uppercase text-center tracking-widest">
                <span className="text-blue-600">Mix</span>
                <span className="text-blue-300 animate-pulse inline-block">Two</span>
            </h1>
            <h3 className="font orbitron text-xl uppercase text-center text-blue-800 tracking-wider">Game #{loaderData.gameId}</h3>
            <Outlet context={{ update: latestUpdate, players: playerList }} />
            <Suspense>
                <Updater receiveUpdate={setLatestUpdate} gameId={loaderData.gameId!} player={loaderData.player!} setPlayers={setPlayerList} />
            </Suspense>
        </main>
    );
}
