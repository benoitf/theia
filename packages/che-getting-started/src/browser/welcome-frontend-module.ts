/*********************************************************************
 * Copyright (c) 2018 Red Hat, Inc.
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 **********************************************************************/

import { WelcomeContribution } from './welcome-contribution';
import { ContainerModule } from 'inversify';
import { WelcomeWidget } from './welcome-widget';
import { WidgetFactory, FrontendApplicationContribution, bindViewContribution } from '@theia/core/lib/browser';

import '../../src/browser/style/index.css';
import '../../src/browser/style/che-font.css';
import '../../src/browser/style/che-logo.svg';

export default new ContainerModule(bind => {
    bindViewContribution(bind, WelcomeContribution);
    bind(FrontendApplicationContribution).toService(WelcomeContribution);
    bind(WelcomeWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(context => ({
        id: WelcomeWidget.ID,
        createWidget: () => context.container.get<WelcomeWidget>(WelcomeWidget),
    })).inSingletonScope();
});
