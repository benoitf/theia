import { createProxyIdentifier } from '@theia/plugin-ext/lib/common/rpc-protocol';
import { DeployedPlugin, ConfigStorage, PluginPackage } from '@theia/plugin-ext/lib/common';



export interface PluginRemoteNode {
    $initExternalPlugins(externalPlugins: DeployedPlugin[]): Promise<void>;
    $loadPlugin(pluginId: string, configStorage: ConfigStorage): Promise<void>;
    $activatePlugin(pluginId: string): Promise<void>;
    $callMethod(pluginId: string, entryName: string, ...args: any[]): Promise<any>;
    $definePluginExports(pluginId: string, proxyNames: string[]): Promise<void>;
    $definePluginPackage(pluginId: string, rawModel: PluginPackage): Promise<void>;
}

export interface PluginRemoteBrowser {
    $loadPlugin(pluginID: string, configStorage: ConfigStorage): Promise<void>;
    $activatePlugin(pluginId: string): Promise<void>;
    $callMethod(pluginId: string, entryName: string, ...args: any[]): Promise<any>;
    $definePluginExports(pluginId: string, proxyNames: string[]): Promise<void>;
    $definePluginPackage(pluginId: string, rawModel: PluginPackage): Promise<void>;
}


export const MAIN_REMOTE_RPC_CONTEXT = {
    PLUGIN_REMOTE_NODE: createProxyIdentifier<PluginRemoteNode>('PluginRemoteNode'),
    PLUGIN_REMOTE_BROWSER: createProxyIdentifier<PluginRemoteBrowser>('PluginRemoteBrowser'),
}
