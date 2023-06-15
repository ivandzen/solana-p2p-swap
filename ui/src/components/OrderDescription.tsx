import {ValueEdit} from "./ValueEdit";
import React from "react";
import {OrderDescriptionData} from "../p2p-swap";
import {Button} from "./Button";

function OrderDescription({description}: {description: OrderDescriptionData|string}) {
    if (typeof (description) === 'string') {
        return (
            <h1>{description}</h1>
        )
    }

    const onBuyClicked = () => {
    }

    return (
        <div className="tabcontent">
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
            <ValueEdit
                name="Amount:"
                onChange={(value)=>{}}
                valueChecker={(value)=>{ return true; }}
                size={35}
                readonly={false}
                value="0"
            />
            <Button
                name="Buy"
                className="tabbutton-active"
                onClick={onBuyClicked}
            />
        </div>
    )
}

export { OrderDescription }