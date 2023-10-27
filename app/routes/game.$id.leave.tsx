import { json, type LoaderFunctionArgs } from "@remix-run/node";
import clientPromise from "mongoclient.server";
import { getSession, emitter } from "session.server";
import { Game, Player } from "types";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
    const client = await clientPromise
    const db = client.db("mixtwo")
    const session = await getSession(request.headers.get("Cookie"))
    const res = await db.collection<Player>("players").updateOne({ gameId: params.id, player: session.get("player") }, { $set: { active: false } })
    emitter.emit("notify", `${session.get("player")} has left the game`)
    return json({})
}