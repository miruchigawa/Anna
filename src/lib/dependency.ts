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

    public addSingleton(name: string, service: ServiceValue) {
        this.services.set(name, {
            implementation: service,
            lifetime: ServiceLifetime.Singleton
        });
    }

    public addSingletonFactory(name: string, factory: () => ServiceValue) {
        this.services.set(name, {
            implementation: null,
            lifetime: ServiceLifetime.Singleton,
            factory
        });
    }

    public addTransient(name: string, factory: () => ServiceValue) {
        this.services.set(name, {
            implementation: null,
            lifetime: ServiceLifetime.Transient,
            factory
        });
    }

    public addScoped(name: string, factory: () => ServiceValue) {
        this.services.set(name, {
            implementation: null,
            lifetime: ServiceLifetime.Scoped,
            factory
        });
    }

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

    public getService(name: string): ServiceValue | undefined {
        try {
            return this.getRequiredService(name);
        } catch {
            return undefined;
        }
    }

    public createScope(): Services {
        const scope = new Services(this);
        scope.services = new Map(this.services);
        return scope;
    }
}

export class AppBuilder {
    private services = new Services();

    public async configureService(configure: (services: Services) => Promise<void>): Promise<this> {
        await configure(this.services);
        return this;
    }

    public configure(configure: (services: Services) => void): this {
        configure(this.services);
        return this;
    }

    public build(): Services {
        return this.services;
    }
}

