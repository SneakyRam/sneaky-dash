/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

interface SaveData {
    highScore: number;
    totalLifetimeGems: number;
}

const DEFAULT_SAVE: SaveData = {
    highScore: 0,
    totalLifetimeGems: 0,
};

const STORAGE_KEY = 'gemini_runner_save_v1';

export const SaveSystem = {
    load: (): SaveData => {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? { ...DEFAULT_SAVE, ...JSON.parse(data) } : DEFAULT_SAVE;
        } catch (e) {
            console.warn('Failed to load save data', e);
            return DEFAULT_SAVE;
        }
    },
    
    save: (data: Partial<SaveData>) => {
        try {
            const current = SaveSystem.load();
            const newData = { ...current, ...data };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
        } catch (e) {
            console.error('Failed to save data', e);
        }
    },

    get: (): SaveData => {
        return SaveSystem.load();
    }
};