import { json, type LoaderFunctionArgs, redirect } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import clientPromise from "mongoclient.server";
import { destroySession, getSession } from "session.server";
import { Player, type Game } from "types";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
    const session = await getSession(request.headers.get("Cookie"))
    const client = await clientPromise
    const db = client.db("mixtwo")
    const gameInfo = await db.collection<Game>("game").findOne({ gameId: params.id })
    const playersQ = db.collection<Player>("players").find({ gameId: params.id })
    const players = await playersQ.toArray()
    if (!gameInfo || !players) {
        return redirect("/", {
            headers: {
                "Set-Cookie": await destroySession(session),
            },
        })
    }
    let destroy = {}
    if (session && session.get("gameId")) {
        destroy = {
            headers: {
                "Set-Cookie": await destroySession(session),
            },
        }
    }

    return json({ gameInfo, players }, destroy)
}

export default function GameResults() {
    const { gameInfo, players } = useLoaderData<typeof loader>()
    const navigate = useNavigate()
    const winner = players.find((p) => p.player === gameInfo.winner)

    return (
        <div className="flex items-center gap-6 m-auto justify-center flex-col">
            <h2 className="font-orbitron text-3xl text-blue-600 pb-5 pt-2">Results</h2>
            <div className="text-center">
                <h2 className="font-comfortaa text-2xl">{gameInfo.winner} 👑</h2>
                <div className="grid grid-cols-5 gap-[2px] border-2 border-slate-300 bg-slate-300 w-28">
                    {winner?.crossed.map((r, idx) =>
                        r.map((c, i) => <div key={`winnergrid-${idx}-${i}`} className={`aspect-square ${!!c ? "bg-teal-600" : "bg-white"}`}></div>))}
                </div>
            </div>
            <ul className="w-80">
                {players.filter((p) => p.player !== gameInfo.winner).map((p, idx) =>
                    <li key={`player-${idx}`} className="rounded bg-white py-1 px-2 font-grandstander flex justify-between items-center">
                        <span>{p.player}</span>
                        <div className="grid grid-cols-5 gap-[1px] border border-slate-300 bg-slate-300 w-10">
                            {p.crossed.map((r, ix) => r.map((c, i) => <div key={`p${idx}-${ix}-${i}`} className={`aspect-square ${!!c ? "bg-teal-600" : "bg-white"}`}></div>))}
                        </div>
                    </li>
                )}
            </ul>
            <button type="button" onClick={() => navigate('/')} className="font-comfortaa p-3 w-60 text-center bg-blue-600 text-white text-xl rounded mt-10">Play Another Game</button>
        </div>
    );
}
