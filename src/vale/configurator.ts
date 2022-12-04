import { spawn } from "child_process";
import { existsSync, mkdirSync, writeFileSync } from "fs";

import { safe, stringify } from "ini";
import { dirname, join } from "path";

import { StyleCheckPluginSettings } from "src/SettingsTab";
import { ValeConfig, ValeIni } from "./types";

const DEFAULT_VALE_INI: ValeIni = {
  StylesPath: "styles",
  MinAlertLevel: "suggestion",
  Packages: ["Google", "write-good"].join(", "),
  "*": {
    BasedOnStyles: ["Google", "write-good"].join(", ")
  }
};

export default class ValeConfigurator {
  private config: ValeConfig;

  public constructor(config: ValeConfig) {
    this.config = config;
  }

  public async fromSettings(
    settings: StyleCheckPluginSettings
  ): Promise<number> {
    this.save(this.iniFromSettings(settings));
    return this.sync();
  }

  private iniFromSettings(settings: StyleCheckPluginSettings): ValeIni {
    const packages = [settings.baseStyle, ...settings.enabledPackages]
      .map(p => safe(p))
      .join(", ");

    return Object.assign({}, DEFAULT_VALE_INI, {
      MinAlertLevel: settings.minAlertLevel,
      Packages: packages,
      "*": {
        BasedOnStyles: packages
      }
    });
  }

  private save(ini: ValeIni) {
    const dir = dirname(this.config.configPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    return writeFileSync(join(this.config.configPath), stringify(ini));
  }

  private async sync(): Promise<number> {
    const child = spawn(
      this.config.valePath,
      ["--config", this.config.configPath, "sync"],
      {
        env: Object.assign({}, process.env, {
          PATH: process.env.PATH + ":/opt/homebrew/bin"
        })
      }
    );

    return new Promise((resolve, reject) => {
      child.on("error", reject);

      child.on("close", code => {
        if (code === 0) {
          resolve(code);
        } else {
          reject(new Error(`Vale exited with unexpected exit code ${code}`));
        }
      });
    });
  }
}
