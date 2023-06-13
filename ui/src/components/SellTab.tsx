import React, {useState} from "react";
import {ValueEdit} from "./ValueEdit";
import {publicKeyChecker} from "../p2p-swap";

function SellTab() {
    const [sellToken, onSellTokenChange] = useState<string|null>(null);
    const [sellAmount, onSellAmountChange] = useState<string|null>("0");
    const [sellMinimum, onSellMinimumChange] = useState<string|null>("0");
    const [buyToken, onBuyTokenChange] = useState<string|null>(null);
    const [buyAmount, onBuyAmountChange] = useState<string|null>("0");
    return (
        <div>
            <ValueEdit
                name={"Sell Token:"}
                value={sellToken}
                onChange={onSellTokenChange}
                valueChecker={publicKeyChecker}
            />
            <ValueEdit name={"Sell Amount:"} value={sellAmount ? sellAmount.toString() : null} onChange={onSellAmountChange}/>
            <ValueEdit name={"Sell Minimum:"} value={sellMinimum ? sellMinimum.toString() : null} onChange={onSellMinimumChange}/>
            <ValueEdit
                name={"Buy Token:"}
                value={buyToken}
                onChange={onBuyTokenChange}
                valueChecker={publicKeyChecker}
            />
            <ValueEdit name={"Buy Amount:"} value={buyAmount ? buyAmount.toString() : null} onChange={onBuyAmountChange}/>
        </div>
    )
}

export { SellTab }