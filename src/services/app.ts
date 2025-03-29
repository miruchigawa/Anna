import type { Logger } from "pino";
import type { WASocket } from "@whiskeysockets/baileys";

import type { Services } from "anna/lib/dependency";
import type { Socket } from "anna/core/socket";
import type { Message } from "anna/core/message";


export class AppService {
    private readonly socket: Socket
    private readonly log: Logger;

    constructor(private readonly services: Services) {
        this.socket = this.services.getRequiredService<Socket>("socket");
        this.log = this.services.getRequiredService<Logger>("log");

        this.socket.on("message", this.onMessage.bind(this));
    }

    /**
     * Handle incoming messages
     * @param _socket Socket connection
     * @param message Message received
     */
    private async onMessage(_socket: WASocket, message: Message) {
        this.log.info(`Received message at ${message.receiver.id} from ${message.sender.id}: ${message.text}`);
    }

    /**
     * Start the app service
     */
    public start() {
        this.log.info("Starting app service...");
        this.socket.start();
    }
}