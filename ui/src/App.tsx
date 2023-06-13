import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { UnsafeBurnerWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import type {FC, ReactNode} from 'react';
import React, { useMemo, useState } from 'react';
import { BuyTab } from "./components/BuyTab"
import { SellTab } from "./components/SellTab";

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
            new UnsafeBurnerWalletAdapter(),
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

function ModeButton({ name, onClick, activeName }) {
    return (
      <button className={name === activeName ? "tabbutton-active" : "tabbutton"} onClick={onClick}>
        {name}
      </button>
    );
}

function ModeTab({name, activeName, children}) {
    return (
        <div id={name} className={activeName === name ? "tabcontent-active":"tabcontent"}>
            {children}
        </div>
    )
}

const MainWidget: FC = () => {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    const mode = urlParams.get("mode");

    const [activeTab, setActiveTab] = useState(mode);

    const buyClick = () => {
        setActiveTab("Buy");
    };

    const sellClick = () => {
        setActiveTab("Sell");
    };

    return  (
        <div className="tab">
            <WalletMultiButton/>
            <div className="tabheader">
                <ModeButton name="Buy" onClick={buyClick} activeName={activeTab}/>
                <ModeButton name="Sell" onClick={sellClick} activeName={activeTab}/>
            </div>

            <ModeTab name="Buy" activeName={activeTab}><BuyTab/></ModeTab>
            <ModeTab name="Sell" activeName={activeTab}><SellTab/></ModeTab>
        </div>   
    );
}

const Content: FC = () => {
    return <MainWidget/>;
};
