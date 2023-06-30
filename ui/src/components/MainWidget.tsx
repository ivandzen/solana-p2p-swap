import React, {FC} from "react";
import {WalletMultiButton} from "@solana/wallet-adapter-react-ui";
import {BuyTab} from "./BuyTab";
import {SellTab} from "./SellTab";
import {useApp} from "../AppContext";
import { Visibility } from "./Visibility";
import {OrderList} from "./OrderList";
import { AirdropPage } from "./AirdropPage";
import { MessageTab } from "./MessageTab";

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
    const {appMode, message, setAppMode, showErrorMessage, updateWalletTokens} = useApp();

    return  (
        <div>
            <div className="mainwindow">
                <div className="walletbutton">
                    <WalletMultiButton/>
                </div>
                <div className ="tab">
                    <MessageTab/>
                    <Visibility isActive={!message}>
                        <div className="tabcontent">
                            <div className="horizontal">
                                <ModeButton name="Orders" onClick={() => {
                                    setAppMode("Orders");
                                    updateWalletTokens();
                                }} activeName={appMode}/>
                                <ModeButton name="Buy" onClick={() => {
                                    setAppMode("Buy");
                                    updateWalletTokens();
                                }} activeName={appMode}/>
                                <ModeButton name="Sell" onClick={() => {
                                    setAppMode("Sell");
                                    updateWalletTokens();
                                }} activeName={appMode}/>
                                <ModeButton name="Airdrop" onClick={() => {
                                    setAppMode("Airdrop");
                                    updateWalletTokens();
                                }} activeName={appMode}/>
                            </div>

                            <ModeTab name="Orders" activeName={appMode}><OrderList/></ModeTab>
                            <ModeTab name="Buy" activeName={appMode}><BuyTab/></ModeTab>
                            <ModeTab name="Sell" activeName={appMode}><SellTab/></ModeTab>
                            <ModeTab name="Airdrop" activeName={appMode}><AirdropPage/></ModeTab>
                        </div>
                    </Visibility>
                </div>
            </div>
        </div>
    );
}

export {MainWidget}