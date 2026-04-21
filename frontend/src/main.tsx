import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";

import App from "./App";
import { AuthProvider } from "./auth/AuthProvider";
import { queryClient } from "./lib/queryClient";
import { ActiveLibraryProvider } from "./libraries/ActiveLibraryProvider";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ActiveLibraryProvider>
          <App />
        </ActiveLibraryProvider>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
