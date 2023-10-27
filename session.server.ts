import { createCookieSessionStorage } from "@remix-run/node";
import wordpiece from "app/json/wordpiece.json";

type SessionData = {
    gameId: string;
    player: string;
    host?: boolean;
    crossed: string[][];
    mode: 'words' | 'numbers';
    card: string[][]
};

type SessionFlashData = {
    error: string;
};
const { getSession, commitSession, destroySession } = createCookieSessionStorage<SessionData, SessionFlashData>({
    cookie: {
        name: "__mt_session",
        maxAge: 60 * 60 * 3,
        httpOnly: true,
        sameSite: 'lax',
        secrets: [process.env.COOKIE_SECRET!]
    }
})

export const randomNum = (min: number, max: number) => {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

const letters = "BBCCCCDDDFFGGHHHJKLLLLLMMMNNNNNNPPPQRRRRRRRSSSSSSTTTTTTTVWXYYZ".split("")

export const randomLetter = () => {
    return letters[randomNum(0, letters.length - 1)]
}

export const generateTiles = (mode: string) => {
    let tiles: string[] = []
    let newTile = ""
    do {
        newTile = mode === 'words'
            ? randomLetter()
            : String(tiles.length >= 5 ? randomNum(10, 99) : randomNum(1, 9))
        if (!tiles.includes(newTile)) {
            tiles.push(newTile)
        }
    } while (tiles.length < 10)
    return tiles
}

const getRandomWord = (freqL: number, freqH: number) => {
    const wordList = Object.entries(wordpiece).filter(([k, v]) => v <= freqH && v >= freqL).map(([k, v]) => k)
    return wordList[randomNum(0, wordList.length - 1)]
}

const generateCard = (mode: 'numbers' | 'words') => {
    let card: string[][] = []
    let list: string[] = []
    for (let i = 1; i <= 5; i++) {
        let cardRow: string[] = []
        for (let o = 1; o <= 5; o++) {
            let newBox = ""
            const idx = ((i - 1) * 5) + o
            do {
                if (mode === "numbers") {
                    if (idx === 13) {
                        newBox = String(randomNum(4000, 9999))
                    } else if ([3, 7, 9, 11, 15, 17, 19, 23].includes(idx)) {
                        newBox = String(randomNum(0, 99))
                    } else if ([1, 5, 8, 12, 14, 18, 21, 25].includes(idx)) {
                        newBox = String(randomNum(1000, 6000))
                    } else {
                        newBox = String(randomNum(idx % 2 > 0 ? 100 : 800, 4000))
                    }
                    console.log('wtf', newBox, idx)
                } else {
                    newBox = (idx % 2 > 0 ? getRandomWord(10, 999) : getRandomWord(5, 9))
                }
            } while (list.includes(newBox))
            list.push(newBox)
            cardRow.push(newBox)
        }
        card.push(cardRow)
    }
    return card
}

export { getSession, commitSession, destroySession, generateCard };