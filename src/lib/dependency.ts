export type ServiceValue = any;
export type ServiceExtension = (services: Services) => void;

export enum ServiceLifetime {
    Singleton,
    Scoped,
    Transient
}

interface ServiceDescriptor {
    implementation: ServiceValue;
    lifetime: ServiceLifetime;
    factory?: () => ServiceValue;
}

export class Services {
    private services = new Map<string, ServiceDescriptor>();
    private scopedInstances = new Map<string, ServiceValue>();
    private parent?: Services;

    constructor(parent?: Services) {
        this.parent = parent;
    }
    /**
     * Register a singleton service.
     * The same instance will be used for all requests.
     * @param name Service name to register
     * @param service Service instance
     * @example
     * ```typescript
     * services.addSingleton("myService", new MyService());
     * ```typescript
     */
    public addSingleton(name: string, service: ServiceValue) {
        this.services.set(name, {
            implementation: service,
            lifetime: ServiceLifetime.Singleton
        });
    }

    /**
     * Register a service with a singleton lifetime.
     * This means the same instance will be used for all requests.
     * This only initializes the service when it is first requested.
     * @param name The name of the service to register.
     * @param factory  A function that creates the service instance.
     * @example
     * ```typescript
     * services.addSingletonFactory("mySingletonService", () => new MySingletonService());
     * ```
     */
    public addSingletonFactory(name: string, factory: () => ServiceValue) {
        this.services.set(name, {
            implementation: null,
            lifetime: ServiceLifetime.Singleton,
            factory
        });
    }

    /**
     * Register a service with a transient lifetime.
     * This means a new instance will be created each time the service is requested.
     * @param name The name of the service to register.
     * @param factory A function that creates the service instance.
     * @example
     * ```typescript
     * services.addTransient("myTransientService", () => new MyTransientService());
     * ```
     */
    public addTransient(name: string, factory: () => ServiceValue) {
        this.services.set(name, {
            implementation: null,
            lifetime: ServiceLifetime.Transient,
            factory
        });
    }

    /**
     * Register a service with a scoped lifetime.
     * This means a new instance will be created for each scope.
     * @param name The name of the service to register.
     * @param factory A function that creates the service instance.
     * @example
     * ```typescript
     * services.addScoped("myScopedService", () => new MyScopedService());
     * ```
     */
    public addScoped(name: string, factory: () => ServiceValue) {
        this.services.set(name, {
            implementation: null,
            lifetime: ServiceLifetime.Scoped,
            factory
        });
    }

    /**
     * Get a required service by name. Throws if the service is not found.
     * @param name The name of the service to retrieve.
     * @return The service instance.
     * @example
     * ```typescript
     * const myService = services.getRequiredService<MyService>("myService");
     * ```
     */
    public getRequiredService<T>(name: string): T {
        if (this.services.has(name)) {
            const descriptor = this.services.get(name) as ServiceDescriptor;
            
            switch (descriptor.lifetime) {
                case ServiceLifetime.Singleton:
                    if (descriptor.factory && !descriptor.implementation) {
                        descriptor.implementation = descriptor.factory();
                    }
                    return descriptor.implementation;
                
                case ServiceLifetime.Transient:
                    return descriptor.factory ? descriptor.factory() : descriptor.implementation;
                
                case ServiceLifetime.Scoped:
                    if (!this.scopedInstances.has(name)) {
                        this.scopedInstances.set(name, descriptor.factory ? descriptor.factory() : descriptor.implementation);
                    }
                    return this.scopedInstances.get(name) as T;
            }
        }
        
        if (this.parent) {
            return this.parent.getRequiredService(name);
        }

        throw new Error(`Service '${name}' not found!`);
    }

    /**
     * Get a service by name. Returns undefined if the service is not found.
     * @param name The name of the service to retrieve.
     * @returns The service instance or undefined if not found.
     * @example
     * ```typescript
     * const myService = services.getService("myService");
     * if (myService) {
     *    // Use the service
     * }
     * ```
     */
    public getService(name: string): ServiceValue | undefined {
        try {
            return this.getRequiredService(name);
        } catch {
            return undefined;
        }
    }

    /**
     * Create a new scope for the services.
     * This allows you to create a new set of services that are isolated from the parent scope.
     * This is useful for creating a new context for a request or a specific operation.
     * @return A new instance of {@link Services} that is a child of the current instance.
     * @example
     * ```typescript
     * const scope = services.createScope();
     * const myScopedService = scope.getRequiredService<MyScopedService>("myScopedService");
     * // Use the scoped service
     * ```
    */
    public createScope(): Services {
        const scope = new Services(this);
        scope.services = new Map(this.services);
        return scope;
    }
}

export class AppBuilder {
    private services = new Services();

    /**
     * Initialize the AppBuilder with a function that configures the services.
     * @param configure A function that takes a {@link Services} instance and configures it.
     * This function is called with the {@link Services} instance as an argument.
     * @returns This instance of {@link AppBuilder} for method chaining.
     * @example
     * ```typescript
     * const builder = new AppBuilder();
     * await builder.configureService(async services => {
     *    const socket = new Socket({ session: await useMultiFileAuthState("session") });
     *   services.addSingleton("socket", socket);
     *   services.addSingleton("log", pino({ level: "info", transport: { target: "pino-pretty", options: pinoConfig } }));
     *   services.addSingleton("app", new AppService(services));
     * });
     * * const services = builder.build();
     * * const app = services.getRequiredService<AppService>("app");
     * * app.start();
     * ```
     */
    public async configureService(configure: (services: Services) => Promise<void>): Promise<this> {
        await configure(this.services);
        return this;
    }

    /**
     * Initialize the AppBuilder with a function that configures the services.
     * @param configure A function that takes a {@link Services} instance and configures it.
     * This function is called with the {@link Services} instance as an argument.
     * @returns  This instance of {@link AppBuilder} for method chaining.
     * @example
     * ```typescript
     * const builder = new AppBuilder();
     * builder.configure(services => {
     * service.addSingleton("logger", new Logger());
     * });
     *  const services = builder.build();
     *  const logger = services.getRequiredService("logger");
     *  logger.info("Logger is configured!");
     * ```
     */
    public configure(configure: (services: Services) => void): this {
        configure(this.services);
        return this;
    }

    public build(): Services {
        return this.services;
    }
}

