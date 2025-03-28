import { downloadMediaMessage, isJidGroup, type AnyMessageContent, type GroupMetadata, type MiscMessageGenerationOptions, type WAMessage, type WASocket } from "@whiskeysockets/baileys";

export enum ReceiverType {
    Group,
    Private
}

export enum MessageType {
    Unknown,
    Status,
    Message
}

export enum MediaType {
    Image,
    Video,
    Audio,
    Document,
    Sticker,
    Unknown
}


export class Message {
    private pool?: NodeJS.Timer;
    private cancelDefer?: NodeJS.Timer;

    constructor(private socket: WASocket, private packet: WAMessage) {}

    /**
     * Get the ID of the message
     * @returns {string} The ID of the message
     */
    public get id(): string {
        return this.packet.key.id || "";
    }

    /**
     * Get the type of the message
     * @returns {MessageType} The type of the message
     */
    public get type(): MessageType {
        if (this.packet.broadcast) return MessageType.Status;
        const validProperty = ["conversation", "extendedTextMessage", "imageMessage", "videoMessage", "stickerMessage", "documentMessage", "audioMessage", "productMessage", "buttonsResponseMessage", "contactMessage", "locationMessage", "liveLocationMessage", "listMessage", "templateButtonReplyMessage", "templateMessage", "ephemeralMessage"] as const;
        if (validProperty.some(p => p in (this.packet.message ?? {}))) return MessageType.Message;
        return MessageType.Unknown;
    }

    /**
     * Get the text of the message
     * @returns {string} The text of the message
     */
    public get text(): string {
        // console.log(this.packet.message);
        return this.packet.message?.conversation
            || this.packet.message?.extendedTextMessage?.text
            || this.packet.message?.imageMessage?.caption
            || this.packet.message?.videoMessage?.caption
            || this.packet.message?.protocolMessage?.editedMessage?.conversation
            || "";
    }

    /**
     * Get the media of the message
     * @returns {MediaMessage} The media of the message
     * @example
     * ```typescript
     * const media = message.media;
     * if (media.type === MediaType.Unknown) throw new Error("Unknown media type");
     * const buffer = await media.download(); // Download the media
     */
    public get media(): MediaMessage {
        return new MediaMessage(this.packet);
    }

    /**
     * Get the receiver of the message
     * @returns {Receiver} The receiver of the message
     */
    public get receiver(): Receiver {
        return new Receiver(this.socket, this.packet); 
    }

    /**
     * Get the sender of the message
     * @returns {Sender} The sender of the message
     */
    public get sender(): Sender {
        return new Sender(this.socket, this.packet);
    }

    /**
     * Send composing status to the receiver
     * @example
     * ```typescript
     * await message.defer(); // User will see that you are typing before you send the message
     * await message.reply("Hello!"); // Typing status will be removed and the message will be sent
     * ```
     */
    public async defer() {
        await this.socket.sendPresenceUpdate("composing", this.receiver.id);
        this.pool = setInterval(() => this.socket.sendPresenceUpdate("composing", this.receiver.id), 5000);
        this.cancelDefer = setTimeout(() => clearInterval(this.pool), 30000);
    }

    /**
     * Send reply to the message
     * @param content Content of the message
     * @param misc Any additional options for the message
     */
    public async reply(content: string | AnyMessageContent, misc: MiscMessageGenerationOptions = { quoted: this.packet }) {
        if (this.pool) clearInterval(this.pool);
        if (this.cancelDefer) clearTimeout(this.cancelDefer);
        
        if (typeof content === "string") 
            this.socket.sendMessage(this.receiver.id, { text: content }, misc );
        else 
            this.socket.sendMessage(this.receiver.id, content, misc);
    }

    /**
     * Send message to the receiver
     * @param jid JID of the receiver
     * @param content Content of the message
     * @param misc Any additional options for the message
     */
    public async send(jid: string, content: string | AnyMessageContent, misc: MiscMessageGenerationOptions = {}) {
        if (this.pool) clearInterval(this.pool);
        if (this.cancelDefer) clearTimeout(this.cancelDefer);
        
        if (typeof content === "string") 
            this.socket.sendMessage(jid, { text: content }, misc );
        else 
            this.socket.sendMessage(jid, content, misc);
    }
}

export class Receiver {
    constructor(private socket: WASocket, private packet: WAMessage) {}

    /**
     * Get the ID of the receiver of the message
     * @returns {string} The ID of the receiver
     */
    public get id(): string {
        return this.packet.key.remoteJid || "";
    }

    /**
     * Get the type of the receiver of the message
     * @returns {ReceiverType} The type of the receiver
     */
    public get type(): ReceiverType {
        return isJidGroup(this.id) ? ReceiverType.Group : ReceiverType.Private;
    }

    /**
     * Get the metadata of the receiver if it is a group
     * @returns {GroupMetadata | null} The metadata of the group if the receiver is a group
     */
    public async metadata(): Promise<GroupMetadata | null> {
        if (this.type === ReceiverType.Group)
            return await this.socket.groupMetadata(this.id);
        return null;
    }

    /**
     * Send message to the receiver
     * @param content Content of the message
     * @param misc Any additional options for the message
     */
    public async send(content: string | AnyMessageContent, misc: MiscMessageGenerationOptions = {}) {
        if (typeof content === "string") 
            this.socket.sendMessage(this.id, { text: content }, misc );
        else 
            this.socket.sendMessage(this.id, content, misc);
    }
}

export class Sender {
    constructor(private socket: WASocket, private packet: WAMessage) {}

    /**
     * Get the ID of the sender of the message
     * @returns {string} The ID of the sender
     */
    public get id(): string {
        const maid = this.socket.user?.id?.replace(/:d+/, "") || "";
        const romid = this.packet.key.remoteJid || "";
        return this.packet.participant || (this.self ? maid : romid);
    }

    /**
     * Check if the sender is the bot
     * @returns {boolean} Whether the sender is the bot
     */
    public get self(): boolean {
        return this.packet.key.fromMe || false;
    }

    /**
     * Get the name of the sender
     * @returns {string} The name of the sender
     */
    public get name(): string {
        return this.packet.pushName || this.id.split("@")[0] as string;
    }

    /**
     * Send message to the sender
     * @param content Content of the message
     * @param misc Any additional options for the message
     */
    public async send(content: string | AnyMessageContent, misc: MiscMessageGenerationOptions = {}) {
        if (typeof content === "string") 
            this.socket.sendMessage(this.id, { text: content }, misc );
        else 
            this.socket.sendMessage(this.id, content, misc);
    }
}

export class MediaMessage {
    constructor(private packet: WAMessage) {}

    public get type(): MediaType {
        return this.packet.message?.imageMessage ? MediaType.Image
            : this.packet.message?.videoMessage ? MediaType.Video
            : this.packet.message?.audioMessage ? MediaType.Audio
            : this.packet.message?.documentMessage ? MediaType.Document
            : this.packet.message?.stickerMessage ? MediaType.Sticker
            : MediaType.Unknown;
    }

    public async download(): Promise<Buffer> {
        if (this.type === MediaType.Unknown) throw new Error("Unknown media type");
        return await downloadMediaMessage(this.packet, "buffer", {});
    }
}