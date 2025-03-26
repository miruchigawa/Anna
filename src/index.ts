import { useMultiFileAuthState } from "@whiskeysockets/baileys";

import { Socket } from "anna/core/socket";

const socket = new Socket({
    session: await useMultiFileAuthState("session"),
});

socket.on("message", async () => {
    console.log("Kontol");
});

socket.start();
