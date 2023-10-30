import { json, type LoaderFunctionArgs, redirect } from "@remix-run/node";
import { useLoaderData, useFetcher, useOutletContext, useNavigate } from "@remix-run/react";
import clientPromise from "mongoclient.server";
import { useState, useRef, useEffect, useCallback } from "react";
import { destroySession, getSession } from "session.server";
import { Events, Game, Player } from "types";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
    const session = await getSession(request.headers.get("Cookie"))
    const client = await clientPromise
    const db = client.db("mixtwo")
    const gameInfo: Game | null = await db.collection<Game>("game").findOne({ gameId: params.id })
    if (!gameInfo) {
        return redirect("/", {
            headers: {
                "Set-Cookie": await destroySession(session),
            },
        })
    } else if (gameInfo.endAt && gameInfo.winner !== session.get("player")) {
        return redirect(`/game/${params.id}/results`, {
            headers: {
                "Set-Cookie": await destroySession(session),
            },
        })
    }
    const playerInfo = await db.collection<Player>("players").findOne({ gameId: params.id, player: session.get("player") })
    if (!playerInfo) {
        return redirect("/", {
            headers: {
                "Set-Cookie": await destroySession(session),
            },
        })
    }
    return json({ defaultTime: Number(process.env.TIMER), submitted: playerInfo?.rounds.length ?? 0, crossed: playerInfo?.crossed, data: session.data, gameInfo: gameInfo })
}

const compulsory = {
    numbers: ['+', '-', '×', '÷'],
    words: ['A', 'E', 'I', 'O', 'U']
}

