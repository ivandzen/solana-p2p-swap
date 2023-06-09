import React from "react";
import {ValueEdit} from "./ValueEdit";
import { OrderDescriptionData } from "../p2p-swap";

function OrderDescription({description}: {description: OrderDescriptionData|null}) {
    if (!description) {
        return(
            <div></div>
        )
    }

    return (
        <div className='vertical'>
            <div className="table-like">
                <ValueEdit
                    name={"Creation slot:"}
                    value={description.creationSlot.toString()}
                    readonly={true}
                />
                <ValueEdit
                    name={"Seller:"}
                    value={description.seller.toBase58()}
                    readonly={true}
                    copybutton={true}
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
                    copybutton={true}
                />
                <ValueEdit
                    name={"Token Mint:"}
                    value={description.tokenMint.toBase58()}
                    readonly={true}
                    copybutton={true}
                />
                <ValueEdit
                    name={"Price Mint:"}
                    value={description.priceMint.toBase58()}
                    readonly={true}
                    copybutton={true}
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
        </div>
    )
}

export { OrderDescription }