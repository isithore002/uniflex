import { JsonRpcProvider, Wallet } from "ethers";
import * as dotenv from "dotenv";

dotenv.config({ path: "../.env" });

async function main() {
  console.log("PRIVATE_KEY length:", process.env.PRIVATE_KEY?.length ?? 0);

  const sepoliaProvider = new JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  const baseProvider = new JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);

  const walletSepolia = new Wallet(process.env.PRIVATE_KEY!, sepoliaProvider);
  const walletBase = new Wallet(process.env.PRIVATE_KEY!, baseProvider);

  console.log("Sepolia address:", await walletSepolia.getAddress());
  console.log("Sepolia chainId:", (await sepoliaProvider.getNetwork()).chainId);

  console.log("Base Sepolia address:", await walletBase.getAddress());
  console.log("Base Sepolia chainId:", (await baseProvider.getNetwork()).chainId);
}

main().catch(console.error);
