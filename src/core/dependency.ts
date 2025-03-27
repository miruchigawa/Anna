export type ServiceValue = any;

export class Services {
    private services = new Map<string, ServiceValue>();

    public register(name: string, service: ServiceValue) {
        // console.log(`Registering service ${name}`);
        this.services.set(name, service);
    }

    public take(name: string): ServiceValue {
        // console.log(`Taking service ${name}`);
        if (this.services.has(name)) 
            return this.services.get(name) as ServiceValue;
        else
            throw new Error("Services not found!");
    }

}

export class AppBuilder {
    private services = new Services();

    public async configureService(configure: (services: Services) => Promise<void>): Promise<this> {
        await configure(this.services);
        return this;
    }

    public build(): Services {
        return this.services;
    }
}