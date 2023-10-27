export type Game = {
    gameId: string;
    mode: "numbers" | "words";
    rounds: { endAt: Date; tiles: string[], playerCompleted: number }[]
    startedAt?: Date;
    endAt?: Date;
    winner?: string;
    totalPlayers: number;
}

export type Player = {
    gameId: string;
    player: string;
    card: string[][];
    rounds: string[];
    crossed: string[][];
    active?: boolean;
}

export type Events = {
    event: string;
    round?: number;
    player?: string;
    winner?: string;
}