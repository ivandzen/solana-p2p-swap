import React, {FC, ReactNode, useState} from "react";
import {WalletMultiButton} from "@solana/wallet-adapter-react-ui";
import {BuyTab} from "./BuyTab";
import {SellTab} from "./SellTab";
import {AppContext, AppState, useApp} from "../AppContext";
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
    const {appState, setAppState} = useApp();

    const buyClick = () => {
        setAppState({
            appMode: "Buy",
            orderAddress: appState.orderAddress,
        })
    };

    const sellClick = () => {
        setAppState({
            appMode: "Sell",
            orderAddress: appState.orderAddress,
        })
    };

    return  (
        <div className="mainwindow">
            <div className="walletbutton">
                <WalletMultiButton/>
            </div>
            <div className ="tab">
                <div className="tabcontent">
                    <div className="tabheader">
                        <ModeButton name="Buy" onClick={buyClick} activeName={appState.appMode}/>
                        <ModeButton name="Sell" onClick={sellClick} activeName={appState.appMode}/>
                    </div>

                    <ModeTab name="Buy" activeName={appState.appMode}><BuyTab/></ModeTab>
                    <ModeTab name="Sell" activeName={appState.appMode}><SellTab/></ModeTab>
                </div>
            </div>
        </div>
    );
}

export {MainWidget}