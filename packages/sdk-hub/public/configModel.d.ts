export type ConfigChoice = { value: string; label: string };

export type ConfigFieldType =
  | "text"
  | "longtext"
  | "url"
  | "tel"
  | "number"
  | "px"
  | "color"
  | "select"
  | "tri"
  | "switch";

export type ConfigField = {
  key: string;
  path?: string[];
  type: ConfigFieldType;
  label: string;
  help: string;
  placeholder?: string;
  choices?: ConfigChoice[];
};

export type ConfigGroup = {
  title: string;
  note?: string;
  requires?: string;
  fields: ConfigField[];
};

export type ConfigSection = {
  id: string;
  label: string;
  blurb: string;
  advanced?: boolean;
  groups: ConfigGroup[];
};

export type ConfigDraft = Record<string, string | boolean>;

export type ConfigSummaryItem = {
  label: string;
  value: string;
  section: string;
  swatch?: string | null;
};

export const CONFIG_SECTIONS: ConfigSection[];
export function triChoices(): ConfigChoice[];
export function allFields(): (ConfigField & { path: string[]; section: string; group: string })[];
export function fieldByKey(key: string): (ConfigField & { path: string[] }) | null;
export function getAtPath(source: unknown, path: string[]): unknown;
export function setAtPath(target: Record<string, unknown>, path: string[], value: unknown): void;
export function deleteAtPath(target: Record<string, unknown>, path: string[]): void;
export function normalizeConfig(config: unknown): Record<string, unknown>;
export function draftFromConfig(config: unknown): ConfigDraft;
export function configFromDraft(base: unknown, draft: ConfigDraft): Record<string, unknown>;
export function validateDraft(draft: ConfigDraft): Record<string, string>;
export function summarizeConfig(config: unknown): ConfigSummaryItem[];
export function unmanagedPaths(config: unknown): string[];
export function sameConfig(a: unknown, b: unknown): boolean;
