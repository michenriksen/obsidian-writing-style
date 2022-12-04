import { spawn } from "child_process";
import { ValeAlert, ValeConfig } from "./types";

interface ValeResult {
  [key: string]: ValeAlert[];
}

export default class ValeRunner {
  private config: ValeConfig;

  public constructor(config: ValeConfig) {
    this.config = config;
  }

  public async lint(text: string): Promise<ValeAlert[]> {
    const child = spawn(
      this.config.valePath,
      ["--config", this.config.configPath, "--ext", ".md", "--output", "JSON"],
      {
        env: Object.assign({}, process.env, {
          PATH: process.env.PATH + ":/opt/homebrew/bin/"
        })
      }
    );

    let stdout = "";

    if (child.stdout) {
      child.stdout.on("data", data => {
        stdout += data;
      });
    }

    return new Promise((resolve, reject) => {
      child.on("error", reject);

      child.on("close", code => {
        if (code === 0) {
          resolve([]);
        } else if (code === 1) {
          const alerts: ValeAlert[] = [];
          const result: ValeResult = JSON.parse(stdout);
          for (const [_, v] of Object.entries(result)) {
            alerts.push(...v);
          }
          resolve(alerts);
        } else {
          reject(new Error(`Vale exited with unexpected exit code #{code}`));
        }
      });

      child.stdin.write(text);
      child.stdin.end();
    });
  }
}
