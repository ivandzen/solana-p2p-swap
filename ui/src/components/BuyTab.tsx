import {ConnectionContextState, useConnection} from "@solana/wallet-adapter-react";
import {PublicKey} from "@solana/web3.js";
import {OrderDescription, OrderDescriptionData} from "./OrderDescription";
import React, {useEffect, useState} from "react";
import {ValueEdit} from "./ValueEdit";

async function getOrderDescription(
    connectionContext: ConnectionContextState,
    orderAddress: PublicKey
): Promise<OrderDescriptionData | null> {
    const orderData = await connectionContext.connection.getParsedAccountInfo(orderAddress);
    if (!orderData) {
        return null;
    }

    if (!orderData.value) {
        return null;
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

    return {
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
}

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
    const [orderDescription, setOrderDescription] = useState(null);
    const connectionContext = useConnection();
    useEffect(() => {
        async function updateOrderDescription(
            connectionContext: ConnectionContextState,
            orderAddress: PublicKey
        ) {
            let orderDescription = await getOrderDescription(connectionContext, orderAddress);
            setOrderDescription(orderDescription);
        }

        try {
            updateOrderDescription(connectionContext, new PublicKey(orderAddress));
        } catch (e) {
            console.log("update order description: ERROR " + e);
        }
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