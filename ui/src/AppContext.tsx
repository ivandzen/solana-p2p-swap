import {createContext, useContext} from "react";
import {PublicKey} from "@solana/web3.js";

export interface AppContext {
    appMode: string|null,
    setAppMode: (mode:string)=>void,
    setOrderAddress: (order: PublicKey|null)=>void,
}

export const AppContext = createContext<AppContext>({} as AppContext);

export function useApp(): AppContext {
    return useContext(AppContext);
}