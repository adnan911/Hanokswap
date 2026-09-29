import type { ReactNode } from "react";
import type { EIP1193Provider } from "viem";

export default function NetworkGuard({ children }: { provider?: EIP1193Provider; children?: ReactNode }) {
  // HanokSwap supports all EVM networks dynamically via LI.FI multi-chain routing
  return <>{children}</>;
}
