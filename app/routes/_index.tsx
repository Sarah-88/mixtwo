import { json, type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction, redirect } from "@remix-run/node";
import { Form, useActionData } from "@remix-run/react";
import clientPromise from "mongoclient.server";
import { useState } from "react";
import { commitSession, destroySession, generateCard, getSession, emitter } from "session.server";
import { Game, Player } from "types";

//@ts-ignore
export const meta: MetaFunction<typeof loader> = () => {
    return [
        { title: "MixTwo" },
        { name: "description", content: "Bingo + Scrabble inspired" },
    ];
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const session = await getSession(request.headers.get("Cookie"))
    let headers: { [key: string]: any } = {}
    try {
        if (session.data.gameId) {
            const client = await clientPromise
            const db = client.db("mixtwo")
            const gameInfo = await db.collection<Game>("game").findOne({ gameId: session.data.gameId })
            if (gameInfo?.startedAt) {
                return redirect(`/game/${session.data.gameId}/play`)
            } else if (gameInfo && !gameInfo.endAt) {
                return redirect(`/game/${session.data.gameId}`)
            }
            headers = {
                headers: {
                    "Set-Cookie": await destroySession(session)
                }
            }
        }
    } catch (e) {
        console.log(e)
    }
    return json({}, headers)
}

export const action = async ({ request }: ActionFunctionArgs) => {
    const data = await request.formData()
    const dataForm = Object.fromEntries(data)
    const session = await getSession(
        request.headers.get("Cookie")
    );
    try {
        const client = await clientPromise
        const db = client.db("mixtwo")
        if (dataForm.type === 'create') {
            const gameId = Math.random().toString(36).slice(2).toUpperCase()
            const insert = await db.collection("game").insertOne({ gameId, mode: dataForm.mode, rounds: [] })
            if (insert.insertedId) {
                const card = generateCard(dataForm.mode as "numbers" | "words")
                let crossed: string[][] = []
                for (let i = 0; i < 5; i++) {
                    crossed.push(Array(5).fill(""))
                }
                const playerInsert = await db.collection("players").insertOne({ gameId, player: dataForm.player, card, rounds: [], crossed, active: true })
                if (playerInsert.insertedId) {
                    session.set("gameId", gameId)
                    session.set("player", dataForm.player as string)
                    session.set("card", card)
                    session.set("host", true)
                    session.set("crossed", crossed)
                    session.set("mode", dataForm.mode as "numbers" | "words")
                    return redirect(`/game/${gameId}`, {
                        headers: {
                            "Set-Cookie": await commitSession(session),
                        },
                    });
                }
            }
            return json({ error: "Failed to create game", errorPos: '' })
        } else {
            const gameInfo = await db.collection<Game>("game").findOne({ gameId: dataForm.gameid })
            if (gameInfo) {
                if (gameInfo.endAt) {
                    return json({ error: "This game has already ended", errorPos: 'gameid' })
                } else if (gameInfo.startedAt && new Date(gameInfo.startedAt).valueOf() < Date.now()) {
                    return json({ error: "This game is in progress", errorPos: 'gameid' })
                }
                const otherPlayers = await db.collection<Player>("players").findOne({ gameId: dataForm.gameid, player: dataForm.player })
                if (otherPlayers) {
                    return json({ error: "This player name has been taken for this game", errorPos: 'player' })
                }
                const card = generateCard(gameInfo.mode as "numbers" | "words")
                let crossed: string[][] = []
                for (let i = 0; i < 5; i++) {
                    crossed.push(Array(5).fill(""))
                }
                const playerInsert = await db.collection("players").insertOne({ gameId: dataForm.gameid, player: dataForm.player, card, rounds: [], crossed, active: true })
                if (playerInsert.insertedId) {
                    session.set("gameId", gameInfo.gameId)
                    session.set("player", dataForm.player as string)
                    session.set("card", card)
                    session.set("mode", gameInfo.mode)
                    session.set("crossed", crossed)
                    emitter.emit(`update-${gameInfo.gameId}`, "playerJoin", dataForm.player)
                    emitter.emit(`notify-${gameInfo.gameId}`, `${dataForm.player} has joined!`)
                    return redirect(`/game/${gameInfo.gameId}`, {
                        headers: {
                            "Set-Cookie": await commitSession(session),
                        },
                    });
                }
                return json({ error: "Failed to join the game", errorPos: '' })
            }
            return json({ error: "Game does not exist", errorPos: 'gameid' })
        }
    } catch (e) {
        console.log(e)
        return json({ error: "Failed to connect to database", errorPos: '' })
    }
}

