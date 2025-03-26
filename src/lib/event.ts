export class EventEmitter<T extends Record<keyof T, (...args: any[]) => void>> {
    private listeners: { [key in keyof T]?: Array<T[key]> } = {};

    public on<K extends keyof T>(name: K, listener: T[K]) {
        if (!this.listeners[name])
            this.listeners[name] = [];
        this.listeners[name].push(listener);
    }

    public off<K extends keyof T>(name: K, listener: T[K]) {
        if (this.listeners[name])
            this.listeners[name] = this.listeners[name].filter(l => l !== listener);
    }

    public emit<K extends keyof T>(name: K, ...parameters: Parameters<T[K]>) {
        if (this.listeners[name])
            this.listeners[name].forEach(l => l(...parameters));
    }
}
