import {createContext, useContext} from "react";
import {PublicKey} from "@solana/web3.js";
import {OrderDescriptionData} from "./p2p-swap";

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
}

export const AppContext = createContext<AppContext>({} as AppContext);

export function useApp(): AppContext {
    return useContext(AppContext);
}