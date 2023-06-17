import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import {useWalletModal, WalletModalProvider} from '@solana/wallet-adapter-react-ui';
import {PhantomWalletAdapter} from '@solana/wallet-adapter-wallets';
import {clusterApiUrl, PublicKey} from '@solana/web3.js';
import type { FC, ReactNode } from 'react';
import React, {useMemo, useState} from 'react';
import {MainWidget} from "./components/MainWidget";
import {AppContext, AppState} from "./AppContext";

export const App: FC = () => {
    return (
        <Context>
            <Content />
        </Context>
    );
};

const Context: FC<{ children: ReactNode }> = ({ children }) => {
    // The network can be set to 'devnet', 'testnet', or 'mainnet-beta'.
    const network = WalletAdapterNetwork.Devnet;

    // You can also provide a custom RPC endpoint.
    const endpoint = useMemo(() => clusterApiUrl(network), [network]);

    const wallets = useMemo(
        () => [
            /**
             * Wallets that implement either of these standards will be available automatically.
             *
             *   - Solana Mobile Stack Mobile Wallet Adapter Protocol
             *     (https://github.com/solana-mobile/mobile-wallet-adapter)
             *   - Solana Wallet Standard
             *     (https://github.com/solana-labs/wallet-standard)
             *
             * If you wish to support a wallet that supports neither of those standards,
             * instantiate its legacy wallet adapter here. Common legacy adapters can be found
             * in the npm package `@solana/wallet-adapter-wallets`.
             */
            new PhantomWalletAdapter(),
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [network]
    );

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>{children}</WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
};

const Content: FC = () => {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);

    const appMode = urlParams.get("mode");
    let urlOrder: PublicKey|null = null;
    try {
        let tmp = urlParams.get("order_address");
        if (tmp)
            urlOrder = new PublicKey(tmp);
    } catch (e) {}
    const unlockKey = urlParams.get("unlock_key");

    const [appState, setAppState] = useState<AppState>({
        appMode: appMode,
        orderAddress: urlOrder,
        unlockKey: unlockKey,
    })

    return (
        <AppContext.Provider value = {{
            appState: appState,
            setAppState: setAppState,
        }}>
            <MainWidget/>
        </AppContext.Provider>
    )
};
