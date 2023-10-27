import { emitter, eventStream } from "emitter.server";
import { Events } from "types";

export const loader = ({ request, params }: { request: any, params: any }) => {
    return eventStream(request, (send) => {
        function handleUpdater(eventName: any, data?: any) {
            let dataReturn: Events = { event: eventName }
            switch (eventName) {
                case "playerJoin":
                    dataReturn.player = data
                    break
                case "gameOver":
                    dataReturn.winner = data
                    break
                case "nextRound":
                    dataReturn.round = data
                    break
            }
            const timeout = setTimeout(() => {
                send(`update-${params.id}`, JSON.stringify(dataReturn))
                clearTimeout(timeout)
            }, 1000)
        }
        function handleMsg(msg: string) {
            const timeout = setTimeout(() => {
                send(`notification-${params.id}`, msg)
                clearTimeout(timeout)
            }, 1000)
        }
        emitter.addListener(`update-${params.id}`, handleUpdater)
        emitter.addListener(`notify-${params.id}`, handleMsg)

        return () => {
            // Return a cleanup function
            emitter.removeListener(`update-${params.id}`, handleUpdater)
            emitter.removeListener(`notify-${params.id}`, handleMsg)
        };
        // const interval = setInterval(() => {
        //     // You can send events to the client via the `send` function
        //     send('greeting', JSON.stringify({ hello: 'world' }))
        // }, 1000)


        // return async () => {
        //     // Return a cleanup function
        //     clearInterval(interval)
        // };
    });
};

export const config = { runtime: 'edge' };

let initialDate = Date.now();

export function headers() {
    return {
        'x-edge-age': Date.now() - initialDate,
    };
}