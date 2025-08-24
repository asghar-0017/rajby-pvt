import React from "react";
import AppRouter from "./routes/routes";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

// Create theme with Kumbh Sans font
const theme = createTheme({
  typography: {
    fontFamily: '"Kumbh Sans", sans-serif',
    allVariants: {
      fontFamily: '"Kumbh Sans", sans-serif',
    },
    h1: {
      fontFamily: '"Kumbh Sans", sans-serif',
    },
    h2: {
      fontFamily: '"Kumbh Sans", sans-serif',
    },
    h3: {
      fontFamily: '"Kumbh Sans", sans-serif',
    },
    h4: {
      fontFamily: '"Kumbh Sans", sans-serif',
    },
    h5: {
      fontFamily: '"Kumbh Sans", sans-serif',
    },
    h6: {
      fontFamily: '"Kumbh Sans", sans-serif',
    },
    body1: {
      fontFamily: '"Kumbh Sans", sans-serif',
    },
    body2: {
      fontFamily: '"Kumbh Sans", sans-serif',
    },
    button: {
      fontFamily: '"Kumbh Sans", sans-serif',
    },
    caption: {
      fontFamily: '"Kumbh Sans", sans-serif',
    },
    overline: {
      fontFamily: '"Kumbh Sans", sans-serif',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          fontFamily: '"Kumbh Sans", sans-serif',
        },
        "*": {
          fontFamily: '"Kumbh Sans", sans-serif',
        },
      },
    },
    MuiTypography: {
      styleOverrides: {
        root: {
          fontFamily: '"Kumbh Sans", sans-serif !important',
        },
      },
    },
    MuiListItemText: {
      styleOverrides: {
        primary: {
          fontFamily: '"Kumbh Sans", sans-serif !important',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        label: {
          fontFamily: '"Kumbh Sans", sans-serif !important',
        },
      },
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppRouter />
      <ToastContainer />
    </ThemeProvider>
  );
}

export default App
