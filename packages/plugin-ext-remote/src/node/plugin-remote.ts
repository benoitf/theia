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
import * as http from 'http';
import { Emitter } from '@theia/core/lib/common/event';
import { RPCProtocolImpl } from '@theia/plugin-ext/lib/api/rpc-protocol';
import { PluginHostRPC } from '@theia/plugin-ext/lib/hosted/node/plugin-host-rpc';

/**
 * Entry point of a Remote Endpoint. It is executed as a new separate nodejs process.
 * @author Florent Benoit
 */

// configured port number
const PLUGIN_PORT = parseInt(process.env.THEIA_PLUGIN_ENDPOINT_PORT || '2503');

// start websocket server
const WebSocketServerImpl = ws.Server;

// display message about process being started
console.log(`Theia Endpoint ${process.pid}/pid listening on port`, PLUGIN_PORT);
const webSocketServer = new WebSocketServerImpl({ port: PLUGIN_PORT });

interface CheckAliveWS extends ws {
    alive: boolean;
}

// check alive
const checkAliveTimeout = 30000;
webSocketServer.on('connection', (socket: CheckAliveWS, request: http.IncomingMessage) => {
    socket.alive = true;
    socket.on('pong', () => socket.alive = true);
    handleConnection(socket, request);
});
setInterval(() => {
    webSocketServer.clients.forEach((socket: CheckAliveWS) => {
        if (socket.alive === false) {
            return socket.terminate();
        }
        socket.alive = false;
        socket.ping();
    });
}, checkAliveTimeout);

// store session ID
let sessionId = 0;

/**
 * Wrapper for adding Message ID on every message that is sent.
 */
class WebSocketClient {

    public rpc: RPCProtocolImpl;
    public emitter: Emitter<any>;

    constructor(private readonly id: number, private socket: ws) {
    }

    public getIdentifier(): number {
        return this.id;
    }

    // message is a JSON entry
    send(message: any) {
        this.socket.send(JSON.stringify(message));
    }

}

// list of clients
const webSocketClients = new Map<number, WebSocketClient>();

// create a new client on top of socket
function newClient(id: number, socket: ws): WebSocketClient {
    const webSocketClient = new WebSocketClient(id, socket);
    const emitter = new Emitter();
    webSocketClient.emitter = emitter;
    webSocketClient.rpc = new RPCProtocolImpl({
        onMessage: emitter.event,
        // send messages to this client
        send: (m: {}) => {
            webSocketClient.send(m);
        }
    });
    const pluginHostRPC = new PluginHostRPC(webSocketClient.rpc);
    pluginHostRPC.initialize();
    return webSocketClient;
}

// Handle the connection received
function handleConnection(socket: ws, request: http.IncomingMessage): void {
    // create channel for discussing with this new client
    const channelId = sessionId++;
    const client = newClient(channelId, socket);
    webSocketClients.set(channelId, client);

    socket.on('error', err => {
    });

    socket.on('close', (code, reason) => {
        webSocketClients.clear();
    });

    socket.on('message', (data: ws.Data) => {
        for (const webSocketClient of webSocketClients.values()) {
            // send what is inside the message (wrapped message)
            try {
                webSocketClient.emitter.fire(JSON.parse(data.toString()));
            } catch (e) {
                console.error(e);
            }
        }
    });
}
