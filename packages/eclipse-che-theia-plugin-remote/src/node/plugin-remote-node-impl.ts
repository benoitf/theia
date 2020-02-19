import * as deasync from 'deasync';
import { PluginRemoteNode, PluginRemoteBrowser } from '../common/plugin-remote-rpc';
import { DeployedPlugin, Plugin, ConfigStorage, PluginPackage } from '@theia/plugin-ext/lib/common';
import { PluginManagerExtImpl } from '@theia/plugin-ext/lib/plugin/plugin-manager';

export class PluginRemoteNodeImpl implements PluginRemoteNode {
    private pluginManager: PluginManagerExtImpl;

    private externalRegistry: Map<string, Plugin>;

    constructor(private readonly pluginRemoteBrowser: PluginRemoteBrowser) {
        this.externalRegistry = new Map<string, Plugin>();
    }


    setPluginManager(pluginManager: PluginManagerExtImpl) {
        this.pluginManager = pluginManager;

        const originalLoadPlugin = (pluginManager as any).loadPlugin;
        const originalActivatePlugin = (pluginManager as any).activatePlugin;
        const registry = this.externalRegistry;
        const pluginRemoteBrowser = this.pluginRemoteBrowser;
        (pluginManager as any).loadPlugin = async function loadPlugin(plugin: Plugin, configStorage: ConfigStorage, visited: any = new Set<string>()): Promise<boolean> {
            console.log('called overriden loadPlugin', plugin.model.id, visited);
            console.log('the keys of external registry are');

            console.log('the keys of external registry are', Array.from(registry.keys()));
            if (registry.has(plugin.model.id)) {
                console.log('---> In external registry then should call remote side....');
                await pluginRemoteBrowser.$loadPlugin(plugin.model.id, configStorage);
                console.log('asked the remote side, now continuing');
                return true;
            }

            console.log('not in external registry then callin original Load plugin method...');
            return originalLoadPlugin.call(this, plugin, configStorage, visited);
        };


        (pluginManager as any).activatePlugin = async function activatePlugin(pluginId: string): Promise<void> {
            if (registry.has(pluginId)) {
                console.log('---> activatePlugin : In external registry then should call remote side....');
                await pluginRemoteBrowser.$activatePlugin(pluginId);
                console.log('-->activatePlugin asked the remote side, now continuing');
                return;
            }
            console.log('---> activatePlugin : In local registry then call local method');
            return originalActivatePlugin.call(this, pluginId);
        }





    }


    async $loadPlugin(pluginId: string, configStorage: ConfigStorage): Promise<void> {
        console.log('PluginRemoteNodeImpl: loaading pluginID from external client', pluginId);

        const pluginManagerInternal = (this.pluginManager as any);
        const plugin = pluginManagerInternal.registry.get(pluginId);

        console.log('$loadPlugin in plugin remote node Impl: loadPlugin' + plugin);
        await pluginManagerInternal.loadPlugin(plugin, configStorage);

        const activatedPlugin = pluginManagerInternal.activatedPlugins.get(pluginId);
        console.log('$loadPlugin activated is', activatedPlugin);


        // share the JSON with others
        const rawModel = plugin.rawModel;
        this.pluginRemoteBrowser.$definePluginPackage(pluginId, rawModel);

        if (activatedPlugin && activatedPlugin.exports) {

            // do we have prototype ?
            const exported = activatedPlugin.exports;

            const prototype = Object.getPrototypeOf(exported);
            let proxyNames: Array<string> = [];
            if (prototype) {
                proxyNames = proxyNames.concat(Object.getOwnPropertyNames(prototype));
            }

            console.log('proxyNames = ', proxyNames);

            // ok now need to send that back only if there are some exports
            if (proxyNames.length > 0) {
                this.pluginRemoteBrowser.$definePluginExports(pluginId, proxyNames);
            }

            console.log('key4 = ', activatedPlugin.exports.registerEmployeeWithString);

        }

        console.log('$loadPlugin end of await');




    }


