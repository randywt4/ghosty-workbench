import * as Effect from "effect/Effect";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as Schema from "effect/Schema";

export class DesktopUserDataInitializationError extends Schema.TaggedError<DesktopUserDataInitializationError>()(
  "DesktopUserDataInitializationError",
  {
    operation: Schema.Literals(["inspect", "read", "create-directory", "write"]),
    resourcePath: Schema.String,
    category: Schema.String,
    cause: Schema.Defect(),
  },
) {
  override get message() {
    return `Could not initialize Electron user data during ${this.operation} at ${this.resourcePath} (${this.category}).`;
  }

  static fromFileSystem(
    cause: PlatformError.PlatformError,
    operation: DesktopUserDataInitializationError["operation"],
    resourcePath: string,
  ) {
    return new DesktopUserDataInitializationError({
      operation,
      resourcePath,
      category: cause.reason._tag,
      cause,
    });
  }
}

/** Select Electron's profile independently of the server's T3 home.
 *
 * Personal fork: defaults are ghosty-workbench-* so side-by-side installs never
 * share Chromium locks with official T3 and never migrate upstream credentials.
 * An explicit T3CODE_DESKTOP_USER_DATA_DIR (GhostyWorkbenchDev uses
 * %LOCALAPPDATA%/GhostyWorkbenchDev/electron-profile) and an explicit T3CODE_HOME
 * for server state always win; defaults are only a non-colliding fallback.
 */
export const resolveUserDataPath = Effect.fn("desktop.userData.resolveUserDataPath")(
  function* (input: {
    readonly appDataDirectory: string;
    readonly desktopUserDataDirectory?: string | undefined;
    readonly isDevelopment: boolean;
    readonly platform: NodeJS.Platform;
  }) {
    const path = yield* Path.Path;
    if (input.desktopUserDataDirectory?.trim()) {
      return path.resolve(input.desktopUserDataDirectory.trim());
    }
    const current = input.isDevelopment ? "ghosty-workbench-dev" : "ghosty-workbench";
    return path.join(input.appDataDirectory, current);
  },
);
