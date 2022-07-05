import { extendTheme } from "@chakra-ui/react";

export const theme = extendTheme({
  colors: {
    foreground: {
      500: "var(--vscode-descriptionForeground)",
      600: "var(--vscode-editor-foreground)",
    },
    background: "var(--vscode-editor-background)",
    border: "var(--vscode-terminal-border)",
    error: "var(--vscode-editorMarkerNavigationError-background)",
    warning: "var(--vscode-editorMarkerNavigationWarning-background)",
    info: "var(--vscode-editorMarkerNavigationInfo-background)",
  },
  fontSizes: {
    md: "var(--vscode-font-size)",
  },
  styles: {
    global: {
      html: {
        WebkitFontSmoothing: "unset",
      },
      body: {
        fontFamily: "var(--vscode-font-family)",
        fontSize: "md",
        color: "foreground.500",
        backgroundColor: "background",
        padding: 0,
      },
    },
  },
  components: {
    Button: {
      defaultProps: {
        variant: "ghost",
        colorScheme: "foreground",
      },
      variants: {
        ghost: {
          _focus: {
            background: "rgba(90, 93, 94, 0.15)",
            boxShadow: "unset",
          },
          _hover: {
            background: "rgba(90, 93, 94, 0.15)",
          },
          _active: {
            background: "rgba(90, 93, 94, 0.31)",
          },
        },
      },
    },
    Tabs: {
      baseStyle: {
        tabpanel: {
          p: 0,
        },
      },
      variants: {
        line: {
          tab: {
            height: "36px",
            fontSize: "md",
            cursor: "default",
            color: "var(--vscode-tab-inactiveForeground)",
            backgroundColor: "var(--vscode-tab-inactiveBackground)",
            borderColor: "var(--vscode-editorGroupHeader-tabsBorder)",

            _selected: {
              color: "var(--vscode-tab-activeForeground)",
              backgroundColor: "var(--vscode-tab-activeBackground)",
              borderColor: "var(--vscode-tab-activeBorder)",
            },
            _active: {
              background: "unset",
            },
          },
        },
      },
    },
    Table: {
      variants: {
        simple: {
          table: {
            borderCollapse: "separate",
            borderSpacing: 0,
          },
          th: {
            color: "foreground.500",
            borderColor: "border",
            backgroundColor: "background",
            textTransform: "unset",
          },
          td: {
            fontFamily: "var(--vscode-editor-font-family)",
            fontSize: "var(--vscode-editor-font-size)",
            color: "foreground.600",
            borderColor: "border",
          },
        },
      },
    },
    Menu: {
      baseStyle: {
        list: {
          borderColor: "border",
          backgroundColor: "background",
        },
        item: {
          _focus: {
            background: "rgba(90, 93, 94, 0.15)",
          },
          _hover: {
            background: "rgba(90, 93, 94, 0.15)",
          },
          _active: {
            background: "rgba(90, 93, 94, 0.31)",
          },
        },
      },
    },
  },
});
