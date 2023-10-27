import { json, type LoaderArgs } from "@netlify/remix-runtime";
import { emitter } from "emitter.server";
import clientPromise from "mongoclient";
import { getSession } from "session.server";
import { Game, Player } from "types";

export const loader = async ({ request, params }: LoaderArgs) => {
    const client = await clientPromise
    const db = client.db("mixtwo")
    const session = await getSession(request.headers.get("Cookie"))
    const res = await db.collection<Player>("players").updateOne({ gameId: params.id, player: session.get("player") }, { $set: { active: false } })
    emitter.emit("notify", `${session.get("player")} has left the game`)
    return json({})
}