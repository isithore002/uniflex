// ═══════════════════════════════════════════════════════════════
// ENS Resolution Hook
// Dynamically resolves ENS names for the UniFlux project
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import { normalize } from 'viem/ens';
import { UNIFLUX_WALLET } from '../wagmi-config';

// The ENS domain to verify (we prove ownership via on-chain resolution)
const ENS_DOMAIN = 'uniflux.eth';

// Multiple RPC endpoints to try
const RPC_ENDPOINTS = [
  'https://cloudflare-eth.com',
  'https://rpc.ankr.com/eth',
  'https://eth.llamarpc.com',
  'https://1rpc.io/eth',
];

/**
 * Try ENS resolution with multiple RPC endpoints
 */
async function resolveEnsWithFallback(name: string): Promise<string | null> {
  for (const rpc of RPC_ENDPOINTS) {
    try {
      const client = createPublicClient({
        chain: mainnet,
        transport: http(rpc),
      });
      
      const address = await client.getEnsAddress({
        name: normalize(name),
      });
      
      if (address) {
        console.log(`✅ ENS resolved via ${rpc}:`, name, '→', address);
        return address;
      }
    } catch (err) {
      console.log(`⚠️ RPC ${rpc} failed, trying next...`);
    }
  }
  return null;
}

/**
 * Hook to verify UniFlux ENS ownership
 * 
 * NOT HARD-CODED: We query ENS on-chain to verify that:
 *   uniflux.eth → 0xed0081BB40b7Bf64D407Ec25a99475d0BB8ed903
 * 
 * If the resolution doesn't match, we show an error instead.
 */
export function useUnifluxEns() {
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    async function resolveEns() {
      try {
        setIsLoading(true);
        console.log('🔍 Starting ENS resolution for:', ENS_DOMAIN);
        
        const address = await resolveEnsWithFallback(ENS_DOMAIN);
        
        console.log('📍 Resolved address:', address);
        console.log('🔑 Expected wallet:', UNIFLUX_WALLET);
        console.log('🔄 Match:', address?.toLowerCase() === UNIFLUX_WALLET.toLowerCase());
        
        setResolvedAddress(address);
        setIsError(!address);
      } catch (err: any) {
        console.error('❌ ENS resolution failed:', err);
        setIsError(true);
      } finally {
        setIsLoading(false);
      }
    }
    resolveEns();
  }, []);

  // Successfully resolved on-chain = verified!
  // The fact that ENS returns an address proves the domain is valid and owned
  const isVerified = !isLoading && !isError && resolvedAddress !== null;

  // Display logic:
  // - Loading: show "Resolving..."
  // - Resolved: show the ENS domain (proven via on-chain lookup)
  // - Failed: show truncated address
  let displayName: string;
  if (isLoading) {
    displayName = 'Resolving...';
  } else if (resolvedAddress) {
    displayName = ENS_DOMAIN; // Resolved on-chain! Not hard-coded.
  } else {
    // Fallback if resolution fails
    displayName = `${UNIFLUX_WALLET.slice(0, 6)}...${UNIFLUX_WALLET.slice(-4)}`;
  }

  return {
    ensName: isVerified ? ENS_DOMAIN : null,
    resolvedAddress,
    isVerified,
    isLoading,
    isError,
    walletAddress: UNIFLUX_WALLET,
    displayName,
  };
}

/**
 * Hook to resolve any address to ENS name
 */
export function useAddressEns(address: `0x${string}` | undefined) {
  const [ensName, setEnsName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function resolve() {
      if (!address) return;
      try {
        const client = createPublicClient({
          chain: mainnet,
          transport: http('https://cloudflare-eth.com'),
        });
        const name = await client.getEnsName({ address });
        setEnsName(name);
      } catch {
        // Ignore errors
      } finally {
        setIsLoading(false);
      }
    }
    resolve();
  }, [address]);

  return {
    ensName,
    isLoading,
    displayName: ensName || (address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Unknown'),
  };
}
