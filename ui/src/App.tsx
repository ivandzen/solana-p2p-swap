import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { ConnectionContextState, ConnectionProvider, WalletProvider, useConnection } from '@solana/wallet-adapter-react';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { UnsafeBurnerWalletAdapter } from '@solana/wallet-adapter-wallets';
import { PublicKey, clusterApiUrl } from '@solana/web3.js';
import type { FC, ReactNode } from 'react';
import React, { useEffect, useMemo, useState } from 'react';

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

interface OrderDescriptionData {
    creationSlot: bigint,
    seller: PublicKey,
    sellAmount: bigint,
    orderWallet: PublicKey,
    priceMint: PublicKey,
    buyAmount: bigint,
    minSellAmount: bigint,
    remainsToFill: bigint,
    isPrivate: boolean,
}

function OrderDescription({description}) {
    if (!description) {
        return (
            <h1>Order not found</h1>
        )
    }

    return (
        <>
            <table>
                <tr>
                    <th>Creation slot:</th>
                    <td>{description.creationSlot.toString()}</td>
                </tr>
                <tr>
                    <th>Seller:</th>
                    <td>{description.seller.toBase58()}</td>
                </tr>
                <tr>
                    <th>Sell amount:</th>
                    <td>{description.sellAmount.toString()}</td>
                </tr>
                <tr>
                    <th>Order wallet:</th>
                    <td>{description.orderWallet.toBase58()}</td>
                </tr>
                <tr>
                    <th>Price mint:</th>
                    <td>{description.priceMint.toBase58()}</td>
                </tr>
                <tr>
                    <th>Buy amount:</th>
                    <td>{description.buyAmount.toString()}</td>
                </tr>
                <tr>
                    <th>Min sell amount:</th>
                    <td>{description.minSellAmount.toString()}</td>
                </tr>
                <tr>
                    <th>Remains to fill:</th>
                    <td>{description.remainsToFill.toString()}</td>
                </tr>
                <tr>
                    <th>Is private:</th>
                    <td>{description.isPrivate.toString()}</td>
                </tr>
            </table>
        </>
    )
}

const OrderAddressEdit: FC = () => {
    const connectionContext = useConnection();
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    const [orderAddress, handleOrderAddressChange] = useState(urlParams.get('order_address'));
    const [orderDescription, setOrderDescription] = useState(null);

    const orderInfo = useEffect(() => {
        async function getOrderInfo(
            connectionContext: ConnectionContextState, 
            orderAddress: PublicKey
        ) {
            const orderData = await connectionContext.connection.getParsedAccountInfo(orderAddress);
            if (!orderData) {
                return;
            }

            if (!orderData.value) {
                return;
            }

            let value = orderData.value;
            let view = new DataView(value.data.slice(0, 137).buffer, 0);
            let creationSlot = view.getBigUint64(0, true);
            let seller = new PublicKey(orderData.value.data.slice(8, 40));
            let sellAmount = view.getBigUint64(40, true);
            let orderWallet = new PublicKey(orderData.value.data.slice(48, 80));
            let priceMint = new PublicKey(orderData.value.data.slice(80, 112));
            let buyAmount = view.getBigUint64(112, true);
            let minSellAmount = view.getBigUint64(120, true);
            let remainsToFill = view.getBigUint64(128, true);
            let isPrivate = view.getUint8(136) == 0 ? false : true;

            let orderDescription = {
                "creationSlot": creationSlot, 
                "seller": seller, 
                "sellAmount": sellAmount, 
                "orderWallet": orderWallet, 
                "priceMint": priceMint, 
                "buyAmount": buyAmount, 
                "minSellAmount": minSellAmount, 
                "remainsToFill": remainsToFill, 
                "isPrivate": isPrivate
            };

            setOrderDescription(orderDescription);
        }

        getOrderInfo(connectionContext, new PublicKey(orderAddress));
    }, [connectionContext, orderAddress]);

    return (
        <div>
            <table>
                <tr>
                    <th>Order address:</th>
                    <td><input value={orderAddress} onChange={handleOrderAddressChange}/></td>
                </tr>
            </table>
            <OrderDescription description={orderDescription}/>
        </div>
    );
}

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

function BuyTab() {
    return (
        <OrderAddressEdit/>
    )
}

function SellTab() {
    return (
        <h1>Sell</h1>
    )
}

function OrdersTab() {
    return (
        <h1>Orders</h1>
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

    const ordersClick = () => {
        setActiveTab("Orders");
    };

    return  (
        <div className="tab">
            <WalletMultiButton/>
            <div className="button">
                <ModeButton name="Buy" onClick={buyClick} activeName={activeTab}/>
                <ModeButton name="Sell" onClick={sellClick} activeName={activeTab}/>
                <ModeButton name="Orders" onClick={ordersClick} activeName={activeTab}/>
            </div>

            <ModeTab name="Buy" activeName={activeTab}><BuyTab/></ModeTab>
            <ModeTab name="Sell" activeName={activeTab}><SellTab/></ModeTab>
            <ModeTab name="Orders" activeName={activeTab}><OrdersTab/></ModeTab>
        </div>   
    );
}

const Content: FC = () => {
    return <MainWidget/>;
};