export default function GamePlay() {
    const loaderData = useLoaderData<typeof loader>()
    const fetcher = useFetcher<{ tiles: string[], nextRound: Date, postData?: boolean, success?: boolean, answerFilled?: number[][], crossed?: string[][], message?: string }>()
    const [gamePause, setGamePause] = useState(loaderData.submitted >= loaderData.gameInfo.rounds.length)
    const [time, setTime] = useState([loaderData.defaultTime * 60, ("0" + loaderData.defaultTime).slice(-2), "00"])
    const [currRound, setCurrRound] = useState(loaderData.gameInfo.rounds.length ?? 0)
    const [crossed, setCrossed] = useState(loaderData.crossed)
    const [answer, setAnswer] = useState<string[]>([])
    const [error, setError] = useState('')
    const [tiles, setTiles] = useState(loaderData.gameInfo.rounds[loaderData.gameInfo.rounds.length - 1].tiles)
    const { update, players } = useOutletContext<{ update: Events, players: { data: string }[] }>()
    const timer = useRef<number>()

    const navigate = useNavigate()

    const submitAnswer = useCallback((bypass?: boolean) => {
        if (!gamePause || bypass) {
            setGamePause(true)
            fetch(window.location.href.replace('/play', '/submit'), {
                method: 'POST',
                body: JSON.stringify({ round: currRound, mode: loaderData.gameInfo.mode!, answer: answer.join('_'), bypass: !!bypass, paused: gamePause, total: players.length })
            }).then(resp => resp.json())
                .then(response => {
                    if (response.success) {
                        setError('')
                        setAnswer([])
                        setCrossed(response.crossed)
                    } else {
                        setError(response.message)
                        setGamePause(false)
                    }
                })
        }
    }, [gamePause, answer, currRound, players.length])

    const setTimer = useCallback((gameStartTimestamp: number) => {
        if (timer.current) {
            clearInterval(timer.current)
        }
        timer.current = window.setInterval(() => {
            const gameStartTime = Math.round((gameStartTimestamp - Date.now()) / 1000)
            setTime([
                gameStartTime,
                ("0" + Math.floor(gameStartTime / 60)).slice(-2),
                ("0" + (gameStartTime % 60)).slice(-2)
            ])
            if (gameStartTime < 0) {
                submitAnswer(true)
                clearInterval(timer.current)
            }
        }, 1000)
    }, [loaderData.gameInfo.mode, submitAnswer])

    const selectTile = useCallback((tile: string) => {
        setAnswer((prev) => {
            return [...prev, tile]
        })
        setError('')
    }, [])

    const removeTile = useCallback((idx: number) => {
        setAnswer((prev) => {
            const copy = [...prev]
            copy.splice(idx, 1)
            return copy
        })
        setError('')
    }, [])

    useEffect(() => {
        const gameStartTime = new Date(loaderData.gameInfo.rounds[loaderData.gameInfo.rounds.length - 1].endAt).valueOf()
        if (gameStartTime - Date.now() > 0) {
            setCurrRound(loaderData.gameInfo.rounds.length)
            setGamePause(false)
            setTimer(gameStartTime)
            // return () => clearInterval(timer.current)
        }
        return () => clearInterval(timer.current)
    }, [])

    useEffect(() => {
        if (update.event === "nextRound" && update.round) {
            const newRound = update.round
            fetch(window.location.href.replace('/play', '/next'), {
                method: 'GET',
                headers: {
                    "Content-Type": "application/json",
                }
            }).then(resp => resp.json())
                .then((response) => {
                    const gameStartTime = new Date(response.nextRound).valueOf()
                    if (gameStartTime - Date.now() > 0) {
                        setCurrRound(newRound)
                        setGamePause(false)
                        setTimer(gameStartTime)
                        setTiles(response.tiles)
                        // return () => clearInterval(timer.current)
                    }
                })
            // fetcher.load(`/game/${loaderData.gameInfo.gameId}/next`)
        } else if (update.event === "gameOver") {
            setGamePause(true)
            clearInterval(timer.current)
            setTimeout(() => {
                navigate(`/game/${loaderData.gameInfo.gameId}/results`)
            }, 3000)
        }
    }, [update.round, update.event])

    return (
        <div className="flex items-start gap-3 m-auto mt-10 justify-center">
            <div className="bg-white p-2 flex-1 max-w-lg">
                <div className="bg-blue-100 p-1 grid grid-cols-5 gap-1">
                    {loaderData.data.card?.map((cc, idx) => cc.map((cr, ii) =>
                        <div key={`card-${idx}-${ii}`} className={`${crossed[idx][ii] ? "bg-blue-200" : "bg-white"} aspect-square flex justify-center items-center font-grandstander text-lg select-none`}>
                            {crossed[idx][ii]
                                ? <span className="text-sm text-teal-500 text-center whitespace-pre-line">{crossed[idx][ii]}</span> : <span>{cr}</span>}
                        </div>
                    ))}
                </div>
            </div>
            <div className="min-w-[240px] flex flex-col gap-1">
                <h2>Round #{update.round || loaderData.gameInfo.rounds.length}</h2>
                <div className="border rounded border-blue-200 p-1 flex justify-center gap-1 font-orbitron text-2xl items-center">
                    <div className="border-blue-200 border rounded px-2 py-1 bg-white shadow-inner">{time[1]}</div>
                    <span>:</span>
                    <div className=" border-blue-200 border rounded px-2 py-1 bg-white shadow-inner">{time[2]}</div>
                </div>
                <div className="bg-blue-800 p-1 flex font-comfortaa uppercase gap-1">
                    {compulsory[loaderData.gameInfo.mode as keyof typeof compulsory].map((c, i) =>
                        <button type="button" key={`ctile-${i}`} onClick={() => selectTile(c)} className="flex-1 bg-blue-100 p-1 flex justify-center items-center text-2xl cursor-pointer hover:bg-white">{c}</button>
                    )}
                </div>
                {loaderData.gameInfo && <div className="bg-white p-1 grid grid-cols-5 rounded font-comfortaa uppercase gap-1 max-w-[240px]">
                    {(tiles).map((t, i) =>
                        <button type="button" key={`tile-${i}`}
                            onClick={() => selectTile(t)}
                            className="border rounded border-slate-300 p-2 aspect-square flex justify-center items-center text-2xl cursor-pointer hover:bg-blue-50">{t}</button>
                    )}
                </div>}
                <div className="border border-slate-300 rounded p-3 min-h-[60px] flex justify-center gap-1 max-w-[240px]">
                    {answer.map((a, idx) =>
                        <button key={`answerk-${idx}`} type="button" className="font-comfortaa text-sm border-slate-300 p-1 text-center w-8 border bg-white rounded" onClick={() => removeTile(idx)}>{a}</button>
                    )}
                </div>
                <button
                    type="button"
                    disabled={gamePause}
                    onClick={() => submitAnswer()}
                    className={`${!gamePause ? "hover:bg-teal-600 bg-teal-800 hover:shadow" : "bg-slate-500"} text-white p-2 rounded font-orbitron w-full`}
                >
                    Submit Answer
                </button>
                {gamePause ? <p className="font-comfortaa max-w-[240px]">
                    {(answer.length === 0
                        ? `Waiting for other players...`
                        : "Submitting...")}
                </p> :
                    error && <p className="font-comfortaa text-red-500 max-w-[240px]">{error}</p>}
                {loaderData.data.host &&
                    <div className="bg-white p-2 mt-5">
                        <h4 className="font-comfortaa mb-2">Players</h4>
                        <ul className="bg-blue-100 p-1 rounded flex flex-col gap-1">
                            {players.map((msg, idx) => <li key={`pd-${idx}`} className="bg-white px-2 py-1 text-sm font-grandstander rounded">{msg.data}</li>)}
                        </ul>
                    </div>
                }
            </div>
        </div>
    );
}
