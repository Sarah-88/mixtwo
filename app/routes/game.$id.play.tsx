import { json, type ActionFunctionArgs, type LoaderFunctionArgs, redirect } from "@remix-run/node";
import { useLoaderData, useFetcher, useOutletContext, useNavigate } from "@remix-run/react";
import clientPromise from "mongoclient.server";
import { useState, useRef, useEffect, useCallback } from "react";
import { commitSession, destroySession, generateTiles, getSession, getAblyClient } from "session.server";
import { Events, Game, Player } from "types";
// import { usePresence } from "@ably-labs/react-hooks"

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
    return json({ defaultTime: Number(process.env.TIMER), submitted: playerInfo?.rounds.length ?? 0, data: session.data, gameInfo: gameInfo })
}

const checkCrossed = (crossed: string[][]) => {
    let rows = Array(5).fill(0)
    let cols = Array(5).fill(0)
    let diagonal1 = Number(!!crossed[0][0]) + Number(!!crossed[1][1]) + Number(!!crossed[2][2]) + Number(!!crossed[3][3]) + Number(!!crossed[4][4]) //top left to bottom right
    let diagonal2 = Number(!!crossed[4][0]) + Number(!!crossed[3][1]) + Number(!!crossed[2][2]) + Number(!!crossed[1][3]) + Number(!!crossed[0][4]) //bottom left to top right
    crossed.forEach((r, idx) => {
        r.forEach((c, i) => {
            rows[idx] += c !== "" ? 1 : 0
            cols[i] += c !== "" ? 1 : 0
        })
    })
    return rows.filter(a => a === 5).length > 0 || cols.filter(a => a === 5).length > 0 || diagonal1 === 5 || diagonal2 === 5
}

