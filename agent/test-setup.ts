import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config({ path: "../.env" });

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  const network = await provider.getNetwork();
  console.log(`✅ Connected to Sepolia! Chain ID: ${network.chainId}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
