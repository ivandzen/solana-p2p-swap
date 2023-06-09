import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import {
    ConnectionProvider,
    useConnection,
    useWallet,
    WalletProvider
} from "@solana/wallet-adapter-react";
import {WalletModalProvider} from '@solana/wallet-adapter-react-ui';
import { BraveWalletAdapter, PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl, Connection, Keypair, PublicKey } from "@solana/web3.js";
import type { FC, ReactNode } from 'react';
import React, { useEffect, useMemo, useState } from "react";
import {MainWidget} from "./components/MainWidget";
import { AppContext, SupportedToken, SupportedTokens } from "./AppContext";
import { OrderDescriptionData, getTokens, WalletToken } from "./p2p-swap";
import supportedTokensFile from "./supportedTokens.json";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { MESSAGE_ERR, MESSAGE_INFO } from "./components/MessageTab";

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
            new BraveWalletAdapter(),
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [network]
    );

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect={true}>
                <WalletModalProvider>{children}</WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
};



const Content: FC = () => {
    const [buyOrderDescription, setBuyOrderDescription] = useState<OrderDescriptionData|null>(null);
    const {connection} = useConnection();
    const {wallet, signMessage, connected, connecting} = useWallet();
    const [orderAddress, setOrderAddress] = useState<PublicKey|null>(null);
    const [unlockKey, setUnlockKey] = useState<string|null>(null);
    const [appMode, setAppMode] = useState<string|null>(null);
    const [orders, setOrders] = useState<Map<PublicKey, OrderDescriptionData>|undefined>(undefined);
    const [walletTokens, setWalletTokens] = useState<Map<string, WalletToken>>(new Map());
    const [message, setMessage] = useState<string|null>(null);
    const [messageType, setMessageType] = useState<string>('');
    const [closeMessageByClick, setCloseMessageByClick] = useState(false);

    useEffect(() => {
        if (connected) {
            const queryString = window.location.search;
            const urlParams = new URLSearchParams(queryString);
            const initAppMode = urlParams.get("mode");
            let initOrder: PublicKey|null = null;
            try {
                let tmp = urlParams.get("order_address");
                if (tmp)
                    initOrder = new PublicKey(tmp);
            } catch (e) {}
            const initUnlockKey = urlParams.get("unlock_key");
            setOrderAddress(initOrder);
            setUnlockKey(initUnlockKey);
            setAppMode(initAppMode ? initAppMode : "Orders");
            showInfoMessage(null, false);
        } else {
            showInfoMessage("Please, connect your Solana wallet", false);
        }
    }, [connected]);

    let domain = process.env.SITE_DOMAIN || "http://localhost:1234";

    let supportedTokens: Map<string, SupportedToken> = useMemo(() => {
        let result = new Map();
        for (let entry of supportedTokensFile) {
            result.set(entry.label,
                                {
                                    pubkey: new PublicKey(entry.pubkey),
                                    keypair:
                                        entry.mint_authority_kp
                                            ? Keypair.fromSecretKey(Uint8Array.from(entry.mint_authority_kp))
                                            : undefined,
                                });
        }

        return result;
    }, []);


    const updateWalletTokens = () => {
        const impl = async() => {
            if (!connected) {
                return;
            }

            if (wallet?.adapter.publicKey) {
                let tokens = await getTokens(connection, wallet.adapter.publicKey);
                setWalletTokens(tokens);
            } else {
                setWalletTokens(new Map());
            }
        };
        impl().then(()=>{});
    }

    useEffect(() => {
        updateWalletTokens();
    }, [connecting, connected, connection, wallet]);

    const showInfoMessage = (message: string|null, closeByClick: boolean) => {
        setMessageType(MESSAGE_INFO);
        setCloseMessageByClick(closeByClick);
        setMessage(message);
    }

    const showErrorMessage = (message: string|null, closeByClick: boolean) => {
        setMessageType(MESSAGE_ERR);
        setCloseMessageByClick(closeByClick);
        setMessage(message);
    }

    return (
        <AppContext.Provider value = {{
            appMode: appMode,
            orderAddress: orderAddress,
            unlockKey: unlockKey,
            setAppMode: setAppMode,
            setOrderAddress: setOrderAddress,
            setUnlockKey: setUnlockKey,
            buyOrderDescription: buyOrderDescription,
            setBuyOrderDescription: setBuyOrderDescription,
            domain: domain,
            connection: connection,
            wallet: wallet,
            signMessage: signMessage,
            orders: orders,
            setOrders: setOrders,
            supportedTokens: supportedTokens,
            walletTokens: walletTokens,
            updateWalletTokens: updateWalletTokens,
            explorer: 'https://solscan.io',
            cluster: 'devnet',
            message: message,
            messageType: messageType,
            closeMessageByClick: closeMessageByClick,
            showInfoMessage: showInfoMessage,
            showErrorMessage: showErrorMessage,
        }}>
            <MainWidget/>
        </AppContext.Provider>
    )
};
