import { HostedPluginSupport, PluginHost, PluginContributions } from '@theia/plugin-ext/lib/hosted/browser/hosted-plugin';
import { DisposableCollection } from '@theia/core';
import { injectable } from 'inversify';
import { RPCProtocol } from '@theia/plugin-ext/lib/common/rpc-protocol';
import { MAIN_REMOTE_RPC_CONTEXT } from '../common/plugin-remote-rpc';
import { PluginRemoteBrowserImpl } from '../node/plugin-remote-browser-impl';
import { DeployedPlugin } from '@theia/plugin-ext/src/common';

@injectable()
export class BrowseRemoteHostedPluginSupport extends HostedPluginSupport {

    private rpcs: Map<string, RPCProtocol>;
    private contributionsByHost: Map<PluginHost, PluginContributions[]>;
    private pluginRemoteBrowser: PluginRemoteBrowserImpl;

    constructor() {
        super();
        this.rpcs = new Map<string, RPCProtocol>();
        this.pluginRemoteBrowser = new PluginRemoteBrowserImpl(this.rpcs, this.contributionsByHost);
    }

    protected initRpc(host: PluginHost, pluginId: string): RPCProtocol {
        console.log('inside the browser hosted plugin support initRpc', this.contributionsByHost);

        const rpc = super.initRpc(host, pluginId);
        rpc.set(MAIN_REMOTE_RPC_CONTEXT.PLUGIN_REMOTE_BROWSER, this.pluginRemoteBrowser);
        this.rpcs.set(host, rpc);

        const pluginRemoteExt = rpc.getProxy(MAIN_REMOTE_RPC_CONTEXT.PLUGIN_REMOTE_NODE);

        // get all plugins that are not for a given host
        const externalPlugins: DeployedPlugin[] = [];
        Array.from(this.contributionsByHost.keys()).forEach((pluginHost) => {

            if (host !== pluginHost) {
                const contribs: PluginContributions[] = this.contributionsByHost.get(pluginHost)!;
                return contribs.forEach(contrib => {
                    externalPlugins.push(contrib.plugin);
                })
            }
        })
        pluginRemoteExt.$initExternalPlugins(externalPlugins);

        return rpc;
    }

    protected async startPlugins(contributionsByHost: Map<PluginHost, PluginContributions[]>, toDisconnect: DisposableCollection): Promise<void> {
        this.contributionsByHost = contributionsByHost;


        Array.from(this.contributionsByHost.values()).map(element => {
            element.map((pluginContribution: PluginContributions) => {
                const host = pluginContribution.plugin.metadata.host;
                const id = pluginContribution.plugin.metadata.model.id;
                this.pluginRemoteBrowser.addMapping(id, host);
            });
        });


        console.log('inside the browser hosted plugin support startPlugins', contributionsByHost);
        return super.startPlugins(contributionsByHost, toDisconnect);
    }

}
