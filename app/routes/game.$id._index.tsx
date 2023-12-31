import { json, type ActionFunctionArgs, type LoaderFunctionArgs, redirect } from "@remix-run/node";
import { Form, useLoaderData, useNavigate, useOutletContext } from "@remix-run/react";
import clientPromise from "mongoclient.server";
import { destroySession, generateTiles, getSession, getAblyClient } from "session.server";
import { useEffect, useState } from "react";
import { Player, type Events, type Game } from "types";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
    const session = await getSession(request.headers.get("Cookie"))
    const client = await clientPromise
    const db = client.db("mixtwo")
    const gameInfo = await db.collection<Game>("game").findOne({ gameId: params.id })
    if (!gameInfo || gameInfo.endAt) {
        return redirect("/", {
            headers: {
                "Set-Cookie": await destroySession(session),
            },
        })
    }
    return json({ session: session.data })
}

export const action = async ({ request, params }: ActionFunctionArgs) => {
    const data = await request.formData()
    const dataForm = Object.fromEntries(data)
    const client = await clientPromise
    const db = client.db("mixtwo")
    const currDate = new Date()
    currDate.setMinutes(currDate.getMinutes() + Number(process.env.TIMER))
    const playerTotal = Number(dataForm.playernum)
    const res = await db.collection("game").updateOne({ gameId: params.id }, { $set: { startedAt: new Date(), totalPlayers: playerTotal }, $push: { rounds: { endAt: currDate, playerCompleted: 0, tiles: generateTiles(dataForm.mode as string) } } })
    if (res.modifiedCount === 1) {
        await getAblyClient(params.id as string, 'update', { event: "startGame" })
        return redirect(`/game/${params.id}/play`)
    }
    return json({})
}

const blanks = Array(25).fill("?")

export default function GameLobby() {
    const { session } = useLoaderData<typeof loader>()
    const { update, players } = useOutletContext<{ update: Events, players: { data: string }[] }>()
    const navigate = useNavigate()
    useEffect(() => {
        if (update.event === "startGame") {
            navigate(`/game/${session.gameId}/play`)
        }
    }, [update])
    return (
        <div className="flex items-start gap-3 m-auto mt-10 justify-center">
            <div className="bg-white p-2 flex-1 max-w-lg">
                <div className="bg-blue-100 p-1 grid grid-cols-5 gap-1">
                    {blanks.map((cr, ii) =>
                        <div key={`card-${ii}`} className="bg-white aspect-square flex justify-center items-center font-grandstander text-lg select-none">{cr}</div>
                    )}
                </div>
            </div>
            <Form method="post" className="border rounded border-blue-200 w-60 bg-white p-1">
                <h4 className="font-comfortaa text-xl text-center p-2">Players</h4>
                <ul className="bg-blue-100 p-1 rounded flex flex-col gap-1">
                    {players.map((msg, idx) => <li key={`pd-${idx}`} className="bg-white px-2 py-1 text-sm font-grandstander rounded">{msg.data}</li>)}
                </ul>
                <input type="hidden" name="playernum" value={players.length} />
                <input type="hidden" name="mode" value={session.mode} />
                {session.host ?
                    <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-comfortaa w-full rounded py-2 mt-1">Start Game</button>
                    : <p className="font-comfortaa text-sm p-2">Waiting for host to start game...</p>
                }
            </Form>
        </div>
    );
}
