
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

import { Emitter } from '@theia/core/lib/common/event';
import { RPCProtocolImpl } from '@theia/plugin-ext/lib/common/rpc-protocol';
import { PluginHostRPC } from '@theia/plugin-ext/lib/hosted/node/plugin-host-rpc';
import { PluginRemoteNodeImpl } from './plugin-remote-node-impl';
import { MAIN_REMOTE_RPC_CONTEXT } from '../common/plugin-remote-rpc';
console.log('PLUGIN_HOST_CUSTOM(' + process.pid + ') starting instance');

// override exit() function, to do not allow plugin kill this node
process.exit = function (code?: number): void {
    const err = new Error('An plugin call process.exit() and it was prevented.');
    console.warn(err.stack);
} as (code?: number) => never;

// same for 'crash'(works only in electron)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const proc = process as any;
if (proc.crash) {
    proc.crash = function (): void {
        const err = new Error('An plugin call process.crash() and it was prevented.');
        console.warn(err.stack);
    };
}

process.on('uncaughtException', (err: Error) => {
    console.error(err);
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const unhandledPromises: Promise<any>[] = [];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    unhandledPromises.push(promise);
    setTimeout(() => {
        const index = unhandledPromises.indexOf(promise);
        if (index >= 0) {
            promise.catch(err => {
                unhandledPromises.splice(index, 1);
                console.error(`Promise rejection not handled in one second: ${err} , reason: ${reason}`);
                if (err && err.stack) {
                    console.error(`With stack trace: ${err.stack}`);
                }
            });
        }
    }, 1000);
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
process.on('rejectionHandled', (promise: Promise<any>) => {
    const index = unhandledPromises.indexOf(promise);
    if (index >= 0) {
        unhandledPromises.splice(index, 1);
    }
});

const emitter = new Emitter();
const rpc = new RPCProtocolImpl({
    onMessage: emitter.event,
    send: (m: {}) => {
        if (process.send) {
            process.send(JSON.stringify(m));
        }
    }
});

process.on('message', (message: string) => {
    try {
        emitter.fire(JSON.parse(message));
    } catch (e) {
        console.error(e);
    }
});


const pluginHostRPC = new PluginHostRPC(rpc);
const pluginRemoteBrowser = rpc.getProxy(MAIN_REMOTE_RPC_CONTEXT.PLUGIN_REMOTE_BROWSER);
const pluginRemoteNodeImplt = new PluginRemoteNodeImpl(pluginRemoteBrowser);
rpc.set(MAIN_REMOTE_RPC_CONTEXT.PLUGIN_REMOTE_NODE, pluginRemoteNodeImplt);

console.log('pluginHostRPC.initialize......');
pluginHostRPC.initialize();

const pluginManager = (pluginHostRPC as any).pluginManager;


pluginRemoteNodeImplt.setPluginManager(pluginManager);


