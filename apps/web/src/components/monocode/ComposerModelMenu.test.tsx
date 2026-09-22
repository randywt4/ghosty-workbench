import { act, useState, type ReactNode } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { ProviderDriverKind, ProviderInstanceId, type ServerProvider } from "@t3tools/contracts";
import { deriveProviderInstanceEntries } from "../../providerInstances";

vi.mock("@effect/atom-react", () => ({ useAtomValue: () => [] }));
vi.mock("../../state/server", () => ({ primaryServerKeybindingsAtom: {} }));
vi.mock("../../keybindings", () => ({
  modelPickerJumpCommandForIndex: () => null,
  modelPickerJumpIndexFromCommand: () => null,
  resolveShortcutCommand: () => null,
  shortcutLabelForCommand: () => null,
}));
const favorites: never[] = [];
vi.mock("~/hooks/useSettings", () => ({
  useClientSettings: () => favorites,
  useUpdateClientSettings: () => vi.fn(),
}));
vi.mock("../chat/ProviderInstanceIcon", () => ({ ProviderInstanceIcon: () => null }));
vi.mock("../ui/tooltip", () => ({
  Tooltip: ({ children }: { children: ReactNode }) => children,
  TooltipTrigger: ({ render }: { render: ReactNode }) => render,
  TooltipPopup: () => null,
}));
import { ComposerModelMenu } from "./ComposerModelMenu";

const instanceId = ProviderInstanceId.make("codex_personal");
const provider: ServerProvider = {
  instanceId,
  driver: ProviderDriverKind.make("codex"),
  enabled: true,
  installed: true,
  version: null,
  status: "ready",
  auth: { status: "authenticated" },
  checkedAt: "2026-09-22T00:00:00.000Z",
  models: [],
  slashCommands: [],
  skills: [],
};
const entries = deriveProviderInstanceEntries([provider]);
const models = new Map([
  [
    instanceId,
    [
      { slug: "gpt-one", name: "One" },
      { slug: "gpt-two", name: "Two" },
    ],
  ],
]);
let renderer: ReactTestRenderer;
afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  vi.unstubAllGlobals();
});

function Fixture() {
  const [selected, setSelected] = useState(["gpt-one"]);
  const [open, setOpen] = useState(true);
  return (
    <>
      <output>{selected.join(",")}</output>
      {open ? (
        <ComposerModelMenu
          activeInstanceId={instanceId}
          model={selected[0]!}
          lockedProvider={null}
          instanceEntries={entries}
          modelOptionsByInstance={models}
          terminalOpen={false}
          selectedModels={selected.map((model) => ({ instanceId, model }))}
          onInstanceModelChange={(_, model) => {
            setSelected([model]);
            setOpen(false);
          }}
          onToggleModel={(_, model) =>
            setSelected((current) =>
              current.includes(model)
                ? current.filter((value) => value !== model)
                : [...current, model],
            )
          }
        />
      ) : null}
    </>
  );
}

function mount() {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  act(() => {
    renderer = create(<Fixture />);
  });
}

describe("composer model selection", () => {
  it.each([false, true])("click preserves explicit additive intent (shift=%s)", (shiftKey) => {
    mount();
    const row = renderer.root
      .findAllByProps({ role: "option" })
      .find((row) => row.props["aria-label"].startsWith("Two,"))!;
    act(() => row.props.onClick({ shiftKey }));
    expect(renderer.root.findByType("output").children.join("")).toBe(
      shiftKey ? "gpt-one,gpt-two" : "gpt-two",
    );
    expect(renderer.root.findAllByType("input").length).toBe(shiftKey ? 1 : 0);
  });
  it.each([false, true])(
    "keyboard selection preserves explicit additive intent (shift=%s)",
    (shiftKey) => {
      mount();
      const search = renderer.root.findByType("input");
      act(() =>
        search.props.onKeyDown({ key: "ArrowDown", preventDefault() {}, stopPropagation() {} }),
      );
      act(() =>
        search.props.onKeyDown({
          key: "Enter",
          shiftKey,
          preventDefault() {},
          stopPropagation() {},
        }),
      );
      expect(renderer.root.findByType("output").children.join("")).toBe(
        shiftKey ? "gpt-one,gpt-two" : "gpt-two",
      );
      expect(renderer.root.findAllByType("input").length).toBe(shiftKey ? 1 : 0);
    },
  );
});
