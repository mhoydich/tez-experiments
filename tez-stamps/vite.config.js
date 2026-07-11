// Beacon SDK expects node globals (Buffer, process, global) that Vite
// doesn't provide in the browser; the polyfill plugin restores them.
// The aliases point Beacon packages at the single-file build — Vite's
// dep prebundler otherwise trips a circular-import crash inside Beacon
// ("Cannot read properties of undefined (reading 'OPERATION_REQUEST_SENT')").
import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { fileURLToPath } from "node:url";

const beaconBundle = fileURLToPath(
  new URL("./node_modules/@airgap/beacon-sdk/dist/walletbeacon.min.js", import.meta.url)
);

export default defineConfig({
  plugins: [nodePolyfills()],
  resolve: {
    alias: {
      "@airgap/beacon-sdk": beaconBundle,
      "@airgap/beacon-dapp": beaconBundle,
    },
  },
});
