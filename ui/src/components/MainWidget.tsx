import React, {FC, ReactNode, useState} from "react";
import {WalletMultiButton} from "@solana/wallet-adapter-react-ui";
import {BuyTab} from "./BuyTab";
import {SellTab} from "./SellTab";
import {AppContext} from "../AppContext";
import {PublicKey} from "@solana/web3.js";

function ModeButton(
    { name, onClick, activeName }:
        {
            name: string,
            onClick: (event:any)=>void,
            activeName: string|null,
        }) {
    return (
        <button
            className={name === activeName ? "tabbutton-active" : "tabbutton"}
            onClick={onClick}
        >
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
        <div id={name} className={activeName === name ? "" : "inactive"}>
            {children}
        </div>
    )
}

const MainWidget: FC = () => {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);

    const [appMode, setAppMode] = useState<string|null>(urlParams.get("mode"));
    let urlOrder: PublicKey|null = null;
    try {
        let tmp = urlParams.get("order_address");
        if (tmp)
            urlOrder = new PublicKey(tmp);
    } catch (e) {}

    const [orderAddress, setOrderAddress] = useState<PublicKey|null>(urlOrder);

    const buyClick = () => {
        setAppMode("Buy");
    };

    const sellClick = () => {
        setAppMode("Sell");
    };

    return  (
        <AppContext.Provider
            value = {{
                appMode: appMode,
                setAppMode: setAppMode,
                setOrderAddress: (order: PublicKey|null) => {
                    console.log(`NEW ORDER: ${order}`);
                    if (order) setOrderAddress(order);
                },
            }}
        >
            <div className="mainwindow">
                <div className="walletbutton">
                    <WalletMultiButton/>
                </div>
                <div className ="tab">
                    <div className="tabcontent">
                        <div className="tabheader">
                            <ModeButton name="Buy" onClick={buyClick} activeName={appMode}/>
                            <ModeButton name="Sell" onClick={sellClick} activeName={appMode}/>
                        </div>

                        <ModeTab name="Buy" activeName={appMode}>
                            <BuyTab orderAddress={orderAddress ? orderAddress.toString() : undefined}/>
                        </ModeTab>
                        <ModeTab name="Sell" activeName={appMode}><SellTab/></ModeTab>
                    </div>
                </div>
            </div>
        </AppContext.Provider>
    );
}

export {MainWidget}