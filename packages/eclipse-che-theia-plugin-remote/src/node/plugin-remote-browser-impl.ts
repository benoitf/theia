import { PluginRemoteBrowser, MAIN_REMOTE_RPC_CONTEXT } from '../common/plugin-remote-rpc';
import { PluginHost, PluginContributions } from '@theia/plugin-ext/lib/hosted/browser/hosted-plugin';
import { RPCProtocol } from '@theia/plugin-ext/lib/common/rpc-protocol';
import { ConfigStorage, PluginPackage } from '@theia/plugin-ext/lib/common';

export class PluginRemoteBrowserImpl implements PluginRemoteBrowser {

    private mappingPluginHost: Map<string, string>;

    constructor(private readonly rpcs: Map<string, RPCProtocol>, private readonly contributionsByHost: Map<PluginHost, PluginContributions[]>) {
        this.mappingPluginHost = new Map();
    }

    public addMapping(pluginID: string, host: string) {
        console.log(`Adding mapping of plugin Id ${pluginID} to host ${host}`);
        this.mappingPluginHost.set(pluginID, host);
    }

    async $loadPlugin(pluginId: string, configStorage: ConfigStorage): Promise<void> {

        const matchingHost = this.mappingPluginHost.get(pluginId);
        if (matchingHost) {
            const rpc = this.rpcs.get(matchingHost)!;
            console.log('rpc is', rpc);
            const nodeRemote = rpc.getProxy(MAIN_REMOTE_RPC_CONTEXT.PLUGIN_REMOTE_NODE);
            console.log('calling nodeRemote....', pluginId);
            await nodeRemote.$loadPlugin(pluginId, configStorage);
            console.log('end of calling nodeRemote.loadPlugin');
        }


        console.log('loadPlugin with RPC', this.rpcs, this.contributionsByHost);
    }


    async $activatePlugin(pluginId: string): Promise<void> {

        const matchingHost = this.mappingPluginHost.get(pluginId);
        if (matchingHost) {
            const rpc = this.rpcs.get(matchingHost)!;
            const nodeRemote = rpc.getProxy(MAIN_REMOTE_RPC_CONTEXT.PLUGIN_REMOTE_NODE);
            await nodeRemote.$activatePlugin(pluginId);
            console.log('end of calling nodeRemote.$activatePlugin');
        }
    }

    async $callMethod(pluginId: string, entryName: string, ...args: any[]): Promise<any> {

        const matchingHost = this.mappingPluginHost.get(pluginId);
        if (matchingHost) {
            const rpc = this.rpcs.get(matchingHost)!;
            const nodeRemote = rpc.getProxy(MAIN_REMOTE_RPC_CONTEXT.PLUGIN_REMOTE_NODE);
            console.log('PluginBrowser calling method  with args ' + args + ' with args.length=' + args.length);
            return nodeRemote.$callMethod(pluginId, entryName, ...args);
        }
        throw new Error(`No matching host for the plugin with id ${pluginId}`);

    }

    async $definePluginExports(pluginId: string, proxyNames: string[]): Promise<void> {

        this.getOtherHosts(pluginId).map(async host => {
            const rpc = this.rpcs.get(host)!;
            console.log(`broadcasting the definePlugin exports to host ${host} : ${proxyNames}`);
            const nodeRemote = rpc.getProxy(MAIN_REMOTE_RPC_CONTEXT.PLUGIN_REMOTE_NODE);
            await nodeRemote.$definePluginExports(pluginId, proxyNames);
            console.log('end of calling nodeRemote.definePluginExports');

        })

    }


    async $definePluginPackage(pluginId: string, pluginPackage: PluginPackage): Promise<void> {
        this.getOtherHosts(pluginId).map(async host => {
            const rpc = this.rpcs.get(host)!;
            console.log(`broadcasting the definePluginPackage to host ${host}`);
            const nodeRemote = rpc.getProxy(MAIN_REMOTE_RPC_CONTEXT.PLUGIN_REMOTE_NODE);
            await nodeRemote.$definePluginPackage(pluginId, pluginPackage);
            console.log('end of calling nodeRemote.definePluginPackage');
        })
    }


    /**
     * Provides all hosts that are not where the plugin is hosted.
     */
    protected getOtherHosts(pluginId: string): string[] {
        const matchingHost = this.mappingPluginHost.get(pluginId);
        if (matchingHost) {
            return Array.from(this.rpcs.keys()).filter(host => host !== matchingHost);
        } else {
            return [];
        }
    }


}
