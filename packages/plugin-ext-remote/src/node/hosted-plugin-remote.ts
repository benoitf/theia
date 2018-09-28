/********************************************************************************
 * Copyright (C) 2018 Red Hat, Inc. and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/
import * as ws from 'ws';

import { injectable, inject, postConstruct } from 'inversify';
import { ILogger } from '@theia/core/lib/common';
import { HostedPluginClient } from '@theia/plugin-ext';

/**
 * Class handling remote connection for executing plug-ins.
 * @author Florent Benoit
 */
@injectable()
export class HostedPluginRemote {
    private client: HostedPluginClient;

    @inject(ILogger)
    protected readonly logger: ILogger;

    private endpoints: string[];

    // mapping between endpoint name and the websockets
    private endpointsSockets: Map<string, ws>;

    // mapping between plugin's id and the websocket endpoint
    private pluginsEndpoints: Map<string, string>;

    /**
     * Post construct setup. Parse ENV variables to grab endpoints.
     */
    @postConstruct()
    protected setup(): void {
        this.endpointsSockets = new Map<string, ws>();
        this.pluginsEndpoints = new Map<string, string>();

        // Grab endpoints from env var
        const endpointKeys: string[] = Object.keys(process.env).filter(key => key.startsWith('THEIA_PLUGIN_ENDPOINT_ADDRESS_'));
        this.endpoints = endpointKeys.map(key => process.env[key] || '');
        this.logger.info('Plugins Remote Endpoints are ', this.endpoints);

        const pluginEndpointKeys: string[] = Object.keys(process.env).filter(key => key.startsWith('THEIA_PLUGIN_ENDPOINT_MAPPING_'));
        pluginEndpointKeys.forEach(key => {
            this.pluginsEndpoints.set(key.substring('THEIA_PLUGIN_ENDPOINT_MAPPING_'.length), process.env[key] || '');
        });
        this.logger.info('Plugins Remote Endpoints are ', this.pluginsEndpoints);
    }

    /**
     * Called when a client is connecting to this endpoint
     */
    public setClient(client: HostedPluginClient): void {
        if (!this.client) {
            this.setupWebsocket();
        }
        this.client = client;
    }

    /**
     * Checks if the given pluginID has a remote endpoint
     */
    hasEndpoint(pluginID: string): boolean {
        return this.pluginsEndpoints.has(pluginID);
    }

    /**
     * Handle the creation of connection to remote endpoints.
     */
    setupWebsocket(): void {
        this.endpoints.forEach(endpointAdress => {
            if (endpointAdress) {
                const websocket = new ws(endpointAdress);
                this.endpointsSockets.set(endpointAdress, websocket);

                websocket.on('message', (messageRaw: any) => {
                    this.sendToClient(messageRaw);
                });
            }
        });
    }

    /**
     * Handle the mesage to remotely send to a ws endpoint
     * @param jsonMessage the given message
     */
    onMessage(jsonMessage: any): void {
        // do the routing depending on the plugin's endpoint
        const pluginId = jsonMessage.pluginID;

        // socket ?
        const endpoint = this.pluginsEndpoints.get(pluginId);
        if (!endpoint) {
            this.logger.error('no endpoint configured for the given plugin', pluginId, 'skipping message');
            return;
        }
        const websocket = this.endpointsSockets.get(endpoint);
        websocket!.send(JSON.stringify(jsonMessage.content));
    }

    /**
     * Send the given message back to the client
     * @param message the message to send
     */
    sendToClient(message: any) {
        if (this.client) {
            this.client.postMessage(message);
        }

    }

}
