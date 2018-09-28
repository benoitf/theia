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
import { injectable, inject } from 'inversify';
import { HostedPluginClient, ServerPluginRunner } from '@theia/plugin-ext/src/common/plugin-protocol';
import { HostedPluginRemote } from './hosted-plugin-remote';

/**
 * Proxy runner being a facade for loading plugins locally or remotely
 */
@injectable()
export class ServerPluginProxyRunner implements ServerPluginRunner {

    @inject(HostedPluginRemote)
    protected readonly hostedPluginRemote: HostedPluginRemote;

    private defaultRunner: ServerPluginRunner;

    public setDefault(defaultRunner: ServerPluginRunner): void {
        this.defaultRunner = defaultRunner;
    }

    public setClient(client: HostedPluginClient): void {
        this.hostedPluginRemote.setClient(client);
    }

    public acceptMessage(jsonMessage: any): boolean {
        return jsonMessage.pluginID !== undefined;
    }

    public onMessage(jsonMessage: any): void {
        // do routing on the message
        if (this.hostedPluginRemote.hasEndpoint(jsonMessage.pluginID)) {
            this.hostedPluginRemote.onMessage(jsonMessage);
        } else {
            this.defaultRunner.onMessage(jsonMessage.content);
        }

    }
}
