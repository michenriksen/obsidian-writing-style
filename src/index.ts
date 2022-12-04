import {
  MarkdownView,
  Menu,
  Plugin,
  FileSystemAdapter,
  normalizePath,
  setIcon
} from "obsidian";
import { EditorView } from "@codemirror/view";
import { StateEffect } from "@codemirror/state";
import QuickLRU from "quick-lru";
import {
  DEFAULT_SETTINGS,
  StyleCheckPluginSettings,
  StyleCheckSettingsTab
} from "./SettingsTab";
import { hashString, mapLineOffsets } from "./helpers";
import { buildUnderlineExtension } from "./cm6/underlineExtension";
import {
  addUnderline,
  clearUnderlines,
  clearUnderlinesInRange
} from "./cm6/underlineStateField";
import LegacyStyleCheckPlugin from "./cm5/LegacyPlugin";
import { legacyClearMarks } from "./cm5/helpers";
import ValeRunner from "./vale/runner";
import { ValeAlert, ValeConfig } from "./vale/types";
import { isAbsolute, join } from "path";
import ValeConfigurator from "./vale/configurator";

export default class StyleCheckPlugin extends Plugin {
  public settings: StyleCheckPluginSettings;
  public vale: ValeRunner;

  private configurator: ValeConfigurator;

  private statusBarText: HTMLElement;

  private hashLru: QuickLRU<number, ValeAlert>;
  private isloading = false;

  // Legacy editor
  private isLegacyEditor: boolean;
  private legacyPlugin: LegacyStyleCheckPlugin;

  public async onload() {
    this.isLegacyEditor = Boolean(
      !(this.app as any).isMobile &&
        (this.app.vault as any).getConfig("legacyEditor")
    );

    // Settings
    await this.loadSettings();

    const valeConfig: ValeConfig = {
      valePath: this.settings.valePath,
      configPath: this.settings.configPath
    };

    this.vale = new ValeRunner(valeConfig);
    this.configurator = new ValeConfigurator(valeConfig);

    this.addSettingTab(new StyleCheckSettingsTab(this.app, this));

    // Status bar
    this.app.workspace.onLayoutReady(() => {
      this.statusBarText = this.addStatusBarItem();
      this.setStatusBarReady();
      this.registerDomEvent(
        this.statusBarText,
        "click",
        this.handleStatusBarClick
      );
    });

    // Editor functionality
    if (this.isLegacyEditor) {
      this.legacyPlugin = new LegacyStyleCheckPlugin(this);
      await this.legacyPlugin.onload();
    } else {
      this.hashLru = new QuickLRU<number, ValeAlert>({
        maxSize: 10
      });
      this.registerEditorExtension(buildUnderlineExtension(this));
    }

    if (this.settings.saveValeConfig) {
      this.configurator.fromSettings(this.settings);
      this.settings.saveValeConfig = false;
      await this.saveData(this.settings);
    }

    // Commands
    this.registerCommands();
  }

  public onunload() {
    if (this.isLegacyEditor) {
      this.legacyPlugin.onunload();
    }

    this.hashLru.clear();
  }

  private registerCommands() {
    this.addCommand({
      id: "sccheck-text",
      name: "Check writing style",
      editorCallback: (editor, view) => {
        if (this.isLegacyEditor) {
          const cm = (editor as any).cm as CodeMirror.Editor;

          if (editor.somethingSelected()) {
            this.legacyPlugin
              .runDetection(cm, cm.getCursor("from"), cm.getCursor("to"))
              .catch(e => {
                console.error(e);
              });
          } else {
            this.legacyPlugin.runDetection(cm).catch(e => {
              console.error(e);
            });
          }
        } else {
          this.runDetection((editor as any).cm as EditorView, view).catch(e => {
            console.error(e);
          });
        }
      }
    });

    this.addCommand({
      id: "scautocheck-text",
      name: "Toggle automatic writing style check",
      callback: async () => {
        this.settings.shouldAutoCheck = !this.settings.shouldAutoCheck;
        await this.saveSettings();
      }
    });

    this.addCommand({
      id: "scclear",
      name: "Clear suggestions",
      editorCallback: editor => {
        if (this.isLegacyEditor) {
          if (this.legacyPlugin.markerMap.size > 0) {
            const cm = (editor as any).cm as CodeMirror.Editor;
            legacyClearMarks(this.legacyPlugin.markerMap, cm);
          }
        } else {
          const cm = (editor as any).cm as EditorView;
          cm.dispatch({
            effects: [clearUnderlines.of(null)]
          });
        }
      }
    });
  }

  public setStatusBarReady() {
    this.isloading = false;
    this.statusBarText.empty();
    this.statusBarText.createSpan({ cls: "sc-status-bar-btn" }, span => {
      span.createSpan({ cls: "sc-status-bar-check-icon" }, span => {
        setIcon(span, "eye");
      });
    });
  }

  public setStatusBarWorking() {
    if (this.isloading) return;

    this.isloading = true;
    this.statusBarText.empty();
    this.statusBarText.createSpan(
      { cls: ["sc-status-bar-btn", "sc-loading"] },
      span => {
        setIcon(span, "sync-small");
      }
    );
  }