const instructions = {
    words: [
        "All vowels are always available in every round.",
        "10 consonants will be randomly picked every round. You will need to form a word using the letters available, and that word needs to be a valid word.",
        "The word you form must be able to be combined with any of the other words in your 5x5 card on the left, to form a new valid word.",
        "If you submit a valid word, the box it is in will be crossed out.",
        "You can use the letters available multiple times in the same word.",
        "Note that it is possible for the word you form to match more than 1 word in your card. It will be counted as a valid answer for all matching words."
    ],
    numbers: [
        "All operators (+, -, ×, ÷) are always available in every round.",
        "10 numbers will be randomly picked every round. You will need to form an equation using the numbers available.",
        "The equation you form must equal to one of the numbers in your 5x5 card.",
        "If you submit a valid equation, the box it is in will be crossed out.",
        "You can use the numbers/operators available multiple times in the same equation.",
        "A maximum of 4 numbers are allowed in the equation.",
        "Equations must have at least an operator that has a number on the left and right of it.",
        "All equations will calculate multiplications/divisions first, before addition and subtraction."
    ]
}

export default function Index() {
    const [type, setType] = useState("join")
    const [tab, setTab] = useState("words")
    const actionData = useActionData<typeof action>()
    return (
        <main className="max-w-7xl m-auto py-5">
            <h1 className="font-orbitron text-5xl uppercase text-center tracking-widest">
                <span className="text-blue-600">Mix</span>
                <span className="text-blue-300 animate-pulse inline-block">Two</span>
            </h1>
            <Form method="post" className="border rounded border-slate-300 max-w-xs m-auto mt-14 bg-blue-50">
                <div className="flex bg-teal-800 overflow-hidden rounded-t font-comfortaa">
                    <label htmlFor="join" className="flex-1 text-center cursor-pointer">
                        <input type="radio" id="join" name="type" value="join" defaultChecked className="hidden peer" onChange={(e) => setType(e.target.value)} />
                        <div className="p-2 hover:bg-teal-700 peer-checked:bg-blue-50 peer-checked:border-r peer-checked:border-r-slate-300 peer-checked:rounded-tr-sm peer-checked:text-slate-500 text-white">
                            Join Game
                        </div>
                    </label>
                    <label htmlFor="create" className="flex-1 text-center cursor-pointer">
                        <input type="radio" id="create" name="type" value="create" className="hidden peer" onChange={(e) => setType(e.target.value)} />
                        <div className="p-2 hover:bg-teal-700 peer-checked:bg-blue-50 peer-checked:border-l peer-checked:border-l-slate-300 peer-checked:rounded-tl-sm peer-checked:text-slate-500 text-white">Create Game</div>
                    </label>
                </div>
                <div className="p-5">
                    <label htmlFor="player" className="font-grandstander text-slate-600 mb-1 block">Player Name</label>
                    <input type="text" name="player" id="player" required className={`outline-none bg-white/50 block w-full focus:shadow-inner border rounded p-1 px-2 ${actionData?.errorPos === 'player' ? 'border-red-600' : 'border-slate-300'}`} />
                    {actionData?.error && actionData?.errorPos === 'player' && <p className="mt-2 text-red-600 font-grandstander">{actionData.error}</p>}
                    {type === "join" ?
                        <>
                            <label htmlFor="gameid" className="font-grandstander text-slate-600 mb-1 block mt-4">Game ID</label>
                            <input type="text" name="gameid" id="gameid" required className={`outline-none bg-white/50 block w-full focus:shadow-inner border rounded p-1 px-2 ${actionData?.errorPos === 'gameid' ? 'border-red-600' : 'border-slate-300'}`} />
                            {actionData?.error && actionData?.errorPos === 'gameid' && <p className="mt-2 text-red-600 font-grandstander">{actionData.error}</p>}
                        </>
                        : <>
                            <div className="mt-3">
                                <label className="font-grandstander text-slate-600 mb-1">Mode</label>
                                <div className="flex text-center font-grandstander text-slate-600">
                                    <div className="flex-1">
                                        <input type="radio" name="mode" id="words" value="words" defaultChecked className="hidden peer" />
                                        <label htmlFor="words" className="p-2 border border-slate-300 rounded-l border-r-0 shadow-inner peer-checked:shadow bg-slate-300 block cursor-pointer text-white peer-checked:text-slate-600 peer-checked:bg-white">Words</label>
                                    </div>
                                    <div className="border-l border-l-slate-300"></div>
                                    <div className="flex-1">
                                        <input type="radio" name="mode" id="numbers" value="numbers" className="hidden peer" />
                                        <label htmlFor="numbers" className="p-2 border border-slate-300 border-l-0 rounded-r shadow-inner peer-checked:shadow bg-slate-300 block cursor-pointer text-white peer-checked:text-slate-600 peer-checked:bg-white">Numbers</label>
                                    </div>
                                </div>
                            </div>
                        </>}
                    {actionData?.error && !actionData.errorPos && <p className="mt-5 text-red-600 font-grandstander">{actionData.error}</p>}
                    <button type="submit" className="hover:shadow-md hover:bg-teal-700 hover:text-white text-teal-800 hover:border-teal-600 duration-500 border border-teal-800 transition-all rounded block py-2 w-full mt-10 font-comfortaa tracking-widest">Enter</button>
                </div>
            </Form>
            <div id="howto" className="mt-8 max-w-5xl p-5 border-white border-t mx-auto">
                <h3 className="font-orbitron text-2xl text-teal-800 uppercase text-center pb-4">How to Play</h3>
                <div className="flex justify-center max-w-2xl gap-4 items-start mx-auto">
                    <button type="button" onClick={() => setTab('words')} className={`font-comfortaa text-xl py-2 px-5 ${tab === 'words' ? "text-blue-700 border-b-4 border-blue-700" : "text-slate-500"}`}>Words</button>
                    <button type="button" onClick={() => setTab('numbers')} className={`font-comfortaa text-xl py-2 px-5 ${tab === 'numbers' ? "text-blue-700 border-b-4 border-blue-700" : "text-slate-500"}`}>Numbers</button>
                </div>
                <div className="mt-4 p-8">
                    <ol type="1" className="font-grandstander leading-7 list-decimal">
                        <li>Each player is given a randomly-generated 5x5 card with {tab} in each box.</li>
                        <li>Once the host starts the game, the {tab} on the card will be revealed.</li>
                        <li>On the right side, there will be a countdown timer for the round. Each round is 5 minutes.</li>
                        <li>Before the round ends, you will need to use the available {tab === "words" ? "letters" : "numbers"} to form a{tab === "words" ? " compound word" : "n equation"}.</li>
                        {instructions[tab as "words" | "numbers"].map((it, i) => <li key={`instruction-${i}`}>{it}</li>)}
                        <li>If the timer runs out and you have not submitted an answer, whatever answer you've input at the time will be submitted.</li>
                        <li>Wrong answers are not penalized, so submit as many as you like.</li>
                        <li>The round will end when all players have submitted their answers, or the timer runs out, whichever comes first.</li>
                        <li>The first player to cross out 5 boxes in a row (horizontally, vertically, or diagonally) wins the game.</li>
                    </ol>
                </div>
            </div>
        </main>
    );
}
