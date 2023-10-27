import { EventEmitter } from "events";

let emitter: EventEmitter
if (process.env.NODE_ENV === "development") {
    if (!global.__emitter) {
        global.__emitter = new EventEmitter();
    }
    emitter = global.__emitter;

} else {
    emitter = new EventEmitter();
}

type InitFunction = (send: SendFunction) => CleanupFunction;
type SendFunction = (event: string, data: string) => void;
type CleanupFunction = () => void;

async function eventStream(request: Request, init: InitFunction) {
    let stream = new ReadableStream({
        start(controller) {
            let encoder = new TextEncoder();
            let send = (event: string, data: string) => {
                controller.enqueue(encoder.encode(`event: ${event}\n`));
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            };
            let cleanup = init(send);

            let closed = false;
            let close = () => {
                if (closed) return;
                cleanup();
                closed = true;
                request.signal.removeEventListener("abort", close);
                controller.close();
            };

            request.signal.addEventListener("abort", close);
            if (request.signal.aborted) {
                close();
                return;
            }
        },
    });

    return new Response(stream, {
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
    });
}

export { emitter, eventStream };