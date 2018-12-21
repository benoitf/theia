/*********************************************************************
 * Copyright (c) 2018 Red Hat, Inc.
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 **********************************************************************/

import * as React from 'react';
import { injectable, inject, postConstruct } from 'inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { CommandRegistry } from '@theia/core/lib/common';
import { WorkspaceCommands } from '@theia/workspace/lib/browser';
import { CommonCommands, PrefixQuickOpenService, KeybindingRegistry } from '@theia/core/lib/browser';
import { isOSX } from '@theia/core';
import { KeymapsCommands } from '@theia/keymaps/lib/browser';
import { GitViewContribution, GIT_COMMANDS } from '@theia/git/lib/browser/git-view-contribution';

const imageSrc = require('../../src/browser/style/che-logo.svg');

@injectable()
export class WelcomeWidget extends ReactWidget {

    static readonly ID = 'che.welcome.widget';
    static readonly LABEL = 'Welcome';

    static readonly ECLIPSE_CHE = 'Eclipse Che';
    static readonly ECLIPSE_CHE_SUBTITLE = 'Welcome To Your Cloud Developer Workspace ';

    static readonly DOCUMENTATION = 'https://www.eclipse.org/che/docs/che-7';
    static readonly MATTERMOST = 'https://mattermost.eclipse.org/eclipse/channels/eclipse-che';


    @inject(CommandRegistry)
    private readonly commandRegistry: CommandRegistry;

    @inject(PrefixQuickOpenService)
    private readonly quickOpenService: PrefixQuickOpenService;

    @inject(KeybindingRegistry)
    private readonly keybindings: KeybindingRegistry;

    @postConstruct()
    protected async init(): Promise<void> {
        this.id = WelcomeWidget.ID;
        this.title.label = WelcomeWidget.LABEL;
        this.title.caption = WelcomeWidget.LABEL;
        // add Eclipse Che icon
        this.title.iconClass = 'chefont cheico-logo';
        this.title.closable = true;

        this.update();
    }

    protected render(): React.ReactNode {
        return <div className='che-welcome-container'>
            {this.renderHeader()}
            <div className='flex-grid'>
                <div className='col'>
                    {this.renderStart()}
                </div>
            </div>
            <div className='flex-grid'>
                <div className='col'>
                    {this.renderOpen()}
                </div>
            </div>
            <div className='flex-grid'>
                <div className='col'>
                    {this.renderSettings()}
                </div>
            </div>
            <div className='flex-grid'>
                <div className='col'>
                    {this.renderHelp()}
                </div>
            </div>
        </div>;
    }

    private renderHeader(): React.ReactNode {
        return <div className='che-welcome-header'>
            <div className="che-welcome-header-title"><div className="svg-container"><img src={String(imageSrc)} /></div>{WelcomeWidget.ECLIPSE_CHE}</div>
            <span className='che-welcome-header-subtitle'>{WelcomeWidget.ECLIPSE_CHE_SUBTITLE}</span>
        </div>;
    }


    private renderCommandKeyBinding(commandId: string) {


        const availableKeys = this.keybindings.getKeybindingsForCommand(commandId);

        if (availableKeys.length > 0) {
            const keybindingSeperator = /<match>\+<\/match>/g;
            const regex = new RegExp(keybindingSeperator);
            let keybinding = availableKeys[0].keybinding;

            keybinding = keybinding.replace(regex, '+');
            const keys = keybinding.split('+');
            if (keys.length > 0) {
                let rows: any[] = [];
                keys.forEach(key => {
                    let updatedKey = key;
                    if (isOSX) {
                        if (updatedKey === 'ctrlcmd') {
                            updatedKey = '⎇';
                        } else if (updatedKey === 'alt') {
                            updatedKey = '⌘';
                        }
                    }
                    rows.push(<span className="monaco-keybinding-key">{updatedKey}</span>);
                })
                const ret = <div className="monaco-keybinding" title={availableKeys[0].keybinding}>{rows}</div>;
                return ret;
            }

        }
        return '';
    }

    private renderStart(): React.ReactNode {
        const newFile = <div className="che-welcome-command-desc"><a href='#' onClick={this.doNewFile}>New File...</a>{this.renderCommandKeyBinding(WorkspaceCommands.NEW_FILE.id)}</div>;
        const clone = <div className="che-welcome-command-desc"><a href='#' onClick={this.doGitClone}>Git Clone...</a>{this.renderCommandKeyBinding(GIT_COMMANDS.CLONE.id)}</div>;
        return <div className='che-welcome-section'>
            <h3 className='che-welcome-section-header'><i className='fa fa-file'></i>New</h3>
            <div className='che-welcome-action-container'>
                {newFile}
            </div>
            <div className='che-welcome-action-container'>
                {gitClone}
            </div>

        </div>;

    }

    private renderOpen(): React.ReactNode {
        const open = <div className="che-welcome-command-desc"><a href='#' onClick={this.doOpen}>Open Files...</a>{this.renderCommandKeyBinding(WorkspaceCommands.OPEN.id)}</div>;
        const openCommandPalette = <div className="che-welcome-command-desc"><a href='#' onClick={this.doOpenCommandPalette}>Open Command Palette...</a><div className="monaco-keybinding" title="F1"><span className="monaco-keybinding-key">F1</span></div></div>;
        return <div className='che-welcome-section'>
            <h3 className='che-welcome-section-header'><i className='fa fa-folder-open'></i>Open</h3>
            <div className='che-welcome-action-container'>
                {open}
            </div>
            <div className='che-welcome-action-container'>
                {openCommandPalette}
            </div>

        </div>;

    }

    private renderSettings(): React.ReactNode {
        return <div className='che-welcome-section'>
            <h3 className='che-welcome-section-header'>
                <i className='fa fa-cog'></i>
                Settings
            </h3>
            <div className='che-welcome-action-container'>
                <div className="che-welcome-command-desc">
                    <a href='#' onClick={this.doOpenPreferences}>Open Preferences</a>{this.renderCommandKeyBinding(CommonCommands.OPEN_PREFERENCES.id)}
                </div>
            </div>
            <div className='che-welcome-action-container'>

                <div className="che-welcome-command-desc">
                    <a href='#' onClick={this.doOpenKeyboardShortcuts}>Open Keyboard Shortcuts</a>{this.renderCommandKeyBinding(KeymapsCommands.OPEN_KEYMAPS.id)}
                </div>
            </div>
        </div>;
    }

    private renderHelp(): React.ReactNode {
        return <div className='che-welcome-section'>
            <h3 className='che-welcome-section-header'>
                <i className='fa fa-question-circle'></i>
                Help
            </h3>
            <div className='che-welcome-action-container'>
                <a href={WelcomeWidget.DOCUMENTATION} target='_blank'>Documentation</a>
            </div>
            <div className='che-welcome-action-container'>
                <a href={WelcomeWidget.MATTERMOST} target='_blank'>Community chat</a>
            </div>
        </div>;
    }


    private doNewFile = () => this.commandRegistry.executeCommand(WorkspaceCommands.NEW_FILE.id);
    private doOpen = () => this.commandRegistry.executeCommand(WorkspaceCommands.OPEN.id);
    private doGitClone = () => this.commandRegistry.executeCommand(GIT_COMMANDS.CLONE.id);

    private doOpenCommandPalette = () => this.quickOpenService.open('>');
    private doOpenPreferences = () => this.commandRegistry.executeCommand(CommonCommands.OPEN_PREFERENCES.id);

    private doOpenKeyboardShortcuts = () => this.commandRegistry.executeCommand(KeymapsCommands.OPEN_KEYMAPS.id);
}
