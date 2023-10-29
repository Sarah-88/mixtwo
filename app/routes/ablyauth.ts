import { LoaderFunctionArgs, json } from "@remix-run/node";
import Ably from "ably/promises.js";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
    const ablyclient = new Ably.Realtime(process.env.ABLY_API_KEY!);
    const tokenRequestData = await ablyclient.auth.createTokenRequest({ clientId: `mixtwo-game` });

    return json(tokenRequestData)
};