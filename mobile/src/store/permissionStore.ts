import { create } from 'zustand';
import type { PermissionKey, PermissionMap, PermissionStatus } from '../types';
import { checkAllPermissions, requestPermission } from '../core/permissions/permissions';

interface PermissionStore {
  statuses: PermissionMap;
  loaded: boolean;
  onboardingDone: boolean;
  refresh: () => Promise<void>;
  request: (key: PermissionKey) => Promise<PermissionStatus>;
  completeOnboarding: () => void;
}

export const usePermissionStore = create<PermissionStore>(set => ({
  statuses: {
    location: 'unknown',
    backgroundLocation: 'unknown',
    phoneState: 'unknown',
    notifications: 'unknown',
  },
  loaded: false,
  onboardingDone: false,

  refresh: async () => {
    const statuses = await checkAllPermissions();
    // Si la ubicación ya está concedida, el onboarding no es necesario.
    set({ statuses, loaded: true, onboardingDone: statuses.location === 'granted' });
  },

  request: async key => {
    const status = await requestPermission(key);
    set(s => ({ statuses: { ...s.statuses, [key]: status } }));
    return status;
  },

  completeOnboarding: () => set({ onboardingDone: true }),
}));
