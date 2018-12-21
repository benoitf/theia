/*********************************************************************
 * Copyright (c) 2018 Red Hat, Inc.
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 **********************************************************************/

import { injectable, inject } from 'inversify';
import { CommandRegistry, MenuModelRegistry } from '@theia/core/lib/common';
import { CommonMenus, AbstractViewContribution, FrontendApplicationContribution, FrontendApplication, OpenerService, OpenerOptions, OpenHandler } from '@theia/core/lib/browser';
import { WelcomeWidget } from './welcome-widget';
import { FrontendApplicationStateService } from '@theia/core/lib/browser/frontend-application-state';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { FileSystem, FileStat } from '@theia/filesystem/lib/common';
import URI from '@theia/core/lib/common/uri';

export const GettingStartedCommand = {
    id: WelcomeWidget.ID,
    label: WelcomeWidget.LABEL
};

@injectable()
export class WelcomeContribution extends AbstractViewContribution<WelcomeWidget> implements FrontendApplicationContribution {

    @inject(FrontendApplicationStateService)
    private readonly stateService: FrontendApplicationStateService;

    @inject(WorkspaceService)
    private readonly workspaceService: WorkspaceService;

    @inject(FileSystem)
    private readonly fileSystem: FileSystem;

    @inject(OpenerService)
    private readonly openerService: OpenerService;


    constructor() {
        super({
            widgetId: WelcomeWidget.ID,
            widgetName: WelcomeWidget.LABEL,
            defaultWidgetOptions: {
                area: 'main',
            }
        });
    }

    async onStart(app: FrontendApplication): Promise<void> {
        this.stateService.reachedState('ready').then(
            a => {
                this.handleReadmeFiles();
                this.openView({ reveal: true });
            }
        );
    }

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(GettingStartedCommand, {
            execute: () => this.openView({ reveal: true }),
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        menus.registerMenuAction(CommonMenus.HELP, {
            commandId: GettingStartedCommand.id,
            label: GettingStartedCommand.label,
            order: 'a10'
        });
    }


    async handleReadmeFiles(): Promise<void> {

        const roots = await this.workspaceService.roots;
        console.log('roots are', roots);
        // In case of only one workspace
        if (roots.length === 1) {
            const children = roots[0].children;
            console.log('only one children', children);
            // only one child
            if (children && children.length === 1) {
                // check for README files
                const fileStat = await this.fileSystem.getFileStat(children[0].uri);
                console.log('fileStat is', fileStat);
                if (fileStat) {
                    const subFolderFiles = fileStat.children;
                    console.log('subFolderFiles is', subFolderFiles);
                    if (subFolderFiles) {
                        const allMDsFiles = subFolderFiles.filter(item => item.uri.toLocaleLowerCase().endsWith('.md') && !item.isDirectory);
                        console.log('allMDsFiles is', allMDsFiles);
                        if (allMDsFiles.length > 0) {
                            const matchedFiles: Array<FileStat> = allMDsFiles.filter(file => {
                                console.log('file uri is', file.uri);
                                const tolower = file.uri.toLocaleLowerCase();
                                if (tolower.endsWith('readme.md')) {
                                    return true;
                                }
                                return false;
                            });
                            if (matchedFiles && matchedFiles.length > 0) {
                                // ok we have readme files
                                console.log('README file found is', matchedFiles[0].uri);
                                const options: OpenerOptions = { mode: 'activate' };
                                const opener: OpenHandler = await this.openerService.getOpener(new URI(matchedFiles[0].uri + '?open-handler=code-editor-preview'), options);
                                console.log('found opener being', opener);
                                await opener.open(new URI(matchedFiles[0].uri), options);
                                const openers: OpenHandler[] = await this.openerService.getOpeners(new URI(matchedFiles[0].uri), options);
                                console.log('found openers being', openers);
                            }
                        }
                    }
                }
            }
        }
    }
}
