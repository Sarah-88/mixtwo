import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import clientPromise from "mongoclient.server";
import { Game } from "types";

export const loader = async ({ params }: LoaderFunctionArgs) => {
    const client = await clientPromise
    const db = client.db("mixtwo")
    const res = await db.collection<Game>("game").findOne({ gameId: params.id })
    if (!res) {
        return json({ success: false })
    }
    const lastRound = res.rounds[res.rounds.length - 1]
    return json({ tiles: lastRound.tiles, nextRound: lastRound.endAt, postData: false })
}