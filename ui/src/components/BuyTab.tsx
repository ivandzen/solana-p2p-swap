import {ConnectionContextState, useConnection} from "@solana/wallet-adapter-react";
import {PublicKey} from "@solana/web3.js";
import {OrderDescription} from "./OrderDescription";
import React, {useEffect, useState} from "react";
import {ValueEdit} from "./ValueEdit";
import {getOrderDescription, OrderDescriptionData} from "../p2p-swap"

function publicKeyChecker(value: string): boolean {
    try {
        new PublicKey(value);
        return true;
    } catch (e) {
        return false;
    }
}

function BuyTab() {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    const [orderAddress, handleOrderAddressChange] = useState(urlParams.get('order_address'));
    const [orderDescription, setOrderDescription] = useState<OrderDescriptionData|null>(null);
    const connectionContext = useConnection();
    useEffect(() => {
        async function updateOrderDescription(
            connectionContext: ConnectionContextState,
            orderAddress: PublicKey
        ) {
            let orderDescription
                = await getOrderDescription(connectionContext.connection, orderAddress);

            if (orderDescription)
                setOrderDescription(orderDescription);
            else
                setOrderDescription(null);
        }

        if (orderAddress)
            updateOrderDescription(connectionContext, new PublicKey(orderAddress));
        else
            setOrderDescription(null);

    }, [connectionContext, orderAddress]);

    return (
        <div>
            <ValueEdit
                name={"Order Address:"}
                onChange={handleOrderAddressChange}
                valueChecker={publicKeyChecker}
                value={orderAddress ? orderAddress : undefined}
            />
            <OrderDescription description={orderDescription}/>
        </div>
    )
}

export { BuyTab }