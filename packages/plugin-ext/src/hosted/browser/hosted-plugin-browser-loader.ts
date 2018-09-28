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

import { injectable, inject, interfaces, postConstruct } from 'inversify';
import { BrowserPluginLoader, PluginMetadata, HostedPluginServer, getPluginId } from '../../common/plugin-protocol';
import { PreferenceServiceImpl } from '@theia/core/lib/browser';
import { MAIN_RPC_CONTEXT } from '../../api/plugin-api';
import { setUpPluginApi } from '../../main/browser/main-context';
import { PluginWorker } from '../../main/browser/plugin-worker';
import { RPCProtocol, RPCProtocolImpl } from '../../api/rpc-protocol';
import { HostedPluginWatcher } from './hosted-plugin-watcher';

/**
 * Plugin loader that adds pluginID in every remote request
 */
@injectable()
export class BrowserPluginLoaderImpl implements BrowserPluginLoader {

    @inject(HostedPluginServer)
    private readonly server: HostedPluginServer;

    @inject(HostedPluginWatcher)
    private readonly watcher: HostedPluginWatcher;

    @inject(PreferenceServiceImpl)
    private readonly preferenceServiceImpl: PreferenceServiceImpl;

    private theiaReadyPromise: Promise<any>;

    @postConstruct()
    protected init(): void {
        this.theiaReadyPromise = Promise.all([this.preferenceServiceImpl.ready]);
    }

    loadPlugins(pluginsMetadata: PluginMetadata[], container: interfaces.Container, frontend: boolean, backend: boolean): void {
        this.theiaReadyPromise.then(() => {
            if (frontend) {
                const worker = new PluginWorker();
                const hostedExtManager = worker.rpc.getProxy(MAIN_RPC_CONTEXT.HOSTED_PLUGIN_MANAGER_EXT);
                hostedExtManager.$init({ plugins: pluginsMetadata });
                setUpPluginApi(worker.rpc, container);
            }

            if (backend) {
                // create one RPC per plugin to be able so remote plug-ins can be in different context
                pluginsMetadata.forEach(pluginMetadata => {
                    const rpc = this.createServerRpc(pluginMetadata);
                    const hostedExtManager = rpc.getProxy(MAIN_RPC_CONTEXT.HOSTED_PLUGIN_MANAGER_EXT);
                    hostedExtManager.$init({ plugins: [pluginMetadata] });
                    setUpPluginApi(rpc, container);
                });
            }
        });
    }

    private createServerRpc(pluginMetadata: PluginMetadata): RPCProtocol {
        return new RPCProtocolImpl({
            onMessage: this.watcher.onPostMessageEvent,
            send: message => {
                const pluginID = getPluginId(pluginMetadata.model);
                const wrappedMessage: any = {};
                wrappedMessage['pluginID'] = pluginID;
                wrappedMessage['content'] = message;
                this.server.onMessage(JSON.stringify(wrappedMessage));
            }
        });
    }

}