    async $activatePlugin(pluginId: string): Promise<void> {
        console.log('PluginRemoteNodeImpl: activatePlugin pluginID from external client', pluginId);

        const pluginManagerInternal = (this.pluginManager as any);
        console.log('$activatePlugin in plugin remote node Impl: activatePlugin' + pluginId);
        await pluginManagerInternal.activatePlugin(pluginId);
        console.log('$activatePlugin end of await');

    }


    async $definePluginPackage(pluginId: string, pluginPackage: PluginPackage): Promise<void> {
        console.log(`receive order to definePluginPackage for plugin ${pluginId}`);
        const plugin = (this.pluginManager as any).registry.get(pluginId);
        if (plugin) {
            plugin.rawModel = pluginPackage;
        }


    }

    deasyncPromise(promise: Promise<any>) {
        console.log('entering in deasyncPromise...')
        let result, error, done = false;
        promise.then((res) => {
            result = res;
            console.log('received the value of the result which is' + res);
        }, function (err) {
            error = err;
        }).then(function () {
            done = true;
        });
        deasync.loopWhile(() => { return !done; });
        if (error) {
            throw error;
        }
        console.log('end of deasync promise, returning' + result);
        return result;
    }

    async $definePluginExports(pluginId: string, proxyNames: string[]): Promise<void> {

        console.log(`receive order to definePluginExports for plugin ${pluginId} and proxy names in nodejs side ${proxyNames}`);
        const pluginManagerInternal = (this.pluginManager as any);

        // add into the activatedPlugins stuff

        //activatedPlugins = new Map<string, ActivatedPlugin>();

        // create a fake ActivatedPlugin if not there
        //et activatedPlugin = pluginManagerInternal.activatedPlugins.get(pluginId);
        const activatedPlugin: any = {};
        const proxyExports: any = {};
        activatedPlugin.exports = proxyExports;
        const remoteBrowser = this.pluginRemoteBrowser;
        const deasyncPromise = this.deasyncPromise;
        proxyNames.forEach(entryName => {
            console.log('add a proxy on top of ' + proxyExports + ' and add entry ' + entryName);
            proxyExports[entryName] = function (...args: any[]) {

                console.log('receive arguments' + args + ' args.length =' + args.length + ' for entryName ' + entryName);
                // remote call for this method
                const value = deasyncPromise(remoteBrowser.$callMethod(pluginId, entryName, ...args));
                console.log('after the call with deasync received the value', value);

                return value;
            }
        })

        pluginManagerInternal.activatedPlugins.set(pluginId, activatedPlugin);

        console.log('$activatePlugin in plugin remote node Impl: activatePlugin' + pluginId);
        await pluginManagerInternal.activatePlugin(pluginId);
        console.log('$activatePlugin end of await');


    }

    async $callMethod(pluginId: string, entryName: string, ...args: any[]): Promise<any> {
        const pluginManagerInternal = (this.pluginManager as any);
        const activatedPlugin = pluginManagerInternal.activatedPlugins.get(pluginId);
        const exports = activatedPlugin.exports;
        if (exports) {
            // call the entry
            console.log(`receive a call on exports for entry ${entryName} and with args ${args} and length ${args.length} and exports is ${exports}`);
            const result = exports[entryName](...args);
            console.log('result is' + result);
            return result;
        }
    }

    async $initExternalPlugins(externalPlugins: DeployedPlugin[]): Promise<void> {
        console.log('PluginRemoteNodeImpl.$initExternalPlugins', externalPlugins);
        const registry: Map<string, Plugin> = (this.pluginManager as any).registry;

        externalPlugins.map(deployedPlugin => {
            const modelId = deployedPlugin.metadata.model.id;

            // empty rawModel
            const rawModel: PluginPackage = <PluginPackage>{}

            const plugin = <Plugin>{
                pluginPath: deployedPlugin.metadata.model.entryPoint.backend,
                pluginFolder: deployedPlugin.metadata.model.packagePath,
                model: deployedPlugin.metadata.model,
                rawModel,
                lifecycle: deployedPlugin.metadata.lifecycle
            }
            registry.set(modelId, plugin);
            this.externalRegistry.has(modelId);
            this.externalRegistry.set(modelId, plugin);
            console.log('PluginRemoteNodeImpl.$initExternalPlugins adding plugin', modelId, plugin);
        });
    }

}
