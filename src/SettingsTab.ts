import { App, PluginSettingTab, Setting } from "obsidian";
import StyleCheckPlugin from ".";
import { ValeBaseStyle, ValePackage, ValeSeverity } from "./vale/types";

export interface StyleCheckPluginSettings {
  saveValeConfig: boolean;
  shouldAutoCheck: boolean;
  glassBg: boolean;
  baseStyle: ValeBaseStyle;
  enabledPackages: ValePackage[];
  minAlertLevel: ValeSeverity;
  ignoreRules: string[];
  valePath: string;
  configPath: string;
}

export const DEFAULT_SETTINGS: StyleCheckPluginSettings = {
  saveValeConfig: true,
  shouldAutoCheck: false,
  glassBg: false,
  baseStyle: "Google",
  enabledPackages: ["write-good", "alex"],
  minAlertLevel: "suggestion",
  ignoreRules: ["Google.Exclamation", "Google.We", "write-good.E-Prime"],
  valePath: "",
  configPath: ""
};

const PACKAGES = new Map<ValePackage, string>([
  [
    "write-good",
    "Enables checks for passive voice, weakening adverbs, weasel words, cliches, and more."
  ],
  ["alex", "Enables checks for possible insensitive, inconsiderate writing."],
  ["Joblint", "Enables checks for common issues in Tech job posts."],
  ["proselint", "Enables checks inspired by the open-source proselint tool."],
  [
    "Hugo",
    "Enables support for shortcodes and other non-standard markup for the Hugo static site generator."
  ]
]);

export class StyleCheckSettingsTab extends PluginSettingTab {
  private readonly plugin: StyleCheckPlugin;
  public constructor(app: App, plugin: StyleCheckPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  public display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Settings for Writing Style" });

    new Setting(containerEl)
      .setName("Base Style")
      .setDesc("A comprehensive style guide to serve as a starting point.")
      .addDropdown(component => {
        component
          .setValue(this.plugin.settings.baseStyle)
          .addOptions({
            Google: "Google Developer Documentation Style Guide",
            Microsoft: "Microsoft Writing Style Guide",
            RedHat: "Red Hat Documentation Style Guide"
          })
          .onChange(async (value: ValeBaseStyle) => {
            this.plugin.settings.saveValeConfig = true;
            this.plugin.settings.baseStyle = value;
            await this.plugin.saveSettings();
          });
      });

    for (const [name, desc] of PACKAGES) {
      new Setting(containerEl)
        .setName(name)
        .setDesc(desc)
        .addToggle(component => {
          component
            .setValue(this.plugin.settings.enabledPackages.includes(name))
            .onChange(async value => {
              if (value === true) {
                if (!this.plugin.settings.enabledPackages.includes(name)) {
                  this.plugin.settings.saveValeConfig = true;
                  this.plugin.settings.enabledPackages.push(name);
                  await this.plugin.saveSettings();
                }
              } else {
                if (this.plugin.settings.enabledPackages.includes(name)) {
                  this.plugin.settings.saveValeConfig = true;
                  this.plugin.settings.enabledPackages.remove(name);
                  await this.plugin.saveSettings();
                }
              }
            });
        });
    }

    containerEl.createEl("h4", { text: "Filtering" });

    new Setting(containerEl)
      .setName("Issues")
      .setDesc("Issues to report.")
      .addDropdown(component => {
        component
          .setValue(this.plugin.settings.minAlertLevel)
          .addOptions({
            suggestion: "suggestions, warnings, and errors",
            warning: "warnings and errors",
            error: "errors"
          })
          .onChange(async (value: ValeSeverity) => {
            this.plugin.settings.saveValeConfig = true;
            this.plugin.settings.minAlertLevel = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Ignore Rules")
      .setDesc("Ignore issues from rules (one per line).")
      .setClass("sc-settings")
      .addTextArea(component => {
        component
          .setValue(this.plugin.settings.ignoreRules.join("\n"))
          .setPlaceholder("Google.Exclamation\nwrite-good.E-Prime")
          .onChange(async (value: string) => {
            this.plugin.settings.ignoreRules = value
              .split("\n")
              .map(v => v.trim());
            await this.plugin.saveSettings();
          });
      });

    containerEl.createEl("h4", { text: "Advanced" });

    new Setting(containerEl)
      .setName("Vale CLI path")
      .setDesc("Path to Vale executable")
      .addText(text => {
        text
          .setValue(this.plugin.settings.valePath)
          .onChange(async (value: string) => {
            this.plugin.settings.valePath = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Vale configuration")
      .setDesc("Path to Vale ini file")
      .addText(text => {
        text
          .setValue(this.plugin.settings.configPath)
          .onChange(async (value: string) => {
            this.plugin.settings.configPath = value;
            this.plugin.settings.saveValeConfig = true;
            await this.plugin.saveSettings();
          });
      });
  }
}
