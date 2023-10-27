import { useEffect, useState } from 'react'
import { Events } from 'types';
// import { useEventSource, useSubscribe } from 'remix-sse/client/index.js'
// import { useChannel } from "@ably-labs/react-hooks";

function useEventSource(href: string, type: string) {
    let [data, setData] = useState("");

    useEffect(() => {
        let eventSource = new EventSource(href);
        eventSource.addEventListener(type, handler);

        function handler(event: MessageEvent) {
            setData(event.data || "unknown");
        }

        return () => {
            eventSource.removeEventListener("message", handler);
        };
    }, []);

    return data;
}

const Updater = (props: { gameId: string, receiveUpdate: (param: { name: string, data: any }) => void }) => {
    // useEventSource(`/emitter/${props.gameId}`);
    // const [channel] = useChannel(`mixtwo-updater-${props.gameId}`, "notification", (message: { name: string, data: any }) => {
    //     console.log('receive msg', message.name, message.data)
    //     setMsg(message.data.message)
    //     const timeout = setTimeout(() => {
    //         setMsg('')
    //         clearTimeout(timeout)
    //     }, 3000)
    // });
    // const [updateChannel] = useChannel(`mixtwo-updater-${props.gameId}`, "update", (message: { name: string, data: any }) => {
    //     console.log('receive update', message.name, message.data)
    //     props.receiveUpdate(message.data)
    // });
    // const receivedMsg = useSubscribe(`/emitter/${props.gameId}`, 'notification', {
    //     returnLatestOnly: true
    // })
    const [msg, setMsg] = useState('')

    useEffect(() => {
        let eventSource = new EventSource(`/emitter/${props.gameId}`);
        eventSource.addEventListener(`notification-${props.gameId}`, msgHandler);
        eventSource.addEventListener(`update-${props.gameId}`, updateHandler)

        function msgHandler(event: MessageEvent) {
            setMsg(event.data || "unknown");
            const timeout = setTimeout(() => {
                setMsg('')
                clearTimeout(timeout)
            }, 4000)
        }

        function updateHandler(event: MessageEvent<string>) {
            console.log('update event', event)
            const parsed = JSON.parse(event.data)
            console.log('parsed event', parsed)
            props.receiveUpdate(parsed)
        }

        return () => {
            eventSource.removeEventListener(`notification-${props.gameId}`, msgHandler);
            eventSource.removeEventListener(`update-${props.gameId}`, updateHandler);
        };
    }, [])
    return <div className={`fixed left-0 right-0 transition-all ${msg ? 'top-20 opacity-100' : 'top-0 opacity-0 pointer-events-none'}`}>
        <div className="m-auto max-w-lg flex justify-center">
            <div className="bg-teal-800 shadow-lg rounded-full border text-white text-center py-2 px-4">
                <span className="font-comfortaa text-sm">{msg}</span>
            </div>
        </div>
    </div>
}

export default Updater