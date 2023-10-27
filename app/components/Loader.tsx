import { useNavigation } from "@remix-run/react";

export default function Loader() {
    const navigation = useNavigation()
    if (navigation.state === 'idle') {
        return <></>
    }
    return (
        <div className="backdrop-blur-sm fixed inset-0 z-20 bg-white/50 flex justify-center items-center">
            <div className="bg-blue-600 rounded-full w-6 h-6 animate-swingright"></div>
            <div className="bg-blue-300/70 rounded-full w-6 h-6 animate-swingleft"></div>
        </div>
    );
}
