import {ConnectionContextState, useConnection} from "@solana/wallet-adapter-react";
import {PublicKey} from "@solana/web3.js";
import {OrderDescription} from "./OrderDescription";
import React, {useEffect, useState} from "react";
import {ValueEdit} from "./ValueEdit";
import {getOrderDescriptionChecked, OrderDescriptionData, publicKeyChecker} from "../p2p-swap"
import {ButtonEditBox} from "./ButtonEditBox";

const P2P_SWAP_DEVNET = new PublicKey("AzVuKVf8qQjHBTyjEUZbr6zRvinZvjpuFZWMXPd76Fzx");

function BuyTab() {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    const [orderAddress, handleOrderAddressChange] = useState<string|null>(urlParams.get('order_address'));
    const [orderDescription, setOrderDescription]
        = useState<OrderDescriptionData|string>("Wrong order address");
    const connectionContext = useConnection();
    useEffect(() => {
        async function updateOrderDescription(
            connectionContext: ConnectionContextState,
            orderAddress: PublicKey
        ) {
            setOrderDescription('Loading...');
            try {
                let orderDescription
                    = await getOrderDescriptionChecked(connectionContext.connection, orderAddress, P2P_SWAP_DEVNET);
                setOrderDescription(orderDescription);
            } catch (e: any) {
                setOrderDescription(e.toString());
            }
        }

        if (orderAddress)
            updateOrderDescription(connectionContext, new PublicKey(orderAddress));
        else
            setOrderDescription('Wrong order address');

    }, [connectionContext, orderAddress]);

    return (
        <div>
            <ValueEdit
                name={"Order Address:"}
                onChange={handleOrderAddressChange}
                valueChecker={publicKeyChecker}
                value={orderAddress ? orderAddress : null}
            />
            <OrderDescription description={orderDescription}/>
        </div>
    )
}

export { BuyTab }