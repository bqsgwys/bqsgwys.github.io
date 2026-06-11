export type FontVariant = {
  file: string;
  bold: boolean;
  italic: boolean;
};

export type FontFamily = {
  id: string;
  label: string;
  charset: string;
  variants: FontVariant[];
};

export function fontLabel(file: string) {
  return file.replace(/\.bdf$/i, "");
}