export const action = async ({ request, params }: ActionFunctionArgs) => {
    const data = await request.formData()
    const dataForm = Object.fromEntries(data)
    const gameMode = dataForm.mode as string
    const answer = gameMode === "words" ? String(dataForm.answer).toLowerCase().replace(/_/g, '') : String(dataForm.answer)
    const bypass = dataForm.bypass === "true"
    const paused = dataForm.paused === "true"
    const totalPlayers = Number(dataForm.total)
    const session = await getSession(
        request.headers.get("Cookie")
    );
    const card = session.get("card")
    let crossed = session.get("crossed")!
    let answerFilled: number[][] = []
    let answerValid = false
    let wonGame = false
    let errorMsg = ""


    if (gameMode === "words") {
        const jsondata: string[] = require('../json/dictionary.json')
        const compWords: string[] = require('../json/words.json')
        if (!jsondata.includes(answer) && !bypass) {
            return json({ success: false, postData: true, message: "Invalid word" })
        }
        card?.forEach((cr, r) => {
            cr.forEach((cc, c) => {
                if (!crossed || !crossed[r][c]) {
                    if (compWords.includes(answer + cc)) {
                        crossed[r][c] = answer + cc
                        answerFilled.push([r, c])
                        answerValid = true
                    } else if (compWords.includes(cc + answer)) {
                        crossed[r][c] = cc + answer
                        answerFilled.push([r, c])
                        answerValid = true
                    }
                }
            })
        })
        errorMsg = "No matching words"
    } else {
        const numArray = answer.split('_')
        for (let i = 0; i < numArray.length; i++) {
            if (i === 0 && !(/^\d/).test(numArray[i])) {
                errorMsg = "Equation must start with a number"
                break
            } else if (i > 0 && (/^\d/).test(numArray[i]) && (/^\d/).test(numArray[i - 1])) {
                errorMsg = "Operators must be used between numbers"
                break
            } else if ((i > 0 && (/^\D/).test(numArray[i]) && (/^\D/).test(numArray[i - 1]))
                || (i === numArray.length - 1 && (/\D/).test(numArray[i]))) {
                errorMsg = "Numbers must be used after operators"
                break
            }
        }
        if (numArray.length > 7 && !errorMsg) {
            errorMsg = "Maximum 4 numbers allowed in equation"
        }
        if (!errorMsg) {
            let computed = 0
            let ansWoSp = answer.replace(/_/g, '')
            while (ansWoSp !== "") {
                let matches = ansWoSp.match(/\d+(×|÷)\d+/)
                if (!matches) {
                    matches = ansWoSp.match(/\d+(\+|-)\d+/)
                }
                if (matches) {
                    const numbers = matches[0].split(matches[1])
                    switch (matches[1]) {
                        case "+":
                            ansWoSp = ansWoSp.replace(matches[0], String(Number(numbers[0]) + Number(numbers[1])))
                            break
                        case "-":
                            ansWoSp = ansWoSp.replace(matches[0], String(Number(numbers[0]) - Number(numbers[1])))
                            break
                        case "×":
                            ansWoSp = ansWoSp.replace(matches[0], String(Number(numbers[0]) * Number(numbers[1])))
                            break
                        case "÷":
                            ansWoSp = ansWoSp.replace(matches[0], String(Number(numbers[0]) / Number(numbers[1])))
                            break

                    }
                } else {
                    computed = Number(ansWoSp)
                    ansWoSp = ""
                }
            }
            card?.forEach((cr, r) => {
                cr.forEach((cc, c) => {
                    if ((!crossed || !crossed[r][c]) && Number(cc) === computed) {
                        crossed[r][c] = answer.replace(/_/g, '') + '\n=' + cc
                        answerFilled.push([r, c])
                        answerValid = true
                    }
                })
            })
            if (!answerValid) {
                errorMsg = "No matching number"
            }
        }
    }


    if (!answerValid && !bypass) {
        return json({ success: false, postData: true, message: errorMsg })
    } else {
        session.set("crossed", crossed)
    }
    const client = await clientPromise
    const db = client.db("mixtwo")
    const round = Number(dataForm.round)
    if (round > 0) {
        if (!(paused && bypass && !answer)) {
            const result = await db.collection("players").updateOne(
                { gameId: params.id, player: session.get("player") },
                { $set: { crossed: crossed }, $push: { rounds: answer } }
            )
        }
        if (answerValid) {
            wonGame = checkCrossed(crossed)
        }
        if (wonGame) {
            await db.collection("game").updateOne({ gameId: params.id }, { $set: { winner: session.get("player"), endAt: new Date() }, $inc: { [`rounds.${round - 1}.playerCompleted`]: 1 } })

            const channel = await getAblyClient(params.id as string, 'update', { event: "gameOver", name: session.get("player") })
            await getAblyClient(params.id as string, 'notification', `${session.get("player")} has won the game!`, channel)
        } else {
            await db.collection("game").updateOne({ gameId: params.id }, { $inc: { [`rounds.${round - 1}.playerCompleted`]: 1 } })

            const latestGameData = await db.collection<Game>("game").findOne({ gameId: params.id })
            if (latestGameData && (totalPlayers === latestGameData.rounds[round - 1].playerCompleted || (bypass && latestGameData.rounds.length === round))) {
                const channel = await getAblyClient(params.id as string, 'update', { event: "nextRound", round: round + 1 })
                await getAblyClient(params.id as string, 'notification', `Round ${round + 1} started!`, channel)
                const currDate = new Date()
                currDate.setMinutes(currDate.getMinutes() + Number(process.env.TIMER))
                const res = await db.collection("game").updateOne({ gameId: params.id }, { $set: { [`rounds.${round - 1}.endAt`]: new Date() } })
                const res2 = await db.collection("game").updateOne({ gameId: params.id }, { $push: { rounds: { endAt: currDate, tiles: generateTiles(latestGameData.mode), playerCompleted: 0 } } })
            }
        }
    }

    return json({ success: answerValid, postData: true, answerFilled, crossed }, {
        headers: {
            "Set-Cookie": await commitSession(session)
        }
    })
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
    const [answer, setAnswer] = useState<string[]>([])
    const { update, players } = useOutletContext<{ update: Events, players: { data: string }[] }>()
    const timer = useRef<number>()

    const navigate = useNavigate()

    const submitAnswer = useCallback((bypass?: boolean) => {
        if (!gamePause || bypass) {
            setGamePause(true)
            fetcher.submit(
                { round: currRound, mode: loaderData.gameInfo.mode!, answer: answer.join('_'), bypass: !!bypass, paused: gamePause, total: players.length },
                { method: "POST" }
            )
            setAnswer([])
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
    }, [])

    const removeTile = useCallback((idx: number) => {
        setAnswer((prev) => {
            const copy = [...prev]
            copy.splice(idx, 1)
            return copy
        })
    }, [])

    useEffect(() => {
        if (loaderData.gameInfo.rounds.length && !fetcher.data?.postData) {
            const gameStartTime = new Date(fetcher.data?.nextRound ?? loaderData.gameInfo.rounds[loaderData.gameInfo.rounds.length - 1].endAt).valueOf()
            if (gameStartTime - Date.now() > 0) {
                setGamePause(false)
                setCurrRound((prev) => {
                    if (prev < loaderData.gameInfo.rounds.length) return loaderData.gameInfo.rounds.length
                    return prev
                })
                setTimer(gameStartTime)
                // return () => clearInterval(timer.current)
            }
        } else if (fetcher.data?.postData && !fetcher.data.success) {
            setGamePause(false)
        }
    }, [loaderData.gameInfo.rounds, fetcher.data])

    useEffect(() => {
        if (update.event === "nextRound" && update.round) {
            setCurrRound(update.round)
            fetcher.load(`/game/${loaderData.gameInfo.gameId}/next`)
        } else if (update.event === "gameOver") {
            setGamePause(true)
            clearInterval(timer.current)
            setTimeout(() => {
                navigate(`/game/${loaderData.gameInfo.gameId}/results`)
            }, 3000)
        }
    }, [update.round, update.event])

    useEffect(() => {
        if (loaderData.submitted >= loaderData.gameInfo.rounds.length) {
            setGamePause(true)
        }
    }, [loaderData.submitted, loaderData.gameInfo.rounds.length])
    return (
        <div className="flex items-start gap-3 m-auto mt-10 justify-center">
            <div className="bg-white p-2 flex-1 max-w-lg">
                <div className="bg-blue-100 p-1 grid grid-cols-5 gap-1">
                    {loaderData.data.card?.map((cc, idx) => cc.map((cr, ii) =>
                        <div key={`card-${idx}-${ii}`} className={`${loaderData.data.crossed && loaderData.data.crossed[idx][ii] ? "bg-blue-200" : "bg-white"} aspect-square flex justify-center items-center font-grandstander text-lg select-none`}>
                            {loaderData.data.crossed && (loaderData.data.crossed[idx][ii] || (fetcher.data?.crossed && fetcher.data.crossed[idx][ii]))
                                ? <span className="text-sm text-teal-500 text-center whitespace-pre-line">{fetcher.data?.crossed ? fetcher.data?.crossed[idx][ii] : loaderData.data.crossed[idx][ii]}</span> : <span>{cr}</span>}
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
                    {(fetcher.data?.tiles || loaderData.gameInfo.rounds[loaderData.gameInfo.rounds.length - 1].tiles).map((t, i) =>
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
                    {(fetcher.state === "idle"
                        ? `Waiting for other players...`
                        : "Submitting...")}
                </p> :
                    !fetcher.data?.success && fetcher.data?.message && <p className="font-comfortaa text-red-500 max-w-[240px]">{fetcher.data.message}</p>}
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
