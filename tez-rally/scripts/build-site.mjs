// Public deployment configuration: these are public contract addresses,
// never wallet keys. A generic Vite build still uses the local .env file.
import './build-pickleball-home.mjs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const result = spawnSync(process.execPath, [fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url)), 'build'], {
  cwd: root, stdio: 'inherit',
  env: { ...process.env,
    VITE_NETWORK: 'mainnet',
    VITE_RPC: 'https://mainnet.api.tez.ie',
    VITE_INDEXER: 'https://api.tzkt.io',
    VITE_RALLY_ADDRESS: 'KT1X4iLYF11LvZhU6PFRamLioKjrcgDJEUoT',
    VITE_COURTS_ADDRESS: 'KT1Q1g8Sv3uL2beaA7h89hTViJyZmXxfUS9D',
  },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
