import React, { createContext, useCallback, useContext } from "react";
import type { CFC } from "../types";

export type Clipboard = Readonly<{
  writeText(data: string): Promise<void>;
}>;

const ClipboardContext = createContext<Clipboard>({
  async writeText() {
    // do nothing
  },
});

export const ClipboardProvider: CFC<Clipboard> = ({ children, ...value }) => {
  return (
    <ClipboardContext.Provider value={value}>
      {children}
    </ClipboardContext.Provider>
  );
};

export const BrowserClipboardProvider: CFC = (props) => {
  const writeText = useCallback(
    (data: string) => window.navigator.clipboard.writeText(data),
    []
  );
  return <ClipboardProvider {...props} writeText={writeText} />;
};

export const useClipboard = () => {
  return useContext(ClipboardContext);
};
