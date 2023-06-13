import {ValueEdit} from "./ValueEdit";
import React from "react";
import {PublicKey} from "@solana/web3.js";

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
        <div>
            <ValueEdit
                name={"Creation slot:"}
                value={description.creationSlot.toString()}
                readonly={true}
            />
            <ValueEdit
                name={"Seller:"}
                value={description.seller.toBase58()}
                readonly={true}
            />
            <ValueEdit
                name={"Sell Amount:"}
                value={description.sellAmount.toString()}
                readonly={true}
            />
            <ValueEdit
                name={"Order Wallet:"}
                value={description.orderWallet.toBase58()}
                readonly={true}
            />
            <ValueEdit
                name={"Price Mint:"}
                value={description.priceMint.toBase58()}
                readonly={true}
            />
            <ValueEdit
                name={"Buy Amount:"}
                value={description.buyAmount.toString()}
                readonly={true}
            />
            <ValueEdit
                name={"Min Sell Amount:"}
                value={description.minSellAmount.toString()}
                readonly={true}
            />
            <ValueEdit
                name={"Remain to Fill:"}
                value={description.remainsToFill.toString()}
                readonly={true}
            />
            <ValueEdit
                name={"Is Private:"}
                value={description.isPrivate.toString()}
                readonly={true}
            />
        </div>
    )
}

export { type OrderDescriptionData, OrderDescription }