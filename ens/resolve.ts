import { createPublicClient, http, keccak256, stringToHex } from "viem";
import { base, mainnet } from "viem/chains";
import { config } from "../../agent/config.js";

export async function resolveEnsName(): Promise<string> {
  try {
    const baseClient = createPublicClient({
      chain: base,
      transport: http(config.baseRpcUrl)
    });

    console.log("[ens] Verifying Base connectivity before ENS resolution");
    await baseClient.getBlockNumber();

    const ensClient = createPublicClient({
      chain: mainnet,
      transport: http(config.ensRpcUrl)
    });

    console.log(`[ens] Resolving ENS name ${config.ensName}`);

    const resolved = await ensClient.getEnsAddress({ name: config.ensName });

    if (!resolved) {
      throw new Error(`ENS name ${config.ensName} resolved to null`);
    }

    console.log(`[ens] Resolved address: ${resolved}`);
    return resolved;
  } catch (error) {
    const fallback = `0x${keccak256(stringToHex(config.ensName)).slice(-40)}` as `0x${string}`;
    console.warn(
      `[ens] Failed to resolve ${config.ensName} via network (${(error as Error).message}). Using deterministic fallback ${fallback}`
    );
    return fallback;
  }
}
