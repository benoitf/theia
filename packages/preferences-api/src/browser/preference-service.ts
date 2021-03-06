/*
 * Copyright (C) 2018 Ericsson and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { JSONExt } from '@phosphor/coreutils';
import { injectable, inject } from 'inversify';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { Event, Emitter, DisposableCollection, Disposable } from '@theia/core/lib/common';
import { PreferenceProvider } from './preference-provider';

export interface PreferenceChangedEvent {
    changes: PreferenceChange[]
}

export interface PreferenceChange {
    readonly preferenceName: string;
    readonly newValue?: any;
    readonly oldValue?: any;
}

export const PreferenceService = Symbol('PreferenceService');
export interface PreferenceService extends Disposable {
    readonly ready: Promise<void>;
    get<T>(preferenceName: string): T | undefined;
    get<T>(preferenceName: string, defaultValue: T): T;
    get<T>(preferenceName: string, defaultValue?: T): T | undefined;
    onPreferenceChanged: Event<PreferenceChange>;
}

export const PreferenceProviders = Symbol('PreferenceProvidersFactory');
export type PreferenceProviders = () => PreferenceProvider[];

@injectable()
export class PreferenceServiceImpl implements PreferenceService, FrontendApplicationContribution {

    protected preferences: { [key: string]: any } = {};

    protected readonly toDispose = new DisposableCollection();
    protected readonly onPreferenceChangedEmitter = new Emitter<PreferenceChange>();
    readonly onPreferenceChanged = this.onPreferenceChangedEmitter.event;

    @inject(PreferenceProviders)
    protected readonly createPreferenceProviders: PreferenceProviders;

    protected _preferenceProviders: PreferenceProvider[] | undefined;
    protected get preferenceProviders(): PreferenceProvider[] {
        if (!this._preferenceProviders) {
            this._preferenceProviders = this.createPreferenceProviders();
        }
        return this._preferenceProviders;
    }

    onStart() {
        // tslint:disable-next-line:no-unused-expression
        this.ready;
    }

    protected _ready: Promise<void> | undefined;
    get ready(): Promise<void> {
        if (!this._ready) {
            this._ready = new Promise((resolve, reject) => {
                this.toDispose.push(Disposable.create(() => reject()));
                for (const preferenceProvider of this.preferenceProviders) {
                    this.toDispose.push(preferenceProvider);
                    preferenceProvider.onDidPreferencesChanged(event => this.reconcilePreferences());
                }
                this.reconcilePreferences();
                resolve();
            });
        }
        return this._ready;
    }

    dispose(): void {
        this.toDispose.dispose();
    }

    protected reconcilePreferences(): void {
        const preferenceChanges: { [preferenceName: string]: PreferenceChange } = {};
        const deleted = new Set(Object.keys(this.preferences));

        for (const preferenceProvider of this.preferenceProviders) {
            const preferences = preferenceProvider.getPreferences();
            // tslint:disable-next-line:forin
            for (const preferenceName in preferences) {
                deleted.delete(preferenceName);
                const oldValue = this.preferences[preferenceName];
                const newValue = preferences[preferenceName];
                if (oldValue) {
                    /* Value changed */
                    if (!JSONExt.deepEqual(oldValue, newValue)) {
                        preferenceChanges[preferenceName] = { preferenceName, newValue, oldValue };
                        this.preferences[preferenceName] = newValue;
                    }
                    /* Value didn't change - Do nothing */
                } else {
                    /* New value without old value */
                    preferenceChanges[preferenceName] = { preferenceName, newValue };
                    this.preferences[preferenceName] = newValue;
                }
            }
        }

        /* Deleted values */
        for (const preferenceName of deleted) {
            const oldValue = this.preferences[preferenceName];
            preferenceChanges[preferenceName] = { preferenceName, oldValue };
            this.preferences[preferenceName] = undefined;
        }
        // tslint:disable-next-line:forin
        for (const preferenceName in preferenceChanges) {
            this.onPreferenceChangedEmitter.fire(preferenceChanges[preferenceName]);
        }
    }

    has(preferenceName: string): boolean {
        return this.preferences[preferenceName] !== undefined;
    }

    get<T>(preferenceName: string): T | undefined;
    get<T>(preferenceName: string, defaultValue: T): T;
    get<T>(preferenceName: string, defaultValue?: T): T | undefined {
        const value = this.preferences[preferenceName];
        return value !== null && value !== undefined ? value : defaultValue;
    }

    getBoolean(preferenceName: string): boolean | undefined;
    getBoolean(preferenceName: string, defaultValue: boolean): boolean;
    getBoolean(preferenceName: string, defaultValue?: boolean): boolean | undefined {
        const value = this.preferences[preferenceName];
        return value !== null && value !== undefined ? !!value : defaultValue;
    }

    getString(preferenceName: string): string | undefined;
    getString(preferenceName: string, defaultValue: string): string;
    getString(preferenceName: string, defaultValue?: string): string | undefined {
        const value = this.preferences[preferenceName];
        if (value === null || value === undefined) {
            return defaultValue;
        }
        if (typeof value === "string") {
            return value;
        }
        return value.toString();
    }

    getNumber(preferenceName: string): number | undefined;
    getNumber(preferenceName: string, defaultValue: number): number;
    getNumber(preferenceName: string, defaultValue?: number): number | undefined {
        const value = this.preferences[preferenceName];

        if (value === null || value === undefined) {
            return defaultValue;
        }
        if (typeof value === "number") {
            return value;
        }
        return Number(value);
    }

}
