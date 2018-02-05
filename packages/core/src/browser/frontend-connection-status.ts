/*
 * Copyright (C) 2018 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { inject, injectable, optional } from 'inversify';
import { Endpoint } from './endpoint';
import { ILogger } from '../common/logger';
import { AbstractDialog } from './dialogs';
import { Event, Emitter } from '../common/event';
import { MessageService } from '../common/message-service';
import { StatusBar, StatusBarAlignment } from './status-bar/status-bar';
import { FrontendApplicationContribution, DefaultFrontendApplicationContribution } from './frontend-application';

/**
 * Service for listening on backend connection changes.
 */
export const ConnectionStatusService = Symbol('ConnectionStatusService');
export interface ConnectionStatusService {

    /**
     * The actual connection state.
     */
    readonly currentState: ConnectionState;

    /**
     * Clients can listen on connection status change events.
     */
    readonly onStatusChange: Event<ConnectionStatusChangeEvent>;

}

/**
 * Connection status change event.
 */
export interface ConnectionStatusChangeEvent {

    /**
     * The current state of the connection.
     */
    readonly state: ConnectionState,

    /**
     * Optional health, percentage number.
     */
    readonly health?: number

}

/**
 * The connection-status states.
 */
export enum ConnectionState {
    ONLINE,
    OFFLINE
}

@injectable()
export class ConnectionStatusOptions {

    static DEFAULT: ConnectionStatusOptions = {
        requestTimeout: 1000,
        retry: 5,
        retryInterval: 1000,
    };

    /**
     * Timeout for the HTTP GET request in milliseconds.
     */
    readonly requestTimeout: number;

    /**
     * Number of accepted timeouts.
     */
    readonly retry: number;

    /**
     * Retry interval in milliseconds.
     */
    readonly retryInterval: number;

}

@injectable()
export class FrontendConnectionStatusService implements ConnectionStatusService, FrontendApplicationContribution {

    static readonly MAX_RETRY_INTERVAL = 30000;

    protected readonly statusChangeEmitter: Emitter<ConnectionStatusChangeEvent>;
    private readonly endpointUrl: string;

    private connectionState: ConnectionStateMachine;
    private timer: number | undefined;
    private retryInterval: number;

    constructor(
        @inject(ConnectionStatusOptions) @optional() protected readonly options: ConnectionStatusOptions = ConnectionStatusOptions.DEFAULT,
        @inject(ILogger) protected readonly logger: ILogger
    ) {
        this.statusChangeEmitter = new Emitter<ConnectionStatusChangeEvent>();
        this.endpointUrl = new Endpoint().getRestUrl().toString();
        this.connectionState = new ConnectionStateMachine({ threshold: this.options.retry });
        this.retryInterval = this.options.retryInterval;
    }

    onStart() {
        this.schedule(this.checkAlive.bind(this));
        this.fireStatusChange(this.connectionState);
    }

    onStop() {
        if (this.timer !== undefined) {
            window.clearInterval(this.timer);
            this.timer = undefined;
        }
    }

    get onStatusChange() {
        return this.statusChangeEmitter.event;
    }

    get currentState() {
        return this.connectionState.state;
    }

    protected schedule(checkAlive: () => Promise<boolean>) {
        const tick = async () => {
            this.logger.debug(`Checking backend connection status. Scheduled an alive request with ${this.retryInterval} ms timeout.`);
            const success = await checkAlive();
            this.logger.debug(success ? `Connected to the backend.` : `Cannot reach the backend.`);
            const event = this.updateStatus(success);
            this.fireStatusChange(event);
            // In case of a timeout, we increase the execution (and not the connection) timeout.
            this.retryInterval = success ? this.options.retryInterval : Math.min(this.retryInterval * 2, FrontendConnectionStatusService.MAX_RETRY_INTERVAL);
            this.timer = window.setTimeout(tick, this.retryInterval);
        };
        this.timer = window.setTimeout(tick, this.retryInterval);
    }

    protected updateStatus(success: boolean): ConnectionStatusChangeEvent {
        this.connectionState = this.connectionState.next(success);
        return this.connectionState;
    }

    protected fireStatusChange(event: ConnectionStatusChangeEvent) {
        this.statusChangeEmitter.fire(event);
    }

    protected checkAlive(): Promise<boolean> {
        return new Promise<boolean>(resolve => {
            const handle = (success: boolean) => {
                return resolve(success);
            };
            const xhr = new XMLHttpRequest();
            xhr.timeout = this.options.requestTimeout;
            xhr.onreadystatechange = event => {
                const { readyState, status } = xhr;
                if (readyState === XMLHttpRequest.DONE) {
                    handle(status === 200);
                }
            };
            xhr.onerror = () => handle(false);
            xhr.ontimeout = () => handle(false);
            xhr.open('GET', `${this.endpointUrl}/alive`);
            try {
                xhr.send();
            } catch {
                handle(false);
            }
        });
    }

}

