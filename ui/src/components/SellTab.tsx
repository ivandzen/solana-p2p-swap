import React, {useState} from "react";
import {ValueEdit} from "./ValueEdit";

function SellTab() {
    const [sellToken, onSellTokenChange] = useState("");
    const [sellAmount, onSellAmountChange] = useState("0");
    const [sellMinimum, onSellMinimumChange] = useState("0");
    const [buyToken, onBuyTokenChange] = useState("");
    const [buyAmount, onBuyAmountChange] = useState("0");
    return (
        <div>
            <ValueEdit name={"Sell Token:"} value={sellToken} onChange={onSellTokenChange}/>
            <ValueEdit name={"Sell Amount:"} value={sellAmount.toString()} onChange={onSellAmountChange}/>
            <ValueEdit name={"Sell Minimum:"} value={sellMinimum.toString()} onChange={onSellMinimumChange}/>
            <ValueEdit name={"Buy Token:"} value={buyToken} onChange={onBuyTokenChange}/>
            <ValueEdit name={"Buy Amount:"} value={buyAmount.toString()} onChange={onBuyAmountChange}/>
        </div>
    )
}

export { SellTab }