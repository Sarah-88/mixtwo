import { LoaderFunctionArgs } from "@netlify/remix-runtime";
import { eventStream } from "emitter.server";
import { emitter } from "session.server";
import { Events } from "types";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
    return await eventStream(request, (send) => {
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
    })
};