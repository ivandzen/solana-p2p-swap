import {createContext, useContext} from "react";
import {PublicKey} from "@solana/web3.js";

export interface AppState {
    appMode: string|null,
    orderAddress: PublicKey|null,
}

export interface AppContext {
    appState: AppState,
    setAppState: (state: AppState)=>void,
}

export const AppContext = createContext<AppContext>({} as AppContext);

export function useApp(): AppContext {
    return useContext(AppContext);
}