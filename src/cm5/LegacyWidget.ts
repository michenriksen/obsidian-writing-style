import { setIcon } from "obsidian";
import { ValeAlert } from "src/vale/types";
import { getSeverityClassName } from "../helpers";

interface LegacyWidgetArgs {
  alert: ValeAlert;
  matchedString: string;
  position: { left: number; bottom: number; top: number };
  onClick: (text: string) => void;
  addToDictionary: (text: string) => void;
  ignoreSuggestion: () => void;
}

export class LegacyWidget {
  private readonly elem: HTMLElement;

  public get element() {
    return this.elem;
  }

  public constructor(args: LegacyWidgetArgs, classToUse: string) {
    const message = args.alert.Message;
    const title = args.alert.Check;
    const buttons = (args.alert.Action.Params || []).slice(0, 3).map(v => v);
    const category = args.alert.Check;

    this.elem = createDiv(
      { cls: [classToUse, getSeverityClassName(category)] },
      root => {
        root.style.setProperty("left", `${args.position.left}px`);
        root.style.setProperty("top", `${args.position.bottom}px`);

        if (title) {
          root.createSpan({ cls: "sc-title" }, span => {
            span.createSpan({ text: title });
          });
        }

        if (message) {
          root.createSpan({ cls: "sc-message", text: message });
        }

        if (buttons.length) {
          root.createDiv({ cls: "sc-buttoncontainer" }, buttonContainer => {
            for (const btnText of buttons) {
              buttonContainer.createEl("button", { text: btnText }, button => {
                button.onclick = () => {
                  args.onClick(btnText);
                };
              });
            }
          });
        }

        root.createDiv({ cls: "sc-ignorecontainer" }, container => {
          container.createEl("button", { cls: "sc-ignore-btn" }, button => {
            if (category === "TYPOS") {
              setIcon(button.createSpan(), "plus-with-circle");
              button.createSpan({ text: "Add to personal dictionary" });
              button.onclick = () => {
                args.addToDictionary(args.matchedString);
              };
            } else {
              setIcon(button.createSpan(), "cross");
              button.createSpan({ text: "Ignore suggestion" });
              button.onclick = () => {
                args.ignoreSuggestion();
              };
            }
          });
        });
      }
    );

    document.body.append(this.elem);

    // Ensure widget is on screen
    const height = this.elem.clientHeight;
    const width = this.elem.clientWidth;

    if (args.position.bottom + height > window.innerHeight) {
      this.elem.style.setProperty("top", `${args.position.top - height}px`);
    }

    if (args.position.left + width > window.innerWidth) {
      this.elem.style.setProperty(
        "left",
        `${window.innerWidth - width - 15}px`
      );
    }
  }

  public destroy() {
    this.elem?.remove();
  }
}
