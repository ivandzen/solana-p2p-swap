import {createContext, useContext} from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import {OrderDescriptionData} from "./p2p-swap";
import { Wallet } from "@solana/wallet-adapter-react";
import { MessageSignerWalletAdapterProps } from "@solana/wallet-adapter-base";

export interface AppContext {
    appMode: string|null,
    orderAddress: PublicKey|null,
    unlockKey: string|null,
    setAppMode: (mode: string) => void,
    setOrderAddress: (address: PublicKey|null) => void,
    setUnlockKey: (key: string|null) => void,
    sellOrderDescription: OrderDescriptionData|null,
    setSellOrderDescription: (descr: OrderDescriptionData|null) => void,
    buyOrderDescription: OrderDescriptionData|null,
    setBuyOrderDescription: (descr: OrderDescriptionData|null) => void,
    domain: string,
    connection: Connection,
    wallet: Wallet|null,
    signMessage: MessageSignerWalletAdapterProps['signMessage'] | undefined;
}

export const AppContext = createContext<AppContext>({} as AppContext);

export function useApp(): AppContext {
    return useContext(AppContext);
}