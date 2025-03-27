import pino from "pino";
import { useMultiFileAuthState } from "@whiskeysockets/baileys";

import { Socket } from "anna/core/socket";
import { AppBuilder } from "anna/core/dependency";
import { AppService } from "anna/services/app";
import { pinoConfig } from "anna/constants/configure";

const builder = new AppBuilder();
await builder.configureService(async services => {
    const socket = new Socket({ 
        session: await useMultiFileAuthState("session")
    });
    services.register("socket", socket);
    services.register("log", pino({ level: "info", transport: { target: "pino-pretty", options: pinoConfig } }));
    services.register("app", new AppService(services));
});

const services = builder.build();

const app = services.take("app") as AppService;
app.start();
