"use client";

import { Toaster as HotToaster } from "react-hot-toast";

/** App-wide toast host (mounted once in the root layout), styled with theme tokens. */
export function Toaster() {
  return (
    <HotToaster
      position="top-center"
      toastOptions={{
        duration: 4000,
        className: "!rounded-full !border !border-glass-edge !bg-popover !text-popover-foreground !text-sm !font-medium !shadow-glass-lg !backdrop-blur-xl",
      }}
    />
  );
}
