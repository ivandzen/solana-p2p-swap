import React, {useState} from "react";
import {ValueEdit} from "./ValueEdit";

function SellTab() {
    const [sellToken, onSellTokenChange] = useState(null);
    const [sellAmount, onSellAmountChange] = useState(0);
    const [sellMinimum, onSellMinimumChange] = useState(0);
    const [buyToken, onBuyTokenChange] = useState(null);
    const [buyAmount, onBuyAmountChange] = useState(0);
    return (
        <div>
            <ValueEdit name={"Sell Token:"} value={sellToken} onChange={onSellTokenChange}/>
            <ValueEdit name={"Sell Amount:"} value={sellAmount} onChange={onSellAmountChange}/>
            <ValueEdit name={"Sell Minimum:"} value={sellMinimum} onChange={onSellMinimumChange}/>
            <ValueEdit name={"Buy Token:"} value={buyToken} onChange={onBuyTokenChange}/>
            <ValueEdit name={"Buy Amount:"} value={buyAmount} onChange={onBuyAmountChange}/>
        </div>
    )
}

export { SellTab }