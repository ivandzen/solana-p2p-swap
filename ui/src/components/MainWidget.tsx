import React, {FC, useState} from "react";
import {WalletMultiButton} from "@solana/wallet-adapter-react-ui";
import {BuyTab} from "./BuyTab";
import {SellTab} from "./SellTab";

function ModeButton(
    { name, onClick, activeName }:
        {
            name: string,
            onClick: (event:any)=>void,
            activeName: string|null,
        }) {
    return (
        <button className={name === activeName ? "tabbutton-active" : "tabbutton"} onClick={onClick}>
            {name}
        </button>
    );
}

function ModeTab(
    {name, activeName, children}:
        {
            name: string,
            activeName: string|null,
            children: any
        }) {
    return (
        <div id={name} className={activeName === name ? "tabcontent-active":"tabcontent"}>
            {children}
        </div>
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

    return  (
        <div className="tab">
            <WalletMultiButton/>
            <div className="tabheader">
                <ModeButton name="Buy" onClick={buyClick} activeName={activeTab}/>
                <ModeButton name="Sell" onClick={sellClick} activeName={activeTab}/>
            </div>

            <ModeTab name="Buy" activeName={activeTab}><BuyTab/></ModeTab>
            <ModeTab name="Sell" activeName={activeTab}><SellTab/></ModeTab>
        </div>
    );
}

export {MainWidget}