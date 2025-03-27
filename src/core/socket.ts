import pino from "pino";
import NodeCache from "node-cache";
import NewSocket, { Browsers, DisconnectReason } from "@whiskeysockets/baileys";

import type { Logger } from "pino";
import type { Boom } from "@hapi/boom";
import type { Chat, ConnectionState, Contact, GroupMetadata, MessageUpsertType, useMultiFileAuthState, UserFacingSocketConfig, WAMessage, WASocket } from "@whiskeysockets/baileys";

import { Message, MessageType } from "anna/core/message";
import { EventEmitter } from "anna/lib/event";
import { pinoConfig } from "anna/constants/configure";

export interface ISocketConfig extends Omit<UserFacingSocketConfig, "auth"> {
    session: Awaited<ReturnType<typeof useMultiFileAuthState>>,
    level?: 'info' | 'debug' | 'silent' | 'error' | 'fatal' | 'trace'
}

export interface ISocketEventEmitter {
    message: (socket: WASocket, message: Message) => void;
}

type MessagingHistory = { contacts: Contact[]; chats: Chat[]; messages: WAMessage[]; };
type MessagesUpsert = { messages: WAMessage[]; type: MessageUpsertType; requestId?: string; };

export class Socket extends EventEmitter<ISocketEventEmitter> {
    private socket?: WASocket;
    private log: Logger;
    // TODO: Use redis for caching
    private groupCache: NodeCache;
    private messageCache: NodeCache;

    constructor(private config: ISocketConfig) {
        super();
        this.log = pino({ level: this.config.level ?? "info", transport: { target: "pino-pretty", options: pinoConfig } });
        this.groupCache = new NodeCache();
        this.messageCache = new NodeCache();
    }


    public start() {
        this.socket = NewSocket({
            printQRInTerminal: !Bun.env.USE_PAIRING,
            syncFullHistory: false,
            browser: Browsers.macOS("Safari"),
            auth: this.config.session.state,
            logger: this.log,
            cachedGroupMetadata: async (jid) => this.groupCache.get(jid),
            getMessage: async (key) => this.messageCache.get(key.id as string),
            ...this.config
        });


        this.socket.ev.on("connection.update", this.connectionUpdate.bind(this));
        this.socket.ev.on("messaging-history.set", this.messagingHistory.bind(this));
        this.socket.ev.on("groups.upsert", this.groupsUpsert.bind(this));
        this.socket.ev.on("groups.update", this.groupsUpdate.bind(this));
        this.socket.ev.on("messages.upsert", this.messagesUpsert.bind(this));
        this.socket.ev.on("creds.update", this.config.session.saveCreds);
    }

    private async connectionUpdate({ connection, lastDisconnect, qr }: Partial<ConnectionState>) {
        if (!this.socket) throw new Error("Where the fuck this.socket properties?");

        if (qr && Bun.env.USE_PAIRING) {
            if (!Bun.env.PHONE) throw new Error("USE_PAIRING=true, but PHONE did not set?");

            const code = await this.socket.requestPairingCode(Bun.env.PHONE);
            this.log.info(`Your pairing code: ${code}`);
            return;
        }

        const recovered = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;

        switch (connection) {
            case "open":
                this.log.info(`Client connected as ${this.socket.user?.name ?? "Unknown"}`);
                break;
            case "connecting":
                this.log.info("Connecting, this may take a while...");
                break;
            case "close":
                if (recovered)
                    this.start();
                else
                    throw new Error("Client was disconnected from server, please log-in again!");
        }
    }

    private messagingHistory({ messages }: MessagingHistory) {
        for (const message of messages) {
            this.messageCache.set(message.key.id as string, message);
        }
    }

    private groupsUpsert(groups: GroupMetadata[]) {
        for (const group of groups) {
            this.groupCache.set(group.id, group);
        }
    }

    private groupsUpdate(updates: Partial<GroupMetadata>[]) {
        for (const update of updates) {
            const oncache = this.groupCache.get(update.id as string) ?? {};
            this.groupCache.set(update.id as string, { ...oncache, ...update });
        }
    }

    private async messagesUpsert({ messages }: MessagesUpsert) {
        if (!this.socket) throw new Error("Where the fuck this.socket properties!");

        await this.socket.readMessages(messages.map(v => v.key));

        for (const message of messages) {
            const packet = new Message(this.socket, message);
            if (packet.type == MessageType.Unknown) continue;
            this.emit("message", this.socket, packet);
        }
    }
}
