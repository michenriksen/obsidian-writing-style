export type ValeSeverity = "suggestion" | "warning" | "error";

export type ValePackage =
  | "alex"
  | "proselint"
  | "write-good"
  | "Joblint"
  | "Hugo";

export type ValeBaseStyle = "Google" | "Microsoft" | "RedHat";

export interface ValeAlert {
  Action: {
    Name: string;
    Params: string[];
  };
  Span: number[];
  Offset?: string[];
  Check: string;
  Description: string;
  Link: string;
  Message: string;
  Severity: ValeSeverity;
  Match: string;
  Line: number;
}

export interface ValeConfig {
  valePath: string;
  configPath: string;
}

export interface ValeIni {
  StylesPath: string;
  MinAlertLevel: ValeSeverity;
  Packages: string;
  "*": {
    BasedOnStyles: string;
  };
}
