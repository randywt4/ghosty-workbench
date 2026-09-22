import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";

import { resolveUserDataPath } from "./DesktopUserData.ts";

it.effect("isolates an explicit profile without inspecting or copying upstream data", () =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const result = yield* resolveUserDataPath({
      appDataDirectory: "/upstream-profiles",
      desktopUserDataDirectory: " /ghosty-profile ",
      isDevelopment: false,
      platform: "win32",
    });
    assert.equal(result, path.resolve("/ghosty-profile"));
  }).pipe(
    Effect.provide(NodeServices.layer),
    Effect.provideService(
      FileSystem.FileSystem,
      FileSystem.makeNoop({
        exists: () => Effect.die("Explicit profiles must not inspect upstream data"),
      }),
    ),
  ),
);

it.effect("uses fork dev/prod profile names that never collide with official T3", () =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const dev = yield* resolveUserDataPath({
      appDataDirectory: "/profiles",
      isDevelopment: true,
      platform: "win32",
    });
    const prod = yield* resolveUserDataPath({
      appDataDirectory: "/profiles",
      isDevelopment: false,
      platform: "win32",
    });
    assert.equal(dev, path.join("/profiles", "ghosty-workbench-dev"));
    assert.equal(prod, path.join("/profiles", "ghosty-workbench"));
  }).pipe(
    Effect.provide(NodeServices.layer),
    Effect.provideService(
      FileSystem.FileSystem,
      FileSystem.makeNoop({
        exists: () => Effect.die("Fork defaults must not inspect upstream profiles"),
      }),
    ),
  ),
);

it.effect("does not migrate upstream T3 profiles into the fork directory", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const directory = yield* fs.makeTempDirectoryScoped({ prefix: "ghosty-profile-" });
    // Upstream data that must be left alone.
    for (const upstream of ["t3code", "t3code-v2", "t3code-dev", "T3 Code (Alpha)"]) {
      const source = path.join(directory, upstream);
      yield* fs.makeDirectory(source, { recursive: true });
      yield* fs.writeFileString(path.join(source, "Local State"), '{"upstream":true}');
    }
    const result = yield* resolveUserDataPath({
      appDataDirectory: directory,
      isDevelopment: false,
      platform: "win32",
    });
    assert.equal(result, path.join(directory, "ghosty-workbench"));
    assert.isFalse(yield* fs.exists(path.join(result, "Local State")));
    assert.isFalse(yield* fs.exists(result));
  }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
);