/**
 * Just in case we need to support a bit more sophisticated state transitions than having `online` and `offline`.
 * For instance, `pending`, `reconnecting`, etc...
 */
export class ConnectionStateMachine implements ConnectionStatusChangeEvent {

    private static readonly MAX_HISTORY = 100;

    public readonly health: number;

    constructor(
        private readonly props: { readonly threshold: number },
        public readonly state: ConnectionState = ConnectionState.ONLINE,
        private readonly history: boolean[] = []) {

        if (this.state === ConnectionState.OFFLINE) {
            this.health = 0;
        } else {
            this.health = this.history.length === 0 ? 100 : Math.round((this.history.filter(success => success).length / this.history.length) * 100);
        }
    }

    next(success: boolean): ConnectionStateMachine {
        const newHistory = this.updateHistory(success);
        // Initial optimism.
        let online = true;
        if (newHistory.length > this.props.threshold) {
            online = newHistory.slice(-this.props.threshold).some(s => s);
        }
        // Ideally, we do not switch back to online if we see any `true` items but, let's say, after three consecutive `true`s.
        return new ConnectionStateMachine(this.props, online ? ConnectionState.ONLINE : ConnectionState.OFFLINE, newHistory);
    }

    protected updateHistory(success: boolean) {
        const updated = [...this.history, success];
        if (updated.length > ConnectionStateMachine.MAX_HISTORY) {
            updated.shift();
        }
        return updated;
    }

}

@injectable()
export class ConnectionStatusStatusBarContribution extends DefaultFrontendApplicationContribution {

    constructor(
        @inject(ConnectionStatusService) protected readonly connectionStatusService: ConnectionStatusService,
        @inject(StatusBar) protected statusBar: StatusBar
    ) {
        super();
        this.connectionStatusService.onStatusChange(event => this.onStatusChange(event));
    }

    protected onStatusChange(event: ConnectionStatusChangeEvent) {
        this.statusBar.removeElement('connection-status');
        const text = `$(${this.getStatusIcon(event.health)})`;
        const tooltip = event.health ? `Online [Connection health: ${event.health}%]` : 'Offline';
        this.statusBar.setElement('connection-status', {
            alignment: StatusBarAlignment.RIGHT,
            text,
            priority: 0,
            tooltip
        });
    }

    private getStatusIcon(health: number | undefined) {
        if (health === undefined || health === 0) {
            return 'exclamation-circle';
        }
        if (health < 25) {
            return 'frown-o';
        }
        if (health < 50) {
            return 'meh-o';
        }
        return 'smile-o';
    }

}

@injectable()
export class ApplicationConnectionStatusContribution extends DefaultFrontendApplicationContribution {

    private dialog: ConnectionStatusDialog | undefined;
    private state = ConnectionState.ONLINE;

    constructor(
        @inject(ConnectionStatusService) protected readonly connectionStatusService: ConnectionStatusService,
        @inject(MessageService) protected readonly messageService: MessageService,
        @inject(ILogger) protected readonly logger: ILogger
    ) {
        super();
        this.connectionStatusService.onStatusChange(event => this.onStatusChange(event));
    }

    protected onStatusChange(event: ConnectionStatusChangeEvent): void {
        if (this.state !== event.state) {
            this.state = event.state;
            switch (event.state) {
                case ConnectionState.OFFLINE: {
                    const message = 'The application connection to the backend is lost. Attempting to reconnect...';
                    this.logger.error(message);
                    this.messageService.error(message);
                    this.getOrCreateDialog().open();
                    break;
                }
                case ConnectionState.ONLINE: {
                    const message = 'Successfully reconnected to the backend.';
                    this.logger.info(message);
                    this.messageService.info(message);
                    if (this.dialog !== undefined) {
                        this.dialog.dispose();
                        this.dialog = undefined;
                    }
                    break;
                }
            }
        }
    }

    protected getOrCreateDialog(): ConnectionStatusDialog {
        if (this.dialog === undefined) {
            this.dialog = new ConnectionStatusDialog();
        }
        return this.dialog;
    }

}

export class ConnectionStatusDialog extends AbstractDialog<void> {

    public readonly value: void;

    constructor() {
        super({ title: 'Not connected' });
        const textNode = document.createTextNode('The application connection to the backend is lost. Attempting to reconnect...');
        this.closeCrossNode.remove();
        this.contentNode.appendChild(textNode);
    }

    protected onAfterAttach() {
        // NOOP.
        // We need disable the key listener for escape and return so that the dialog cannot be closed by the user.
    }

}
