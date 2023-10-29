import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { getAblyClient } from "session.server";

export const loader = async ({ params }: LoaderFunctionArgs) => {
    await getAblyClient(params.id as string, 'notification', "Testing notification")
    return json({ success: true })
}