  private readonly handleStatusBarClick = () => {
    const statusBarRect = this.statusBarText.parentElement?.getBoundingClientRect();
    const statusBarIconRect = this.statusBarText.getBoundingClientRect();

    new Menu(this.app)
      .addItem(item => {
        item.setTitle("Check current document");
        item.setIcon("checkbox-glyph");
        item.onClick(async () => {
          const activeLeaf = this.app.workspace.activeLeaf;
          if (
            activeLeaf?.view instanceof MarkdownView &&
            activeLeaf.view.getMode() === "source"
          ) {
            try {
              if (this.isLegacyEditor) {
                await this.legacyPlugin.runDetection(
                  (activeLeaf.view.editor as any).cm
                );
              } else {
                await this.runDetection(
                  (activeLeaf.view.editor as any).cm,
                  activeLeaf.view
                );
              }
            } catch (e) {
              console.error(e);
            }
          }
        });
      })
      .addItem(item => {
        item.setTitle(
          this.settings.shouldAutoCheck
            ? "Disable automatic checking"
            : "Enable automatic checking"
        );
        item.setIcon("uppercase-lowercase-a");
        item.onClick(async () => {
          this.settings.shouldAutoCheck = !this.settings.shouldAutoCheck;
          await this.saveSettings();
        });
      })
      .addItem(item => {
        item.setTitle("Clear suggestions");
        item.setIcon("reset");
        item.onClick(() => {
          const view = this.app.workspace.getActiveViewOfType(MarkdownView);
          if (!view) return;

          if (this.isLegacyEditor) {
            const cm = (view.editor as any).cm as CodeMirror.Editor;
            legacyClearMarks(this.legacyPlugin.markerMap, cm);
          } else {
            const cm = (view.editor as any).cm as EditorView;
            cm.dispatch({
              effects: [clearUnderlines.of(null)]
            });
          }
        });
      })
      .showAtPosition({
        x: statusBarIconRect.right + 5,
        y: (statusBarRect?.top || 0) - 5
      });
  };

  public async runDetection(
    editor: EditorView,
    view: MarkdownView,
    from?: number,
    to?: number
  ) {
    this.setStatusBarWorking();

    const selection = editor.state.selection.main;

    let text = view.data;
    let offset = 0;
    let isRange = false;
    let rangeFrom = 0;
    let rangeTo = 0;

    if (from === undefined && selection && selection.from !== selection.to) {
      from = selection.from;
      to = selection.to;
    }

    if (from !== undefined && to !== undefined) {
      text = editor.state.sliceDoc(from, to);
      offset = from;
      rangeFrom = from;
      rangeTo = to;
      isRange = true;
    }

    const hash = hashString(text);
    const lineOffsets = mapLineOffsets(text);

    if (this.hashLru.has(hash)) {
      return this.hashLru.get(hash)!;
    }

    const alerts = await this.vale.lint(text);

    const effects: StateEffect<any>[] = [];

    if (isRange) {
      effects.push(
        clearUnderlinesInRange.of({
          from: rangeFrom,
          to: rangeTo
        })
      );
    } else {
      effects.push(clearUnderlines.of(null));
    }

    if (alerts) {
      for (const alert of alerts) {
        if (alert.Span[1] === 0) {
          continue;
        }
        if (this.settings.ignoreRules.includes(alert.Check)) {
          continue;
        }
        const lineOffset = lineOffsets.get(alert.Line);
        if (lineOffset === undefined) {
          console.error(`Recieved alert on out-of-bound line ${alert.Line}`);
          continue;
        }
        const start = lineOffset + (alert.Span[0] - 1) + offset;
        let end = lineOffset + alert.Span[1] + offset;
        if (start === end) {
          end += 1;
        }

        effects.push(
          addUnderline.of({
            from: start,
            to: end,
            alert: alert
          })
        );
      }
    }

    if (effects.length) {
      editor.dispatch({
        effects
      });
    }

    this.setStatusBarReady();
  }

  public async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

    if (this.settings.configPath === "") {
      this.settings.configPath = this.absoluteConfigPath(
        join("plugins", "obsidian-writing-style", "data", ".vale.ini")
      );
    }

    if (this.settings.valePath === "") {
      if (process.platform === "win32") {
        this.settings.valePath = "vale.exe";
      } else {
        this.settings.valePath = "vale";
      }
    }
  }

  private absoluteConfigPath(dst: string): string {
    if (isAbsolute(dst)) {
      return dst;
    }

    const { adapter } = this.app.vault;

    if (adapter instanceof FileSystemAdapter) {
      return adapter.getFullPath(
        normalizePath(join(this.app.vault.configDir, dst))
      );
    }

    throw new Error("unsupported platform");
  }

  public async saveSettings() {
    if (this.settings.saveValeConfig) {
      await this.configurator.fromSettings(this.settings);
      this.settings.saveValeConfig = false;
    }

    await this.saveData(this.settings);
  }
}
