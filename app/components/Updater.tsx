import { useEffect, useState } from 'react'
import { useChannel, usePresence } from "@ably-labs/react-hooks";

const Updater = (props: { gameId: string, player: string, receiveUpdate: (param: { name: string, data: any }) => void, setPlayers: (list: { data: string }[]) => void }) => {
    const [msg, setMsg] = useState('')

    const [channel] = useChannel(`mixtwo-${props.gameId}`, (msg: { name: string, data: any }) => {
        if (msg.name === 'update') {
            props.receiveUpdate(msg.data)
        } else if (msg.name === 'notification') {
            setMsg(msg.data)
            const tmout = setTimeout(() => {
                setMsg('')
                clearTimeout(tmout)
            }, 5000)
        }
    })

    const [presenceData] = usePresence(`mixtwo-${props.gameId}`, props.player)
    useEffect(() => {
        props.setPlayers(presenceData)
    }, [presenceData])
    useEffect(() => {
        return () => channel.unsubscribe()
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