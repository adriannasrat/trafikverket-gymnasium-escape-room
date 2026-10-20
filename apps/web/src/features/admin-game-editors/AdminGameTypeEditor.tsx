import { adminGameEditorRegistry } from "./registry";
import type { AdminGameTypeEditorProps } from "./types";

export function AdminGameTypeEditor(props: AdminGameTypeEditorProps) {
  const Editor = adminGameEditorRegistry[props.game.type];
  return <Editor {...props} />;
}
