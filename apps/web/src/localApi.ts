import type { ConfirmDialogOptions, ContextMenuItem, LocalApi } from "@t3tools/contracts";

import { requestConfirmDialog } from "./confirmDialog";
import {
  dismissMonocodeContextMenu,
  showMonocodeContextMenu,
} from "./components/monocode/MonocodeContextMenu";
import { readBrowserClientSettings, writeBrowserClientSettings } from "./clientPersistenceStorage";

let cachedApi: LocalApi | undefined;

function createBrowserLocalApi(): LocalApi {
  return {
    dialogs: {
      pickFolder: async (options) => {
        if (!window.desktopBridge) return null;
        return window.desktopBridge.pickFolder(options);
      },
      confirm: async (message, options?: ConfirmDialogOptions) => {
        return requestConfirmDialog(message, options) ?? false;
      },
    },
    shell: {
      openExternal: async (url) => {
        if (window.desktopBridge) {
          const opened = await window.desktopBridge.openExternal(url);
          if (!opened) {
            throw new Error("Unable to open link.");
          }
          return;
        }

        window.open(url, "_blank", "noopener,noreferrer");
      },
      // Only the desktop shell can reach the OS; the web build (and older
      // desktop shells that predate this method) have nothing to open.
      openSystemSettings: async (pane) => {
        if (!window.desktopBridge?.openSystemSettings) {
          throw new Error("Unable to open System Settings.");
        }
        const opened = await window.desktopBridge.openSystemSettings(pane);
        if (!opened) {
          throw new Error("Unable to open System Settings.");
        }
      },
    },
    contextMenu: {
      show: async <T extends string>(
        items: readonly ContextMenuItem<T>[],
        position?: { x: number; y: number },
      ): Promise<T | null> => {
        // Shared MonoCode renderer for every caller (sessions, multi-select,
        // files, right-panel tabs...). The native OS menu no longer catches
        // app menus; Electron is untouched because live processes must stay.
        return showMonocodeContextMenu(items, position);
      },
      // The shared menu renders in-DOM on every surface, so close always
      // dismisses it with a null resolution (outside/Escape equivalent).
      close: async () => {
        dismissMonocodeContextMenu();
      },
    },
    persistence: {
      getClientSettings: async () => {
        if (window.desktopBridge) {
          return window.desktopBridge.getClientSettings();
        }
        return readBrowserClientSettings();
      },
      setClientSettings: async (settings) => {
        if (window.desktopBridge) {
          return window.desktopBridge.setClientSettings(settings);
        }
        writeBrowserClientSettings(settings);
      },
    },
  };
}

export function createLocalApi(): LocalApi {
  return createBrowserLocalApi();
}

export function readLocalApi(): LocalApi | undefined {
  if (typeof window === "undefined") return undefined;
  if (cachedApi) return cachedApi;

  cachedApi = createLocalApi();
  return cachedApi;
}

export function ensureLocalApi(): LocalApi {
  const api = readLocalApi();
  if (!api) {
    throw new Error("Local API not found");
  }
  return api;
}
