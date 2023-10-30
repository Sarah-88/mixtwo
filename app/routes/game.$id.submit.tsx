import { json, type ActionFunctionArgs } from "@remix-run/node";
import clientPromise from "mongoclient.server";
import { commitSession, generateTiles, getAblyClient, getSession } from "session.server";
import { Game } from "types";

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
    const dataForm = await request.json()//formData()
    // const dataForm = Object.fromEntries(data)
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
                const currDate = new Date()
                currDate.setMinutes(currDate.getMinutes() + Number(process.env.TIMER))
                const res = await db.collection("game").updateOne({ gameId: params.id }, { $set: { [`rounds.${round - 1}.endAt`]: new Date() } })
                const res2 = await db.collection("game").updateOne({ gameId: params.id }, { $push: { rounds: { endAt: currDate, tiles: generateTiles(latestGameData.mode), playerCompleted: 0 } } })
                const channel = await getAblyClient(params.id as string, 'update', { event: "nextRound", round: round + 1 })
                await getAblyClient(params.id as string, 'notification', `Round ${round + 1} started!`, channel)
            }
        }
    }

    return json({ success: answerValid, postData: true, answerFilled, crossed }, {
        headers: {
            "Set-Cookie": await commitSession(session)
        }
    })
}