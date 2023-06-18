import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import {WalletModalProvider} from '@solana/wallet-adapter-react-ui';
import {PhantomWalletAdapter} from '@solana/wallet-adapter-wallets';
import {clusterApiUrl, PublicKey} from '@solana/web3.js';
import type { FC, ReactNode } from 'react';
import React, {useMemo, useState} from 'react';
import {MainWidget} from "./components/MainWidget";
import {AppContext} from "./AppContext";
import {OrderDescriptionData} from "./p2p-swap";

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

    const initAppMode = urlParams.get("mode");
    let initOrder: PublicKey|null = null;
    try {
        let tmp = urlParams.get("order_address");
        if (tmp)
            initOrder = new PublicKey(tmp);
    } catch (e) {}
    const iniUnlockKey = urlParams.get("unlock_key");

    const [appMode, setAppMode] = useState<string|null>(initAppMode);
    const [orderAddress, setOrderAddress] = useState<PublicKey|null>(initOrder);
    const [unlockKey, setUnlockKey] = useState<string|null>(iniUnlockKey);
    const [sellOrderDescription, setSellOrderDescription] = useState<OrderDescriptionData|null>(null);
    const [buyOrderDescription, setBuyOrderDescription] = useState<OrderDescriptionData|null>(null);

    return (
        <AppContext.Provider value = {{
            appMode: appMode,
            orderAddress: orderAddress,
            unlockKey: unlockKey,
            setAppMode: setAppMode,
            setOrderAddress: setOrderAddress,
            setUnlockKey: setUnlockKey,
            sellOrderDescription: sellOrderDescription,
            setSellOrderDescription: setSellOrderDescription,
            buyOrderDescription: buyOrderDescription,
            setBuyOrderDescription: setBuyOrderDescription,
            domain: "http://localhost:1234"
        }}>
            <MainWidget/>
        </AppContext.Provider>
    )
};
