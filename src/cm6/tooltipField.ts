import { EditorView, Tooltip, showTooltip } from "@codemirror/view";
import { StateField, EditorState } from "@codemirror/state";
import { getSeverityClassName } from "../helpers";
import { setIcon } from "obsidian";
import LanguageToolPlugin from "src";
import {
  UnderlineEffect,
  clearUnderlinesInRange,
  underlineField,
  ignoreUnderline
} from "./underlineStateField";
import { ValeAlert } from "src/vale/types";

function contructTooltip(
  plugin: LanguageToolPlugin,
  view: EditorView,
  underline: UnderlineEffect
) {
  const alert = underline.alert;
  const message = alert.Message;
  const title = alertTitle(alert);
  let replacements: string[] = [];
  if (alert.Action.Name === "replace") {
    replacements = alert.Action.Params.slice(0, 3)
      .map(v => v)
      .filter(v => v.trim());
  }
  const category = alert.Check;
  const link = alert.Link;

  const mainClass = plugin.settings.glassBg
    ? "sc-predictions-container-glass"
    : "sc-predictions-container";

  return createDiv(
    { cls: [mainClass, getSeverityClassName(category)] },
    root => {
      if (title) {
        root.createSpan({ cls: "sc-title" }, span => {
          span.createSpan({ text: title });
        });
      }

      if (message) {
        root.createSpan({ cls: "sc-message", text: message });
      }

      if (link) {
        root.createSpan({ cls: "sc-link" }, span => {
          span.createEl("a", { text: "more info", href: link });
        });
      }

      const clearUnderlineEffect = clearUnderlinesInRange.of({
        from: underline.from,
        to: underline.to
      });

      const ignoreUnderlineEffect = ignoreUnderline.of({
        from: underline.from,
        to: underline.to
      });

      if (replacements.length) {
        root.createDiv({ cls: "sc-buttoncontainer" }, buttonContainer => {
          for (const replacement of replacements) {
            buttonContainer.createEl(
              "button",
              { text: replacement },
              button => {
                button.onclick = () => {
                  view.dispatch({
                    changes: [
                      {
                        from: underline.from,
                        to: underline.to,
                        insert: replacement
                      }
                    ],
                    effects: [clearUnderlineEffect]
                  });
                };
              }
            );
          }
        });
      }

      root.createDiv({ cls: "sc-ignorecontainer" }, container => {
        container.createEl("button", { cls: "sc-ignore-btn" }, button => {
          setIcon(button.createSpan(), "cross");
          button.createSpan({ text: "Ignore suggestion" });
          button.onclick = () => {
            view.dispatch({
              effects: [ignoreUnderlineEffect]
            });
          };
        });
      });
    }
  );
}

function getTooltip(
  tooltips: readonly Tooltip[],
  plugin: LanguageToolPlugin,
  state: EditorState
): readonly Tooltip[] {
  const underlines = state.field(underlineField);

  if (underlines.size === 0 || state.selection.ranges.length > 1) {
    return [];
  }

  let primaryUnderline: UnderlineEffect | null = null;

  underlines.between(
    state.selection.main.from,
    state.selection.main.to,
    (from, to, value) => {
      primaryUnderline = {
        from,
        to,
        alert: value.spec.alert
      } as UnderlineEffect;
    }
  );

  if (primaryUnderline !== null) {
    const { from, to } = primaryUnderline as UnderlineEffect;

    if (tooltips.length) {
      const tooltip = tooltips[0];

      if (tooltip.pos === from && tooltip.end === to) {
        return tooltips;
      }
    }

    return [
      {
        pos: from,
        end: to,
        above: true,
        strictSide: false,
        arrow: false,
        create: view => {
          return {
            dom: contructTooltip(
              plugin,
              view,
              primaryUnderline as UnderlineEffect
            )
          };
        }
      }
    ];
  }

  return [];
}

function alertTitle(alert: ValeAlert): string {
  return alert.Check;
}

export function buildTooltipField(plugin: LanguageToolPlugin) {
  return StateField.define<readonly Tooltip[]>({
    create: state => getTooltip([], plugin, state),
    update: (tooltips, tr) => getTooltip(tooltips, plugin, tr.state),
    provide: f => showTooltip.computeN([f], state => state.field(f))
  });
}
