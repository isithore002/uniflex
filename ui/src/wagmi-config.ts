// ═══════════════════════════════════════════════════════════════
// Wagmi Configuration for ENS Resolution
// Connects to Ethereum Mainnet for ENS lookups
// ═══════════════════════════════════════════════════════════════

import { createConfig, http } from 'wagmi';
import { mainnet } from 'wagmi/chains';

export const wagmiConfig = createConfig({
  chains: [mainnet],
  transports: {
    [mainnet.id]: http('https://eth.llamarpc.com'),
  },
});

// UniFlux deployment wallet (owner of uniflux.eth)
export const UNIFLUX_WALLET = '0xed0081BB40b7Bf64D407Ec25a99475d0BB8ed903' as const;
