import { useEffect, useState } from 'react'

const Updater = (props: { gameId: string, receiveUpdate: (param: { name: string, data: any }) => void }) => {
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
            const parsed = JSON.parse(event.data)
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