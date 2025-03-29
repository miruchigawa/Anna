import { expect, test, describe, beforeEach, mock } from "bun:test";
import { Services, AppBuilder } from "./dependency";

class Logger {
    constructor(public name: string = "default") {}
    log(message: string) { return `[${this.name}] ${message}`; }
}

class Database {
    constructor(public connectionString: string) {}
    connect() { return `Connected to ${this.connectionString}`; }
}

class RequestContext {
    id: number;
    constructor() {
        this.id = Math.floor(Math.random() * 1000);
    }
}

describe("Services Container", () => {
    let services: Services;
    
    beforeEach(() => {
        services = new Services();
    });
    
    test("addSingleton registers a service", () => {
        const logger = new Logger();
        services.addSingleton("logger", logger);
        
        const result = services.getRequiredService("logger");
        expect(result).toBe(logger);
    });
    
    test("getRequiredService throws when service not found", () => {
        expect(() => services.getRequiredService("nonexistent")).toThrow("Service 'nonexistent' not found!");
    });
    
    test("getService returns undefined when service not found", () => {
        const result = services.getService("nonexistent");
        expect(result).toBeUndefined();
    });
    
    test("singleton factory creates instance once", () => {
        const mockFactory = mock(() => new Logger("factory"));
        
        services.addSingletonFactory("logger", mockFactory);
        
        const result1 = services.getRequiredService("logger");
        const result2 = services.getRequiredService("logger");
        
        expect(mockFactory).toHaveBeenCalledTimes(1);
        expect(result1).toBe(result2);
    });
    
    test("transient service creates new instance each time", () => {
        let counter = 0;
        services.addTransient("counter", () => ({ value: counter++ }));
        
        const result1 = services.getRequiredService("counter") as { value: number };
        const result2 = services.getRequiredService("counter") as { value: number };
        
        expect(result1.value).toBe(0);
        expect(result2.value).toBe(1);
        expect(result1).not.toBe(result2);
    });
    
    test("scoped service reuses instance within scope", () => {
        services.addScoped("context", () => new RequestContext());
        
        const scope1 = services.createScope();
        const context1A = scope1.getRequiredService<RequestContext>("context");
        const context1B = scope1.getRequiredService<RequestContext>("context");
        
        const scope2 = services.createScope();
        const context2 = scope2.getRequiredService<RequestContext>("context");
        
        expect(context1A).toBe(context1B);
        expect(context1A).not.toBe(context2);
    });
    
    test("scopes inherit services from parent", () => {
        const parentLogger = new Logger("parent");
        services.addSingleton("logger", parentLogger);
        
        const scope = services.createScope();
        const scopedLogger = scope.getRequiredService("logger");
        
        expect(scopedLogger).toBe(parentLogger);
    });
    
    test("scopes can override parent services", () => {
        services.addSingleton("logger", new Logger("parent"));
        
        const scope = services.createScope();
        const scopedLogger = new Logger("scoped");
        scope.addSingleton("logger", scopedLogger);
        
        const result = scope.getRequiredService("logger");
        
        expect(result).toBe(scopedLogger);
        expect(result).not.toBe(services.getRequiredService("logger"));
    });
});

describe("AppBuilder", () => {
    test("configure registers services", () => {
        const builder = new AppBuilder();
        
        builder.configure(services => {
            services.addSingleton("logger", new Logger());
        });
        
        const services = builder.build();
        const logger = services.getRequiredService("logger");
        
        expect(logger).toBeInstanceOf(Logger);
    });
    
    test("configureService supports async configuration", async () => {
        const builder = new AppBuilder();
        
        await builder.configureService(async (services) => {
            const config = await Promise.resolve({ dbConnection: "test-db" });
            services.addSingleton("database", new Database(config.dbConnection));
        });
        
        const services = builder.build();
        const db = services.getRequiredService("database") as Database;
        
        expect(db.connectionString).toBe("test-db");
    });
});
